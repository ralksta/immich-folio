import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

/**
 * listJournalEntries sorted by date only, so two entries from the same day kept
 * whatever order readdir returned — the /journal index and the entry page's
 * prev/next links then depended on the filesystem. The slug breaks the tie.
 */
let root: string;
let journalDir: string;
let service: typeof import('../admin/journal-service');

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'folio-journal-order-'));
  journalDir = path.join(root, 'content', 'journal');
  await fs.mkdir(journalDir, { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  vi.resetModules();
  service = await import('../admin/journal-service');
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

const entry = (title: string, date?: string) =>
  `---\ntitle: "${title}"\n${date ? `date: "${date}"\n` : ''}---\n\nBody\n`;

/** Make readdir hand the files back in a fixed order. */
function readdirOrder(order: 'asc' | 'desc') {
  const real = fs.readdir.bind(fs) as (dir: string) => Promise<string[]>;
  vi.spyOn(fs, 'readdir').mockImplementation((async (dir: string) => {
    const names = [...(await real(dir))].sort();
    return order === 'asc' ? names : names.reverse();
  }) as unknown as typeof fs.readdir);
}

describe('listJournalEntries order', () => {
  it.each(['asc', 'desc'] as const)(
    'orders same-day entries by slug whatever readdir returns (%s)',
    async (order) => {
      await fs.writeFile(path.join(journalDir, 'alpha.md'), entry('Zebra', '2026-03-15'));
      await fs.writeFile(path.join(journalDir, 'beta.md'), entry('Aardvark', '2026-03-15'));
      await fs.writeFile(path.join(journalDir, 'newer.md'), entry('Newer', '2026-04-01'));
      readdirOrder(order);

      const slugs = (await service.listJournalEntries()).map((e) => e.slug);
      expect(slugs).toEqual(['newer', 'alpha', 'beta']);
    },
  );

  it.each(['asc', 'desc'] as const)(
    'orders undated entries with the same title by slug (%s)',
    async (order) => {
      await fs.writeFile(path.join(journalDir, 'one.md'), entry('Untitled'));
      await fs.writeFile(path.join(journalDir, 'two.md'), entry('Untitled'));
      readdirOrder(order);

      const slugs = (await service.listJournalEntries()).map((e) => e.slug);
      expect(slugs).toEqual(['one', 'two']);
    },
  );
});
