import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(async () => undefined),
    access: vi.fn(async () => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    }),
    copyFile: vi.fn(async () => undefined),
    readdir: vi.fn(async () => []),
    unlink: vi.fn(async () => undefined),
    writeFile: vi.fn(async () => undefined),
    rename: vi.fn(async () => undefined),
    readFile: vi.fn(),
  },
}));

import fs from 'fs/promises';
import { writeGalleryYaml } from '@/lib/admin/yaml-service';

const gallery = { albums: ['11111111-1111-1111-1111-111111111111'] };

const tmpPaths = () => vi.mocked(fs.writeFile).mock.calls.map((c) => String(c[0]));

/**
 * The rename is what makes the write atomic; the temp filename is what did not
 * used to be. With a constant `gallery.yaml.tmp`, two saves in flight at once
 * shared it, so the second writeFile could interleave with the first's rename.
 */
describe('writeYamlFile temp file handling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('never writes to the bare .tmp path two callers would collide on', async () => {
    await writeGalleryYaml(gallery);
    expect(tmpPaths()[0]).not.toMatch(/gallery\.yaml\.tmp$/);
  });

  it('uses a distinct temp path for every write', async () => {
    await writeGalleryYaml(gallery);
    await writeGalleryYaml(gallery);
    await writeGalleryYaml(gallery);

    const paths = tmpPaths();
    expect(paths).toHaveLength(3);
    expect(new Set(paths).size).toBe(3);
  });

  it('renames the temp file it just wrote, not some other one', async () => {
    await writeGalleryYaml(gallery);

    const [written] = tmpPaths();
    const [from, to] = vi.mocked(fs.rename).mock.calls[0].map(String);
    expect(from).toBe(written);
    expect(to).toMatch(/content\/gallery\.yaml$/);
  });

  it('cleans up the temp file when the write fails', async () => {
    vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('ENOSPC'));

    await expect(writeGalleryYaml(gallery)).rejects.toThrow('ENOSPC');
    expect(String(vi.mocked(fs.unlink).mock.calls[0][0])).toBe(tmpPaths()[0]);
  });

  it('cleans up when the rename fails', async () => {
    vi.mocked(fs.rename).mockRejectedValueOnce(new Error('EXDEV'));

    await expect(writeGalleryYaml(gallery)).rejects.toThrow('EXDEV');
    expect(fs.unlink).toHaveBeenCalledOnce();
  });

  it('does not let a cleanup failure mask the real error', async () => {
    vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('ENOSPC'));
    vi.mocked(fs.unlink).mockRejectedValueOnce(new Error('EACCES'));

    await expect(writeGalleryYaml(gallery)).rejects.toThrow('ENOSPC');
  });

  it('does not unlink on the happy path', async () => {
    await writeGalleryYaml(gallery);
    expect(fs.unlink).not.toHaveBeenCalled();
  });
});
