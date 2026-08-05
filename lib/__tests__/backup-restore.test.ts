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

  it('restores a normal backup', async () => {
    await expect(
      restoreBackup('gallery.yaml.2026-05-31T17-30-00-000Z.bak'),
    ).resolves.toBeUndefined();
    expect(fs.copyFile).toHaveBeenCalled();
  });

  it('restores a pre-restore backup', async () => {
    await expect(
      restoreBackup('settings.yaml.2026-05-31T17-30-00-000Z.pre-restore.bak'),
    ).resolves.toBeUndefined();
  });

  it('derives the destination from the matched name, not a substring search', async () => {
    await restoreBackup('settings.yaml.2026-05-31T17-30-00-000Z.bak');

    // Last copyFile is backup → target; the first is the pre-restore snapshot.
    const calls = vi.mocked(fs.copyFile).mock.calls;
    expect(String(calls[calls.length - 1][1])).toMatch(/content\/settings\.yaml$/);
  });
});
