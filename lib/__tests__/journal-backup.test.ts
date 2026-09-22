import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'fs/promises';

/**
 * Deleting a journal entry used to be a bare unlink, while saving rotated a
 * backup — the one irreversible action was the one without a way back, and the
 * Backup Manager could not restore journal backups at all.
 *
 * The service resolves content/ from process.cwd() at import time, so each test
 * points cwd at a fresh temp directory and re-imports it.
 */
let root: string;
let journalDir: string;
let backupDir: string;
let service: typeof import('../admin/journal-service');

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'folio-journal-'));
  journalDir = path.join(root, 'content', 'journal');
  backupDir = path.join(journalDir, '.backups');
  await mkdir(journalDir, { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.resetModules();
  service = await import('../admin/journal-service');
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

const entry = (title: string) => `---\ntitle: "${title}"\n---\n\nBody of ${title}\n`;

describe('deleteJournalEntry', () => {
  it('keeps a .deleted.bak copy before removing the file', async () => {
    await writeFile(path.join(journalDir, 'trip.md'), entry('Trip'));

    await expect(service.deleteJournalEntry('trip')).resolves.toBe(true);

    await expect(readdir(journalDir)).resolves.not.toContain('trip.md');
    const backups = await readdir(backupDir);
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^trip\.md\.[\w-]+\.deleted\.bak$/);
    await expect(readFile(path.join(backupDir, backups[0]), 'utf8')).resolves.toBe(entry('Trip'));
  });

  it('returns false for a missing entry without writing a backup', async () => {
    await expect(service.deleteJournalEntry('nope')).resolves.toBe(false);
    await expect(readdir(backupDir)).rejects.toThrow();
  });

  it('refuses to delete when the backup cannot be written', async () => {
    await writeFile(path.join(journalDir, 'trip.md'), entry('Trip'));
    // A file where the backup directory should be makes mkdir and copy fail.
    await writeFile(backupDir, 'not a directory');

    await expect(service.deleteJournalEntry('trip')).rejects.toThrow();
    await expect(readdir(journalDir)).resolves.toContain('trip.md');
  });
});

describe('writeJournalEntry backup failure (#630)', () => {
  it('still saves a brand-new entry with no backup', async () => {
    await expect(service.writeJournalEntry('trip', entry('New'))).resolves.toBeUndefined();
    await expect(readdir(backupDir).catch(() => [])).resolves.toEqual([]);
  });

  it('aborts the save when the entry exists but the backup cannot be written', async () => {
    await writeFile(path.join(journalDir, 'trip.md'), entry('Old'));
    // A file where the backup directory should be makes mkdir and copy fail.
    await writeFile(backupDir, 'not a directory');

    await expect(service.writeJournalEntry('trip', entry('New'))).rejects.toThrow();
    await expect(readFile(path.join(journalDir, 'trip.md'), 'utf8')).resolves.toBe(entry('Old'));
  });
});

describe('restoreJournalBackup', () => {
  it('brings a deleted entry back under its slug', async () => {
    await writeFile(path.join(journalDir, 'trip.md'), entry('Trip'));
    await service.deleteJournalEntry('trip');
    const [deleted] = await service.listJournalBackups();
    expect(deleted).toMatchObject({ slug: 'trip', kind: 'deleted' });

    await expect(service.restoreJournalBackup(deleted.filename)).resolves.toBe('trip');

    await expect(readFile(path.join(journalDir, 'trip.md'), 'utf8')).resolves.toBe(entry('Trip'));
  });

  it('snapshots the current version before overwriting it', async () => {
    await writeFile(path.join(journalDir, 'trip.md'), entry('Old'));
    await service.writeJournalEntry('trip', entry('New'));
    const [saved] = await service.listJournalBackups();

    await service.restoreJournalBackup(saved.filename);

    await expect(readFile(path.join(journalDir, 'trip.md'), 'utf8')).resolves.toBe(entry('Old'));
    const kinds = (await service.listJournalBackups()).map((b) => b.kind).sort();
    expect(kinds).toEqual(['pre-restore', 'save']);
  });

  const rejected = [
    '../../../../etc/passwd',
    'trip.md',
    '../trip.md.2026-05-31T17-30-00-000Z.bak',
    'a/trip.md.2026-05-31T17-30-00-000Z.bak',
    'trip.md.2026-05-31T17-30-00-000Z.bak.txt',
    'gallery.yaml.2026-05-31T17-30-00-000Z.bak',
    '',
  ];

  for (const name of rejected) {
    it(`refuses ${JSON.stringify(name)}`, async () => {
      await expect(service.restoreJournalBackup(name)).rejects.toThrow(/unrecognised backup name/i);
    });
  }
});

describe('backup rotation', () => {
  // Backup names carry a millisecond timestamp; saves in a tight loop would
  // share one and overwrite each other, which a person clicking Save cannot.
  let clock = Date.parse('2026-09-01T00:00:00Z');
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());
  const save = async (slug: string, body: string) => {
    vi.setSystemTime((clock += 1000));
    await service.writeJournalEntry(slug, body);
  };

  it('prunes save backups but never the deleted snapshot', async () => {
    await writeFile(path.join(journalDir, 'trip.md'), entry('Gone'));
    await service.deleteJournalEntry('trip');

    // Re-create the slug and save it well past the rotation limit.
    await save('trip', entry('v0'));
    for (let i = 1; i <= 12; i++) {
      await save('trip', entry(`v${i}`));
    }

    const backups = await service.listJournalBackups();
    expect(backups.filter((b) => b.kind === 'save')).toHaveLength(10);
    expect(backups.filter((b) => b.kind === 'deleted')).toHaveLength(1);
  });

  it('does not prune another entry whose slug shares a prefix', async () => {
    await save('trip-2', entry('Other v0'));
    await save('trip-2', entry('Other v1'));

    await save('trip', entry('v0'));
    for (let i = 1; i <= 12; i++) {
      await save('trip', entry(`v${i}`));
    }

    const other = (await service.listJournalBackups()).filter((b) => b.slug === 'trip-2');
    expect(other).toEqual([expect.objectContaining({ kind: 'save' })]);
  });
});
