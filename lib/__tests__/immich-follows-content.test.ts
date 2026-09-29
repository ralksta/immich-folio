import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Public pages follow admin saves (A-2) and the page builder's album order
 * (A-6).
 *
 * An admin save lands in another module instance (Next bundles each route
 * separately), so its immich.invalidateAll() never reached the cache the
 * pages read. The album list was cached with the allowlist and the
 * gallery.yaml titles and descriptions already applied, and the public site
 * kept serving the old ones for up to CACHE_TTL. These tests use the real
 * getConfig() on a temp content directory: the only signal a save leaves is
 * the new mtime of gallery.yaml.
 */

vi.mock('@/lib/env', () => ({
  env: {
    IMMICH_API_URL: 'http://immich.test',
    IMMICH_API_KEY: 'test-key',
    SITE_TITLE: 'Test Gallery',
    SITE_SUBTITLE: '',
    CACHE_TTL: 300,
    STALE_MAX_AGE: 86_400,
    IMMICH_TIMEOUT_MS: 15_000,
    RATE_LIMIT_RPM: 120,
  },
  normalizeApiUrl: (raw: string) => raw.replace(/\/+$/, ''),
}));

vi.mock('@/lib/secret', () => ({
  resolveAuthSecret: () => 'test-auth-secret-32-chars-long-min',
}));

import { invalidateConfigCache } from '@/lib/config';
import { cache } from '@/lib/cache';
import { immich } from '@/lib/immich';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const NEW = '44444444-4444-4444-8444-444444444444';

let dir: string;
let mtime = Date.now() / 1000;
let immichAlbums: { id: string; albumName: string; description: string; assetCount: number }[];
const fetchMock = vi.fn();

/** Write a content file with a distinct mtime, the way a save from another instance lands. */
function write(name: string, body: string) {
  const file = path.join(dir, 'content', name);
  fs.writeFileSync(file, body);
  mtime += 10;
  fs.utimesSync(file, mtime, mtime);
}

const json = (body: unknown) => ({
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
  json: async () => body,
});

const listRequests = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/albums?shared=true')).length;

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-immich-follows-'));
  fs.mkdirSync(path.join(dir, 'content'));
  vi.spyOn(process, 'cwd').mockReturnValue(dir);
  write('settings.yaml', 'title: Test\n');
  invalidateConfigCache();
  cache.clear();
  immichAlbums = [
    // Immich answers in its own order (last updated first, say).
    { id: C, albumName: 'Gamma', description: 'from Immich', assetCount: 3 },
    { id: A, albumName: 'Alpha', description: '', assetCount: 1 },
    { id: B, albumName: 'Beta', description: '', assetCount: 2 },
  ];
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).endsWith('/albums?shared=true')) return json(immichAlbums);
    return { ok: false, status: 404, headers: { get: () => 'application/json' } };
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('public album data follows a gallery.yaml save (A-2)', () => {
  it('shows a new title and description on the next call, without asking Immich again', async () => {
    write('gallery.yaml', `albums:\n  - "${A}"\n  - "${B}"\n`);
    const before = await immich.getAlbums();
    expect(before.map((a) => a.albumName)).toEqual(['Alpha', 'Beta']);
    expect(listRequests()).toBe(1);

    // The admin saves in another module instance: no invalidation reaches us.
    write(
      'gallery.yaml',
      `albums:\n  - "${A}":\n      title: "Alpha, renamed"\n      description: "Now described"\n  - "${B}"\n`,
    );

    const after = await immich.getAlbums();
    const alpha = after.find((a) => a.id === A)!;
    expect(alpha.albumName).toBe('Alpha, renamed');
    expect(alpha.description).toBe('Now described');
    expect(alpha.slug).toBe('alpha-renamed');
    expect(listRequests()).toBe(1);
  });

  it('drops an unpublished album and adds a newly published one at once', async () => {
    write('gallery.yaml', `albums:\n  - "${A}"\n  - "${B}"\n`);
    expect((await immich.getAlbums()).map((a) => a.id)).toEqual([A, B]);

    write('gallery.yaml', `albums:\n  - "${B}"\n  - "${C}"\n`);
    expect((await immich.getAlbums()).map((a) => a.id).sort()).toEqual([B, C].sort());
    expect(listRequests()).toBe(1);
  });

  it('refetches the list once for an album created in Immich after it was cached', async () => {
    write('gallery.yaml', `albums:\n  - "${A}"\n`);
    await immich.getAlbums();

    immichAlbums = [
      ...immichAlbums,
      { id: NEW, albumName: 'Fresh', description: '', assetCount: 1 },
    ];
    write('gallery.yaml', `albums:\n  - "${A}"\n  - "${NEW}"\n`);
    expect((await immich.getAlbums()).map((a) => a.id)).toContain(NEW);
    expect(listRequests()).toBe(2);

    // Cached again, and an allowlisted album Immich does not know (deleted)
    // costs no request per call.
    write(
      'gallery.yaml',
      `albums:\n  - "${A}"\n  - "${NEW}"\n  - "${'5'.repeat(8)}-5555-4555-8555-555555555555"\n`,
    );
    await immich.getAlbums();
    await immich.getAlbums();
    await immich.getAlbums();
    expect(listRequests()).toBe(3);
  });

  it('applies overrides to a single album from the cache as well', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/search/metadata')) {
        return json({ assets: { items: [], nextPage: null } });
      }
      if (String(url).endsWith(`/albums/${A}`)) {
        return json({ id: A, albumName: 'Alpha', description: '', assetCount: 0, order: 'desc' });
      }
      return json(immichAlbums);
    });
    write('gallery.yaml', `albums:\n  - "${A}"\n`);
    expect((await immich.getAlbum(A))?.albumName).toBe('Alpha');
    const albumRequests = () =>
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith(`/albums/${A}`)).length;
    expect(albumRequests()).toBe(1);

    write('gallery.yaml', `albums:\n  - "${A}": Alpha Prime\n`);
    const album = await immich.getAlbum(A);
    expect(album?.albumName).toBe('Alpha Prime');
    expect(album?.slug).toBe('alpha-prime');
    expect(albumRequests()).toBe(1);
  });
});

describe('subpage albums follow the configured order (A-6)', () => {
  it('lists albums in gallery.yaml order, not Immich order', async () => {
    write(
      'gallery.yaml',
      `subpages:\n  - name: Trips\n    albums:\n      - "${B}"\n      - "${A}"\n      - "${C}"\n`,
    );
    const result = await immich.getSubpageAlbums('trips');
    expect(result?.albums.map((a) => a.id)).toEqual([B, A, C]);

    // Rearranged in the page builder: the next call follows.
    write(
      'gallery.yaml',
      `subpages:\n  - name: Trips\n    albums:\n      - "${C}"\n      - "${B}"\n      - "${A}"\n`,
    );
    const reordered = await immich.getSubpageAlbums('trips');
    expect(reordered?.albums.map((a) => a.id)).toEqual([C, B, A]);
    expect(listRequests()).toBe(1);
  });

  it('keeps section order across sections', async () => {
    write(
      'gallery.yaml',
      [
        'subpages:',
        '  - name: Japan',
        '    sections:',
        '      - title: South',
        '        albums:',
        `          - "${B}"`,
        '      - title: North',
        '        albums:',
        `          - "${C}"`,
        `          - "${A}"`,
        '',
      ].join('\n'),
    );
    const result = await immich.getSubpageAlbums('japan');
    expect(result?.albums.map((a) => a.id)).toEqual([B, C, A]);
  });
});

describe('the cache is one per process, not one per module instance', () => {
  it('is cleared for every instance by a clear in any of them', async () => {
    vi.resetModules();
    const other = await import('@/lib/cache');
    expect(other.cache).not.toBe(cache);

    cache.set('probe', 1, 60_000);
    expect(other.cache.get('probe')).toBe(1);
    expect(other.cache.size).toBe(cache.size);

    other.cache.clear();
    expect(cache.get('probe')).toBeNull();
  });
});
