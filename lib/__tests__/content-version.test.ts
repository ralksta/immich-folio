import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'fs/promises';
import {
  ABSENT_VERSION,
  VersionConflictError,
  assertVersion,
  baseVersionFrom,
  fileVersion,
  serializeContentWrite,
  versionOf,
} from '../admin/contentVersion';

/**
 * Concurrent-edit detection (#601): a save carrying the version its editor
 * loaded is refused when the file changed since; a save without one is
 * written as before.
 *
 * The services resolve content/ from process.cwd() at import time, so each
 * test points cwd at a fresh temp directory and re-imports them.
 */
let root: string;
let contentDir: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'folio-version-'));
  contentDir = path.join(root, 'content');
  await mkdir(path.join(contentDir, 'journal'), { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.resetModules();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

/** By name: the services are re-imported per test, so their error class is a different copy. */
const conflict = expect.objectContaining({ name: 'VersionConflictError' });

const put = (ifMatch?: string) =>
  new Request('http://localhost/x', {
    method: 'PUT',
    headers: ifMatch === undefined ? {} : { 'If-Match': ifMatch },
  });

describe('contentVersion helpers', () => {
  it('versions content by its bytes, and a missing file as absent', async () => {
    expect(versionOf('a')).toBe(versionOf(Buffer.from('a')));
    expect(versionOf('a')).not.toBe(versionOf('b'));
    expect(versionOf(null)).toBe(ABSENT_VERSION);
    await expect(fileVersion(path.join(root, 'nope'))).resolves.toBe(ABSENT_VERSION);
    await writeFile(path.join(root, 'f'), 'a');
    await expect(fileVersion(path.join(root, 'f'))).resolves.toBe(versionOf('a'));
  });

  it('reads If-Match in bare, quoted and weak form; * and absent mean no check', () => {
    expect(baseVersionFrom(put('abc'))).toBe('abc');
    expect(baseVersionFrom(put('"abc"'))).toBe('abc');
    expect(baseVersionFrom(put('W/"abc"'))).toBe('abc');
    expect(baseVersionFrom(put('*'))).toBeUndefined();
    expect(baseVersionFrom(put())).toBeUndefined();
  });

  it('assertVersion passes on a match or no base, and throws with the current version', async () => {
    const file = path.join(root, 'f');
    await writeFile(file, 'now');
    await expect(assertVersion(file, versionOf('now'))).resolves.toBeUndefined();
    await expect(assertVersion(file, undefined)).resolves.toBeUndefined();
    const err = await assertVersion(file, versionOf('before')).catch((e) => e);
    expect(err).toBeInstanceOf(VersionConflictError);
    expect(err.currentVersion).toBe(versionOf('now'));
  });

  it('runs queued writes one at a time, and a failure does not stall the queue', async () => {
    const order: string[] = [];
    const slow = serializeContentWrite(async () => {
      order.push('a:start');
      await new Promise((r) => setTimeout(r, 20));
      order.push('a:end');
    });
    const failing = serializeContentWrite(async () => {
      order.push('b');
      throw new Error('boom');
    });
    const after = serializeContentWrite(async () => order.push('c'));
    await Promise.allSettled([slow, failing, after]);
    await expect(failing).rejects.toThrow('boom');
    expect(order).toEqual(['a:start', 'a:end', 'b', 'c']);
  });
});

describe('yaml-service', () => {
  it('writes settings.yaml when the base version matches, and refuses when it does not', async () => {
    const service = await import('../admin/yaml-service');
    const settingsPath = path.join(contentDir, 'settings.yaml');
    await writeFile(settingsPath, 'title: One\n');

    const loaded = await service.readSettingsYamlVersioned();
    expect(loaded.data).toEqual({ title: 'One' });

    // Another tab saves first.
    const second = await service.writeSettingsYaml({ title: 'Two' }, loaded.version);
    expect(second).toBe(versionOf(await readFile(settingsPath)));

    // This tab still holds the first version.
    await expect(service.writeSettingsYaml({ title: 'Three' }, loaded.version)).rejects.toEqual(
      expect.objectContaining({ name: 'VersionConflictError', currentVersion: second }),
    );
    expect(await service.readSettingsYaml()).toEqual({ title: 'Two' });
  });

  it('still writes without a base version (older clients)', async () => {
    const service = await import('../admin/yaml-service');
    await writeFile(path.join(contentDir, 'gallery.yaml'), 'hero: []\n');
    await service.writeGalleryYaml({ hero: ['x'] } as never);
    expect(await service.readGalleryYaml()).toEqual({ hero: ['x'] });
  });

  it('treats a file created since an absent load as a conflict', async () => {
    const service = await import('../admin/yaml-service');
    const loaded = await service.readGalleryYamlVersioned();
    expect(loaded.version).toBe(ABSENT_VERSION);
    await writeFile(path.join(contentDir, 'gallery.yaml'), 'hero: []\n');
    await expect(service.writeGalleryYaml({ hero: [] } as never, loaded.version)).rejects.toEqual(
      conflict,
    );
  });
});

const md = (title: string) => `---\ntitle: "${title}"\n---\n\nBody of ${title}\n`;

describe('journal-service saveJournalEntry', () => {
  it('saves on a matching version and refuses a stale one', async () => {
    const service = await import('../admin/journal-service');
    const file = path.join(contentDir, 'journal', 'trip.md');
    await writeFile(file, md('One'));
    const base = versionOf(md('One'));

    await expect(service.saveJournalEntry('trip', md('Two'), { baseVersion: base })).resolves.toBe(
      versionOf(md('Two')),
    );
    await expect(
      service.saveJournalEntry('trip', md('Three'), { baseVersion: base }),
    ).rejects.toEqual(conflict);
    await expect(readFile(file, 'utf8')).resolves.toBe(md('Two'));
    // No base: written as before.
    await service.saveJournalEntry('trip', md('Four'));
    await expect(readFile(file, 'utf8')).resolves.toBe(md('Four'));
  });

  it('checks a rename against the source entry and leaves both files alone on conflict', async () => {
    const service = await import('../admin/journal-service');
    const dir = path.join(contentDir, 'journal');
    await writeFile(path.join(dir, 'old.md'), md('Changed elsewhere'));

    const err = await service
      .saveJournalEntry('new', md('Mine'), {
        baseVersion: versionOf(md('Loaded')),
        fromSlug: 'old',
      })
      .catch((e) => e);
    expect(err).toEqual(conflict);
    expect((await readdir(dir)).filter((f) => f.endsWith('.md'))).toEqual(['old.md']);

    await service.saveJournalEntry('new', md('Mine'), {
      baseVersion: versionOf(md('Changed elsewhere')),
      fromSlug: 'old',
    });
    expect((await readdir(dir)).filter((f) => f.endsWith('.md'))).toEqual(['new.md']);
  });
});

describe('pages-service savePage', () => {
  it('saves on a matching version, refuses a stale one, and renames', async () => {
    const service = await import('../admin/pages-service');
    const dir = path.join(contentDir, 'pages');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'faq.md'), md('FAQ'));

    await expect(
      service.savePage('faq', md('Stale'), { baseVersion: versionOf(md('Other')) }),
    ).rejects.toEqual(conflict);
    await expect(readFile(path.join(dir, 'faq.md'), 'utf8')).resolves.toBe(md('FAQ'));

    await service.savePage('help', md('Help'), {
      baseVersion: versionOf(md('FAQ')),
      fromSlug: 'faq',
    });
    expect((await readdir(dir)).filter((f) => f.endsWith('.md'))).toEqual(['help.md']);
  });
});
