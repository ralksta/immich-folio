import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'essay-source-'));

vi.mock('@/lib/config', () => ({
  getConfig: () => ({
    authSecret: 'test-auth-secret-32-chars-long-min',
    subpages: [],
    albumPasswords: {},
  }),
}));

// Journal files come from a temp dir instead of content/journal/. Both the
// loader and lib/auth's password lookup go through this module, so the gate
// under test reads the same file the essay does.
vi.mock('@/lib/admin/journal-service', async () => {
  const { parseJournalMarkdown } = await import('@/lib/journal');
  const file = (slug: string) => path.join(dir, `${slug}.md`);
  return {
    resolveJournalFilePath: (slug: string) => file(slug),
    loadEssayFromFile: (slug: string) =>
      fs.existsSync(file(slug)) ? parseJournalMarkdown(fs.readFileSync(file(slug), 'utf8')) : null,
  };
});

import { resolveEssayFile, generatedEssayCaption } from '@/lib/essaySource';
import { authenticate } from '@/lib/auth';
import type { ImmichAsset } from '@/lib/immich';

const write = (slug: string, frontmatter: string) =>
  fs.writeFileSync(path.join(dir, `${slug}.md`), `---\n${frontmatter}\n---\n\nBody text.\n`);

const anonymous = { isAdmin: false, getCookie: () => undefined };

beforeAll(() => {
  write('open', 'title: "Open"');
  write('draft', 'title: "Draft"\ndraft: true');
  write('locked', 'title: "Locked"\npassword: "letmein"');
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('resolveEssayFile', () => {
  it('returns a public entry', () => {
    const result = resolveEssayFile('open', anonymous);
    expect(result.status).toBe('open');
  });

  it('treats a missing entry as missing', () => {
    expect(resolveEssayFile('nope', anonymous)).toEqual({ status: 'missing' });
  });

  it('hides a draft from visitors', () => {
    expect(resolveEssayFile('draft', anonymous)).toEqual({ status: 'missing' });
  });

  it('shows a draft to the admin', () => {
    expect(resolveEssayFile('draft', { ...anonymous, isAdmin: true }).status).toBe('open');
  });

  it('locks a password-protected entry without a cookie', () => {
    expect(resolveEssayFile('locked', anonymous)).toEqual({ status: 'locked', title: 'Locked' });
  });

  it('keeps the entry locked for the admin, like /journal/<slug> does', () => {
    expect(resolveEssayFile('locked', { ...anonymous, isAdmin: true }).status).toBe('locked');
  });

  it('opens a protected entry with the journal cookie', async () => {
    const setCookie = await authenticate('locked', 'letmein', 'journal');
    expect(setCookie).not.toBeNull();
    const [pair] = setCookie!.split(';');
    const [name, value] = pair.split('=');
    const result = resolveEssayFile('locked', {
      isAdmin: false,
      getCookie: (n) => (n === name ? value : undefined),
    });
    expect(result.status).toBe('open');
  });
});

describe('generatedEssayCaption', () => {
  const asset = (description?: string) =>
    ({ exifInfo: { description } }) as Pick<ImmichAsset, 'exifInfo'>;

  it('escapes markup in an Immich description', () => {
    expect(generatedEssayCaption(asset('<b>hi</b> & "you"'), true)).toBe(
      '&lt;b&gt;hi&lt;/b&gt; &amp; &quot;you&quot;',
    );
  });

  it('follows the exif.caption toggle', () => {
    expect(generatedEssayCaption(asset('A caption'), false)).toBeUndefined();
  });

  it('leaves no caption for an empty description', () => {
    expect(generatedEssayCaption(asset('   '), true)).toBeUndefined();
  });
});
