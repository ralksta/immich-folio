import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import { mkdtemp, readdir, readFile, rm, writeFile, mkdir, stat } from 'fs/promises';
import { atomicWrite } from '../atomicWrite';

/**
 * This is the primitive every piece of user-supplied content is written
 * through — gallery.yaml, settings.yaml, journal entries, about.md, the
 * favicon. It existed as six hand-written copies that had already drifted in
 * their temp-file naming and their encoding, so it is worth pinning properly.
 */
let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'folio-atomic-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const leftovers = async () => (await readdir(root)).filter((f) => f.endsWith('.tmp'));

describe('atomicWrite', () => {
  it('writes a new file and leaves no temp file behind', async () => {
    const target = path.join(root, 'settings.yaml');

    await atomicWrite(target, 'title: Folio\n');

    expect(await readFile(target, 'utf8')).toBe('title: Folio\n');
    expect(await leftovers()).toEqual([]);
  });

  it('replaces an existing file', async () => {
    const target = path.join(root, 'gallery.yaml');
    await writeFile(target, 'old');

    await atomicWrite(target, 'new');

    expect(await readFile(target, 'utf8')).toBe('new');
  });

  it('writes a Buffer verbatim', async () => {
    const target = path.join(root, 'favicon.ico');
    // A byte that is not valid UTF-8, so an accidental string conversion shows.
    const bytes = Buffer.from([0x00, 0x01, 0xff, 0xfe]);

    await atomicWrite(target, bytes);

    expect(Buffer.compare(await readFile(target), bytes)).toBe(0);
  });

  it('round-trips non-ASCII content as utf8', async () => {
    const target = path.join(root, 'about.md');
    const content = '# Über mich\n\nFotografie aus Brandenburg — 日本語 too.\n';

    await atomicWrite(target, content);

    expect(await readFile(target, 'utf8')).toBe(content);
  });

  it('gives concurrent writes to the same path distinct temp files', async () => {
    const target = path.join(root, 'contended.yaml');

    // The failure this guards against is a shared temp name: one writer's
    // bytes published under the other's, or a truncated mix of both.
    await Promise.all(Array.from({ length: 25 }, (_, i) => atomicWrite(target, `writer-${i}\n`)));

    const survivor = await readFile(target, 'utf8');
    expect(survivor).toMatch(/^writer-\d+\n$/);
    expect(await leftovers()).toEqual([]);
  });

  it('cleans up the temp file and rethrows when the write cannot land', async () => {
    // A directory at the target path makes rename fail after the temp file was
    // written successfully — the exact window the cleanup exists for.
    const target = path.join(root, 'occupied');
    await mkdir(target);

    await expect(atomicWrite(target, 'content')).rejects.toThrow();
    expect(await leftovers()).toEqual([]);
  });

  it('rejects when the directory does not exist, without creating it', async () => {
    const target = path.join(root, 'missing-dir', 'file.yaml');

    await expect(atomicWrite(target, 'content')).rejects.toThrow();
    expect(await readdir(root)).toEqual([]);
  });

  /**
   * A secret file (install.json's API key and auth secret) used to be
   * written with the default mode and `chmod`ed to 0600 afterwards — briefly
   * world-readable between the two. `mode` applies to the temp file before
   * the rename, so the file is never created with the wrong permissions at
   * all (GHSA-w293-x8pc-j4cv). Skipped on Windows, where POSIX mode bits do
   * not apply.
   */
  const describeMode = process.platform === 'win32' ? describe.skip : describe;
  describeMode('mode option', () => {
    it('creates a new file with the given mode', async () => {
      const target = path.join(root, 'install.json');

      await atomicWrite(target, '{}', { mode: 0o600 });

      const mode = (await stat(target)).mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it('defaults to the process umask when no mode is given', async () => {
      const target = path.join(root, 'gallery.yaml');

      await atomicWrite(target, 'albums: []\n');

      const mode = (await stat(target)).mode & 0o777;
      expect(mode & 0o600).toBe(0o600); // owner read/write, at minimum
    });
  });
});
