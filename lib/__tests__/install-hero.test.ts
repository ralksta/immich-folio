import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';

// A getter, not a value: the mock factory runs once, but each test installs
// into a fresh temp directory.
vi.mock('@/lib/env', () => ({
  env: {
    get INSTALL_CONTENT_DIR() {
      return process.env.INSTALL_CONTENT_DIR;
    },
  },
}));

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-install-'));
  process.env.INSTALL_CONTENT_DIR = dir;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.INSTALL_CONTENT_DIR;
});

async function install(input: Record<string, unknown>) {
  const { completeInstall } = await import('@/lib/install');
  await completeInstall({
    apiUrl: 'http://immich.test',
    apiKey: 'key',
    theme: 'studio-modern',
    ...input,
  } as Parameters<typeof completeInstall>[0]);
  return yaml.load(fs.readFileSync(path.join(dir, 'gallery.yaml'), 'utf8')) as {
    hero: string[];
    albums: string[];
  };
}

/**
 * The wizard always wrote `hero: []`, so the first thing a finished portfolio
 * showed was a list of album names and no photograph (#518).
 */
describe('completeInstall', () => {
  it('writes the seeded hero assets', async () => {
    const gallery = await install({
      albums: ['11111111-1111-1111-1111-111111111111'],
      hero: ['22222222-2222-2222-2222-222222222222'],
    });

    expect(gallery.hero).toEqual(['22222222-2222-2222-2222-222222222222']);
    expect(gallery.albums).toEqual(['11111111-1111-1111-1111-111111111111']);
  });

  /** Seeding is a nicety; an install without it is still a valid install. */
  it('writes an empty hero when none could be found', async () => {
    const gallery = await install({ albums: [], hero: [] });

    expect(gallery.hero).toEqual([]);
  });

  it('tolerates the field being omitted entirely', async () => {
    const gallery = await install({ albums: [] });

    expect(gallery.hero).toEqual([]);
  });
});
