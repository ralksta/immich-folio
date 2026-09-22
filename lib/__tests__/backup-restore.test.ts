import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => ({
  default: {
    copyFile: vi.fn(async () => undefined),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rename: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    readdir: vi.fn(async () => []),
    unlink: vi.fn(),
  },
}));

import fs from 'fs/promises';
import { restoreBackup } from '@/lib/admin/yaml-service';

/**
 * restoreBackup joins its argument into a path and copies the result over a
 * content file, whose contents the admin GET endpoints then return. Before this
 * guard, `path.join` resolved `..` segments, so any readable file on the host
 * could be written over content/settings.yaml and read back.
 *
 * The function has no callers yet — this pins the guard for whoever wires up the
 * restore button the admin panel does not have.
 */
describe('restoreBackup rejects anything that is not a backup it produced', () => {
  beforeEach(() => vi.clearAllMocks());

  const rejected = [
    '../../../../etc/passwd',
    '../gallery.yaml',
    '.backups/../../gallery.yaml',
    '/etc/passwd',
    'gallery.yaml', // the live file, not a backup
    'gallery.yaml.2026-05-31T17-30-00-000Z.bak.txt',
    'evil-gallery.yaml.2026-05-31T17-30-00-000Z.bak',
    'about.yaml.2026-05-31T17-30-00-000Z.bak',
    'trip.md.2026-05-31T17-30-00-000Z.bak', // journal backups go through the journal service
    '',
  ];

  for (const name of rejected) {
    it(`refuses ${JSON.stringify(name)}`, async () => {
      await expect(restoreBackup(name)).rejects.toThrow(/unrecognised backup name/i);
      expect(fs.copyFile).not.toHaveBeenCalled();
    });
  }

  // A traversal that still ended in a plausible-looking name would have picked
  // the destination too, via the old includes('gallery.yaml') check.
  it('refuses a traversal that embeds a valid-looking name', async () => {
    await expect(restoreBackup('../../gallery.yaml.2026-01-01T00-00-00-000Z.bak')).rejects.toThrow(
      /unrecognised backup name/i,
    );
    expect(fs.copyFile).not.toHaveBeenCalled();
  });
});

describe('restoreBackup accepts the names it writes', () => {
  beforeEach(() => vi.clearAllMocks());

  // The restore itself goes through atomicWrite (writeFile the temp file,
  // then rename it onto the target) rather than fs.copyFile, so a failure
  // partway through cannot truncate the live file (#630). fs.copyFile is
  // still used, but only for the pre-restore safety snapshot.
  it('restores a normal backup', async () => {
    await expect(
      restoreBackup('gallery.yaml.2026-05-31T17-30-00-000Z.bak'),
    ).resolves.toBeUndefined();
    expect(fs.copyFile).toHaveBeenCalled(); // pre-restore snapshot
    expect(fs.rename).toHaveBeenCalled(); // atomic restore write
  });

  it('restores an about.md backup onto content/about.md', async () => {
    await restoreBackup('about.md.2026-05-31T17-30-00-000Z.bak');

    const calls = vi.mocked(fs.rename).mock.calls;
    expect(String(calls[calls.length - 1][1])).toMatch(/content\/about\.md$/);
  });

  it('restores a pre-restore backup', async () => {
    await expect(
      restoreBackup('settings.yaml.2026-05-31T17-30-00-000Z.pre-restore.bak'),
    ).resolves.toBeUndefined();
  });

  it('derives the destination from the matched name, not a substring search', async () => {
    await restoreBackup('settings.yaml.2026-05-31T17-30-00-000Z.bak');

    const calls = vi.mocked(fs.rename).mock.calls;
    expect(String(calls[calls.length - 1][1])).toMatch(/content\/settings\.yaml$/);
  });

  it('reads the backup before touching the pre-restore snapshot or the live file', async () => {
    await restoreBackup('gallery.yaml.2026-05-31T17-30-00-000Z.bak');

    const readOrder = vi.mocked(fs.readFile).mock.invocationCallOrder[0];
    const copyOrder = vi.mocked(fs.copyFile).mock.invocationCallOrder[0];
    expect(readOrder).toBeLessThan(copyOrder);
  });

  it('aborts without touching the live file when the safety snapshot fails for a reason other than ENOENT', async () => {
    vi.mocked(fs.copyFile).mockRejectedValueOnce(
      Object.assign(new Error('EACCES'), { code: 'EACCES' }),
    );

    await expect(restoreBackup('gallery.yaml.2026-05-31T17-30-00-000Z.bak')).rejects.toThrow(
      'EACCES',
    );
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(fs.rename).not.toHaveBeenCalled();
  });

  it('proceeds when the safety snapshot fails only because there is no current file yet', async () => {
    vi.mocked(fs.copyFile).mockRejectedValueOnce(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    );

    await expect(
      restoreBackup('gallery.yaml.2026-05-31T17-30-00-000Z.bak'),
    ).resolves.toBeUndefined();
    expect(fs.rename).toHaveBeenCalled();
  });
});
