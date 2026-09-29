import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Mock env.ts so importing config.ts doesn't trigger Zod validation
vi.mock('@/lib/env', () => ({
  env: {
    IMMICH_API_URL: 'http://localhost:2283',
    IMMICH_API_KEY: 'test-key',
    SITE_TITLE: 'Test Gallery',
    SITE_SUBTITLE: '',
    CACHE_TTL: 300,
    RATE_LIMIT_RPM: 120,
  },
  normalizeApiUrl: (raw: string) => raw.replace(/\/+$/, ''),
}));

vi.mock('@/lib/secret', () => ({
  resolveAuthSecret: () => 'test-auth-secret-32-chars-long-min',
}));

// The real YAML layer, spied on: how often it is asked is how often the
// config is derived.
vi.mock('@/lib/config/parser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config/parser')>();
  return { ...actual, loadYaml: vi.fn(actual.loadYaml) };
});

import { getConfig, invalidateConfigCache } from '@/lib/config';
import { loadYaml } from '@/lib/config/parser';

const ALBUM_ID = '11111111-1111-1111-1111-111111111111';

let dir: string;
let mtime = Date.now() / 1000;

/** Write a content file with a distinct mtime, the way a save from another worker lands. */
function write(name: string, body: string) {
  const file = path.join(dir, 'content', name);
  fs.writeFileSync(file, body);
  mtime += 10;
  fs.utimesSync(file, mtime, mtime);
}

describe('getConfig() in production', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-config-cache-'));
    fs.mkdirSync(path.join(dir, 'content'));
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    write('gallery.yaml', `albums:\n  - "${ALBUM_ID}"\n`);
    write('settings.yaml', 'title: Old Title\n');
    invalidateConfigCache();
    vi.mocked(loadYaml).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('picks up settings.yaml changes without invalidateConfigCache()', () => {
    // An admin save may run in a different worker/process than page
    // rendering, so this worker never sees invalidateConfigCache().
    // getConfig() must notice the file changed instead of short-circuiting
    // on a stale in-memory copy.
    expect(getConfig().siteTitle).toBe('Old Title');

    write('settings.yaml', 'title: New Title\n');
    expect(getConfig().siteTitle).toBe('New Title');
  });

  it('picks up gallery.yaml changes without invalidateConfigCache()', () => {
    expect(getConfig().albums).toEqual([ALBUM_ID]);

    const other = '22222222-2222-2222-2222-222222222222';
    write('gallery.yaml', `albums:\n  - "${ALBUM_ID}"\n  - "${other}"\n`);
    expect(getConfig().albums).toEqual([ALBUM_ID, other]);
  });

  it('notices about.md appearing', () => {
    expect(getConfig().aboutEnabled).toBe(false);

    write('about.md', '---\nname: Someone\n---\n');
    expect(getConfig().aboutEnabled).toBe(true);
  });

  it('notices install.json credentials appearing', () => {
    // env supplies the URL; the file is still watched.
    write('install.json', JSON.stringify({ apiUrl: 'http://file:2283', apiKey: 'file-key' }));
    getConfig();
    expect(vi.mocked(loadYaml)).toHaveBeenCalledTimes(2);

    write('install.json', JSON.stringify({ apiUrl: 'http://file:2283', apiKey: 'other' }));
    getConfig();
    expect(vi.mocked(loadYaml)).toHaveBeenCalledTimes(4);
  });

  // Every image request and every page render call getConfig() many times
  // over. Deriving the whole config each time cost ~150µs a call; the files
  // did not change in between.
  it('derives the config once while its files are unchanged', () => {
    for (let i = 0; i < 100; i++) getConfig();

    // gallery.yaml and settings.yaml, once — not 200 reads.
    expect(vi.mocked(loadYaml)).toHaveBeenCalledTimes(2);
  });

  it('derives again after invalidateConfigCache()', () => {
    getConfig();
    invalidateConfigCache();
    getConfig();

    expect(vi.mocked(loadYaml)).toHaveBeenCalledTimes(4);
  });

  it('hands every caller its own copy', () => {
    const first = getConfig();
    first.albums.push('mutated');
    first.siteTitle = 'mutated';

    const second = getConfig();
    expect(second.albums).toEqual([ALBUM_ID]);
    expect(second.siteTitle).toBe('Old Title');
  });
});
