import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import { mkdtemp, mkdir, rename, rm, unlink, writeFile } from 'fs/promises';

/**
 * The journal and page listings run on every public render (the header nav
 * lists both) and used to parse every markdown file each time. They now keep
 * the parse per file while the file is unchanged — which must never cost an
 * admin save its immediate visibility.
 */
let root: string;
let journalDir: string;
let pagesDir: string;
let parseSpy: ReturnType<typeof vi.fn<(raw: string) => void>>;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'folio-parsecache-'));
  journalDir = path.join(root, 'content', 'journal');
  pagesDir = path.join(root, 'content', 'pages');
  await mkdir(journalDir, { recursive: true });
  await mkdir(pagesDir, { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.resetModules();
  parseSpy = vi.fn<(raw: string) => void>();
  vi.doMock('../journal', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../journal')>();
    return {
      ...actual,
      parseJournalMarkdown: (raw: string) => {
        parseSpy(raw);
        return actual.parseJournalMarkdown(raw);
      },
    };
  });
});

afterEach(async () => {
  vi.doUnmock('../journal');
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

const doc = (title: string) =>
  `---\ntitle: "${title}"\ndate: "2026-01-01"\n---\n\nBody of ${title}\n`;

describe('listJournalEntries', () => {
  it('parses an unchanged file once across listings', async () => {
    await writeFile(path.join(journalDir, 'a.md'), doc('Alpha'));
    await writeFile(path.join(journalDir, 'b.md'), doc('Bravo'));
    const service = await import('../admin/journal-service');

    const first = await service.listJournalEntries();
    const second = await service.listJournalEntries();

    expect(second).toEqual(first);
    expect(second.map((e) => e.frontmatter.title).sort()).toEqual(['Alpha', 'Bravo']);
    expect(parseSpy).toHaveBeenCalledTimes(2);
  });

  it('shows an admin save on the very next listing, even at the same size', async () => {
    await writeFile(path.join(journalDir, 'a.md'), doc('Alpha'));
    const service = await import('../admin/journal-service');
    expect((await service.listJournalEntries())[0].frontmatter.title).toBe('Alpha');

    // Same byte length, so only the inode (atomicWrite renames) tells them apart.
    await service.writeJournalEntry('a', doc('Omega'));

    expect((await service.listJournalEntries())[0].frontmatter.title).toBe('Omega');
  });

  it('sees an edit made in place and a file renamed over the entry', async () => {
    const file = path.join(journalDir, 'a.md');
    await writeFile(file, doc('Alpha'));
    const service = await import('../admin/journal-service');
    await service.listJournalEntries();

    await writeFile(file, doc('Alpha, revised'));
    expect((await service.listJournalEntries())[0].frontmatter.title).toBe('Alpha, revised');

    await writeFile(path.join(root, 'tmp.md'), doc('Gamma'));
    await rename(path.join(root, 'tmp.md'), file);
    expect((await service.listJournalEntries())[0].frontmatter.title).toBe('Gamma');
  });

  it('drops a deleted entry and hands out copies callers cannot poison', async () => {
    await writeFile(path.join(journalDir, 'a.md'), doc('Alpha'));
    await writeFile(path.join(journalDir, 'b.md'), doc('Bravo'));
    const service = await import('../admin/journal-service');

    const listed = await service.listJournalEntries();
    listed[0].frontmatter.title = 'mutated';
    listed[0].excerpt = 'mutated';
    expect((await service.listJournalEntries()).map((e) => e.frontmatter.title).sort()).toEqual([
      'Alpha',
      'Bravo',
    ]);

    await unlink(path.join(journalDir, 'b.md'));
    expect((await service.listJournalEntries()).map((e) => e.slug)).toEqual(['a']);
  });
});

describe('listPages', () => {
  it('parses an unchanged page once and sees a save at once', async () => {
    await writeFile(path.join(pagesDir, 'pricing.md'), doc('Pricing'));
    const service = await import('../admin/pages-service');

    await service.listPages();
    const again = await service.listPages();
    expect(again).toEqual([
      {
        slug: 'pricing',
        frontmatter: {
          title: 'Pricing',
          description: undefined,
          password: undefined,
          draft: undefined,
        },
      },
    ]);
    expect(parseSpy).toHaveBeenCalledTimes(1);

    await service.writePage('pricing', doc('Tariffs'));
    expect((await service.listPages())[0].frontmatter.title).toBe('Tariffs');
  });
});
