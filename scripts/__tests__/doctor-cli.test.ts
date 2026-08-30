import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import type { CliFinding } from '../doctor.mts';
import {
  EXIT_CODES,
  EXIT_INTERNAL,
  collectAlbumIds,
  collectPasswords,
  exitCodeFor,
  currentUid,
  findUnwritable,
  formatReport,
  frontmatterPassword,
  reportWritable,
  loadDotEnv,
  resolveCredentials,
  shouldUseColor,
  wrap,
  type EnvLike,
} from '../doctor.mts';
import type { DoctorFinding } from '../../lib/admin/doctor';

/**
 * The CLI's own logic — the gathering, the formatting and the exit-code
 * mapping. The checks themselves are covered by lib/__tests__/doctor.test.ts
 * and are imported, not reimplemented (#521).
 */

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'folio-doctor-'));
}

describe('exitCodeFor', () => {
  it('maps clean to 0 and the rest upwards', () => {
    expect(exitCodeFor('ok')).toBe(0);
    expect(exitCodeFor('warn')).toBe(1);
    expect(exitCodeFor('error')).toBe(2);
  });

  it('keeps the internal failure code out of the finding range', () => {
    expect(EXIT_INTERNAL).toBeGreaterThan(Math.max(...Object.values(EXIT_CODES)));
  });
});

describe('collectAlbumIds', () => {
  it('finds standalone, subpage and section albums in one pass', () => {
    const gallery = yaml.load(`
albums:
  - "11111111-1111-4111-8111-111111111111"
subpages:
  - name: Travel
    albums:
      - "22222222-2222-4222-8222-222222222222"
  - name: Japan
    sections:
      - title: Kyoto
        albums:
          - "33333333-3333-4333-8333-333333333333"
`);
    expect(collectAlbumIds(gallery)).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
    ]);
  });

  it('reads the ID off the object form that carries a title or a password', () => {
    const gallery = yaml.load(`
albums:
  - "44444444-4444-4444-8444-444444444444": Hokkaido
  - "55555555-5555-4555-8555-555555555555":
      title: Kyoto
      sort: filename
`);
    expect(collectAlbumIds(gallery)).toEqual([
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555',
    ]);
  });

  it('handles the map form of subpages', () => {
    const gallery = yaml.load(`
subpages:
  Travel:
    albums:
      - "66666666-6666-4666-8666-666666666666"
`);
    expect(collectAlbumIds(gallery)).toEqual(['66666666-6666-4666-8666-666666666666']);
  });

  /** hero and assetOrder hold asset UUIDs — reporting them as albums would
   *  turn every configured hero image into a "does not exist" error. */
  it('does not mistake asset IDs for album IDs', () => {
    const gallery = yaml.load(`
hero:
  - "77777777-7777-4777-8777-777777777777"
albums:
  - "88888888-8888-4888-8888-888888888888":
      sort: manual
      assetOrder:
        - "99999999-9999-4999-8999-999999999999"
`);
    expect(collectAlbumIds(gallery)).toEqual(['88888888-8888-4888-8888-888888888888']);
  });

  /** validateUuid() drops these rather than passing a typo on to Immich. */
  it('drops entries that are not UUIDs, and deduplicates', () => {
    const gallery = yaml.load(`
albums:
  - "your-album-uuid-1"
  - "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
subpages:
  - name: Travel
    albums:
      - "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
`);
    expect(collectAlbumIds(gallery)).toEqual(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
  });

  it('survives an empty or non-object document', () => {
    expect(collectAlbumIds(null)).toEqual([]);
    expect(collectAlbumIds('just a string')).toEqual([]);
  });
});

describe('collectPasswords', () => {
  it('finds a password wherever it sits, and labels it by path', () => {
    const gallery = yaml.load(`
subpages:
  - name: Projects
    password: "hunter2"
    albums:
      - "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb":
          password: "scrypt:a:b"
`);
    const found = collectPasswords(gallery, 'gallery.yaml');
    expect(found).toHaveLength(2);
    expect(found[0].label).toContain('Projects');
    expect(found[0].value).toBe('hunter2');
    expect(found[1].label).toContain('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  });

  it('picks up the site password from settings.yaml', () => {
    const settings = yaml.load('sitePassword: "scrypt:a:b"');
    const found = collectPasswords(settings, 'settings.yaml');
    expect(found).toHaveLength(1);
    expect(found[0].label).toBe('settings.yaml sitePassword');
  });

  it('ignores an empty password key', () => {
    expect(collectPasswords(yaml.load('password: ""'), 'gallery.yaml')).toEqual([]);
  });
});

describe('frontmatterPassword', () => {
  it('reads a quoted or bare value', () => {
    expect(frontmatterPassword('---\ntitle: A\npassword: "scrypt:a:b"\n---\n\nbody')).toBe(
      'scrypt:a:b',
    );
    expect(frontmatterPassword('---\npassword: hunter2\n---\n')).toBe('hunter2');
  });

  it('returns null without frontmatter, or without a password in it', () => {
    expect(frontmatterPassword('# Just markdown')).toBeNull();
    expect(frontmatterPassword('---\ntitle: A\n---\n')).toBeNull();
  });

  /** The body of an entry may well talk about passwords. */
  it('does not look past the frontmatter', () => {
    expect(frontmatterPassword('---\ntitle: A\n---\n\npassword: not-one\n')).toBeNull();
  });
});

describe('resolveCredentials', () => {
  it('prefers the environment over install.json', () => {
    const dir = tmpdir();
    fs.writeFileSync(
      path.join(dir, 'install.json'),
      JSON.stringify({ apiUrl: 'http://file:2283', apiKey: 'file-key', authSecret: 'file-secret' }),
    );
    const creds = resolveCredentials(dir, { IMMICH_API_URL: 'http://env:2283' });
    expect(creds.apiUrl).toBe('http://env:2283');
    expect(creds.apiKey).toBe('file-key');
    expect(creds.authSecret).toBe('file-secret');
  });

  it('treats an unparseable install.json as absent', () => {
    const dir = tmpdir();
    fs.writeFileSync(path.join(dir, 'install.json'), '{ not json');
    expect(resolveCredentials(dir, {})).toEqual({ apiUrl: '', apiKey: '', authSecret: '' });
  });

  it('strips the trailing slash and empties an invalid URL, as env.ts does', () => {
    const dir = tmpdir();
    expect(resolveCredentials(dir, { IMMICH_API_URL: 'http://immich:2283/' }).apiUrl).toBe(
      'http://immich:2283',
    );
    expect(resolveCredentials(dir, { IMMICH_API_URL: 'not a url' }).apiUrl).toBe('');
  });
});

describe('loadDotEnv', () => {
  it('reads .env.local ahead of .env, and never overwrites a real variable', () => {
    const dir = tmpdir();
    fs.writeFileSync(path.join(dir, '.env'), 'IMMICH_API_KEY=from-env\nAUTH_SECRET=from-env\n');
    fs.writeFileSync(path.join(dir, '.env.local'), 'AUTH_SECRET="from-local"\n');
    const env: EnvLike = { IMMICH_API_KEY: 'from-process' };
    loadDotEnv(dir, env);
    expect(env.IMMICH_API_KEY).toBe('from-process');
    expect(env.AUTH_SECRET).toBe('from-local');
  });

  it('drops trailing comments on unquoted values and keeps quoted ones whole', () => {
    const dir = tmpdir();
    fs.writeFileSync(
      path.join(dir, '.env'),
      'A=plain # a comment\nB="quoted # hash"\nexport C=exported\n',
    );
    const env: EnvLike = {};
    loadDotEnv(dir, env);
    expect(env.A).toBe('plain');
    expect(env.B).toBe('quoted # hash');
    expect(env.C).toBe('exported');
  });

  it('is silent when neither file exists', () => {
    const env: EnvLike = {};
    expect(() => loadDotEnv(tmpdir(), env)).not.toThrow();
    expect(env).toEqual({});
  });
});

describe('findUnwritable', () => {
  it('reports nothing for a writable content directory', () => {
    const dir = tmpdir();
    fs.mkdirSync(path.join(dir, 'journal'));
    expect(findUnwritable(dir)).toEqual([]);
  });

  /** The app creates these on first write; only one that exists and refuses
   *  writes is a fault. */
  it('does not report a directory that has not been created yet', () => {
    expect(findUnwritable(tmpdir())).toEqual([]);
  });

  it('reports the owner alongside a path it cannot write', () => {
    const dir = tmpdir();
    const backups = path.join(dir, '.backups');
    fs.mkdirSync(backups);
    fs.chmodSync(backups, 0o555);
    try {
      const found = findUnwritable(dir);
      // Running as root, 0555 is still writable — the case cannot be staged.
      if (currentUid() === 0) return;
      expect(found).toHaveLength(1);
      expect(found[0].label).toBe('content/.backups');
      expect(found[0].ownerUid).toBe(fs.statSync(backups).uid);
    } finally {
      fs.chmodSync(backups, 0o755);
    }
  });
});

/**
 * The CLI tests whoever typed the command; the panel tests the app's own user.
 * On a Docker deployment those differ, and calling that an error accused a
 * healthy install (#551).
 */
describe('reportWritable', () => {
  const mine = { label: 'content/.backups', ownerUid: 1000 };
  const theirs = { label: 'content/.backups', ownerUid: 1001 };

  it('passes when everything is writable', () => {
    const finding = reportWritable([], 1000);
    expect(finding.level).toBe('ok');
    expect(finding.note).toBeUndefined();
    expect(finding.title).toBe('content/ is writable');
  });

  it('is a real error when the CLI runs as the owner', () => {
    const finding = reportWritable([mine], 1000);
    expect(finding.level).toBe('error');
    expect(finding.note).toBeUndefined();
    expect(finding.detail).toContain('Saving from the admin panel will fail');
  });

  it('is a note, not an error, when the owner is someone else', () => {
    const finding = reportWritable([theirs], 1000);
    expect(finding.level).toBe('ok');
    expect(finding.note).toBe(true);
    expect(finding.title).toContain('uid 1000');
    expect(finding.title).toContain('uid 1001');
    expect(finding.detail).toContain('docker compose exec');
  });

  it('does not downgrade a mixed result to a note', () => {
    const finding = reportWritable([mine, theirs], 1000);
    expect(finding.level).toBe('ok');
    expect(finding.note).toBe(true);
  });

  it('claims nothing on a platform without uids', () => {
    const finding = reportWritable([theirs], null);
    expect(finding.level).toBe('ok');
    expect(finding.note).toBe(true);
    expect(finding.title).not.toContain('undefined');
    expect(finding.detail).toContain('may not be the account the app');
  });

  it('keeps the id the panel uses, whatever the outcome', () => {
    for (const finding of [
      reportWritable([], 1000),
      reportWritable([mine], 1000),
      reportWritable([theirs], 1000),
      reportWritable([theirs], null),
    ]) {
      expect(finding.id).toBe('content-writable');
    }
  });
});

describe('wrap', () => {
  it('breaks at word boundaries and indents every line', () => {
    expect(wrap('one two three four', 9, '  ')).toEqual(['  one two', '  three', '  four']);
  });

  it('leaves a token longer than the width intact', () => {
    expect(wrap('aaaaaaaaaaaa', 4, '')).toEqual(['aaaaaaaaaaaa']);
  });
});

describe('formatReport', () => {
  const findings: DoctorFinding[] = [
    { id: 'a', level: 'ok', title: 'Fine', detail: 'Nothing to do.' },
    { id: 'b', level: 'error', title: 'Broken', detail: 'Fix it.' },
    { id: 'c', level: 'warn', title: 'Odd', detail: 'Have a look.' },
  ];

  it('groups by level, worst first', () => {
    const report = formatReport(findings);
    expect(report.indexOf('ERRORS (1)')).toBeLessThan(report.indexOf('WARNINGS (1)'));
    expect(report.indexOf('WARNINGS (1)')).toBeLessThan(report.indexOf('PASSED (1)'));
  });

  it('ends with a count of each level', () => {
    expect(formatReport(findings)).toContain('1 error, 1 warning, 1 check passed.');
    expect(formatReport([])).toContain('0 errors, 0 warnings, 0 checks passed.');
  });

  it('omits a level nobody hit', () => {
    const report = formatReport([findings[0]]);
    expect(report).not.toContain('ERRORS');
    expect(report).not.toContain('WARNINGS');
  });

  it('emits no escape sequences unless colour is asked for', () => {
    const ansi = /\u001b\[/;
    expect(ansi.test(formatReport(findings))).toBe(false);
    expect(ansi.test(formatReport(findings, { color: true }))).toBe(true);
  });

  // The proxy-hop finding carries level `ok` so it cannot skew the exit code,
  // but the CLI never checked it — listing it under PASSED would claim a check
  // that did not run.
  describe('notes', () => {
    const proxy: CliFinding = {
      id: 'proxy-hops',
      level: 'ok',
      note: true,
      title: 'TRUSTED_PROXY_HOPS is 0 (unset) — not verifiable from the terminal',
      detail: 'Open the Diagnostics panel to have it measured.',
    };

    it('needs the flag, not the id: the same check can be a real finding', () => {
      const notANote = { ...proxy, note: undefined };
      const report = formatReport([notANote]);
      expect(report).not.toContain('NOTES');
      expect(report).toContain('PASSED (1)');
    });

    it('lists a note in its own group rather than under PASSED', () => {
      const report = formatReport([...findings, proxy]);
      expect(report).toContain('NOTES (1)');
      expect(report).toContain('PASSED (1)');
      expect(report).toContain(proxy.title);
      expect(report.indexOf(proxy.title)).toBeGreaterThan(report.indexOf('NOTES (1)'));
      expect(report.indexOf(proxy.title)).toBeLessThan(report.indexOf('PASSED (1)'));
    });

    it('sits between the warnings and the passes', () => {
      const report = formatReport([...findings, proxy]);
      expect(report.indexOf('WARNINGS (1)')).toBeLessThan(report.indexOf('NOTES (1)'));
      expect(report.indexOf('NOTES (1)')).toBeLessThan(report.indexOf('PASSED (1)'));
    });

    it('is counted separately, not as a passed check', () => {
      expect(formatReport([...findings, proxy])).toContain(
        '1 error, 1 warning, 1 check passed, 1 note.',
      );
    });

    it('says nothing about notes when there are none', () => {
      const report = formatReport(findings);
      expect(report).not.toContain('NOTES');
      expect(report).toContain('1 error, 1 warning, 1 check passed.');
    });
  });
});

describe('shouldUseColor', () => {
  it('follows the terminal by default', () => {
    expect(shouldUseColor({}, true)).toBe(true);
    expect(shouldUseColor({}, false)).toBe(false);
  });

  it('honours NO_COLOR above everything', () => {
    expect(shouldUseColor({ NO_COLOR: '1', FORCE_COLOR: '1' }, true)).toBe(false);
  });

  it('honours FORCE_COLOR when the output is piped', () => {
    expect(shouldUseColor({ FORCE_COLOR: '1' }, false)).toBe(true);
    expect(shouldUseColor({ FORCE_COLOR: '0' }, false)).toBe(false);
  });
});
