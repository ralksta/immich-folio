import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `!exif?.latitude` treats a coordinate of exactly 0 as absent, so a photo on
 * the equator or the prime meridian never reached the map (#635).
 */
const getAlbums = vi.fn();
const getAlbum = vi.fn();
vi.mock('@/lib/immich', () => ({
  immich: {
    getAlbums: (...args: unknown[]) => getAlbums(...args),
    getAlbum: (...args: unknown[]) => getAlbum(...args),
  },
}));

const config = vi.hoisted(() => ({
  value: {
    standaloneAlbums: ['album-1'] as string[],
    subpages: [] as Array<{ slug: string; albumIds: string[]; enabled: boolean; hidden?: boolean }>,
    cacheTtl: 60_000,
  },
}));
vi.mock('@/lib/config', () => ({
  getConfig: () => config.value,
}));

vi.mock('@/lib/cache', () => ({
  cache: { get: () => undefined, set: () => {} },
}));

import { getMapData, visibleMapCounts } from '@/lib/mapService';
import { listedAlbumIds } from '@/lib/config/schema';

const ALBUM = { id: 'album-1', albumName: 'Trip', slug: 'trip' };

function asset(id: string, exif: Record<string, unknown>) {
  return { id, exifInfo: exif };
}

beforeEach(() => {
  config.value.standaloneAlbums = ['album-1'];
  config.value.subpages = [];
  getAlbums.mockReset();
  getAlbum.mockReset();
  getAlbums.mockResolvedValue([ALBUM]);
});

describe('getMapData coordinate filtering (#635)', () => {
  it('includes a photo at latitude 0 (the equator)', async () => {
    getAlbum.mockResolvedValue({
      id: ALBUM.id,
      assets: [asset('a', { latitude: 0, longitude: 12.5, city: 'Somewhere', country: 'Kenya' })],
    });

    const locations = await getMapData();

    expect(locations).toHaveLength(1);
    expect(locations[0].albums[0].photoCount).toBe(1);
    expect(locations[0].albums[0].latSum).toBe(0);
  });

  it('includes a photo at longitude 0 (the prime meridian)', async () => {
    getAlbum.mockResolvedValue({
      id: ALBUM.id,
      assets: [asset('a', { latitude: 51.5, longitude: 0, city: 'London', country: 'UK' })],
    });

    const locations = await getMapData();

    expect(locations).toHaveLength(1);
    expect(locations[0].albums[0].photoCount).toBe(1);
  });

  it('carries the cover’s edit state for its image URL (#831)', async () => {
    const place = { latitude: 52.5, longitude: 13.4, city: 'Berlin', country: 'Germany' };
    getAlbum.mockResolvedValue({
      id: ALBUM.id,
      assets: [{ ...asset('a', place), isEdited: true, updatedAt: '2026-09-04T19:22:09.220Z' }],
    });
    const [edited] = await getMapData();
    expect(edited.albums[0].coverAssetId).toBe('a');
    expect(edited.albums[0].coverEdit).toEqual({
      isEdited: true,
      updatedAt: '2026-09-04T19:22:09.220Z',
    });

    getAlbum.mockResolvedValue({ id: ALBUM.id, assets: [asset('b', place)] });
    const [plain] = await getMapData();
    expect(plain.albums[0].coverEdit).toBeUndefined();
  });

  it('still excludes a photo with no coordinates at all', async () => {
    getAlbum.mockResolvedValue({
      id: ALBUM.id,
      assets: [asset('a', { latitude: null, longitude: null, city: 'Nowhere', country: 'None' })],
    });

    const locations = await getMapData();

    expect(locations).toHaveLength(0);
  });

  it('still excludes a photo missing city or country', async () => {
    getAlbum.mockResolvedValue({
      id: ALBUM.id,
      assets: [asset('a', { latitude: 0, longitude: 0, city: '', country: 'Kenya' })],
    });

    const locations = await getMapData();

    expect(locations).toHaveLength(0);
  });
});

/**
 * `enabled: false` takes a subpage offline. Its albums stay on the allowlist
 * (the configuration is kept), so the map has to leave them out itself: a
 * marker names the album, links it, counts it and shows one of its photos.
 */
describe('getMapData and offline subpages', () => {
  const berlin = { latitude: 52.5, longitude: 13.4, city: 'Berlin', country: 'Germany' };

  beforeEach(() => {
    getAlbum.mockResolvedValue({ id: ALBUM.id, assets: [asset('a', berlin)] });
  });

  it('leaves out an album whose only subpage is offline', async () => {
    config.value.standaloneAlbums = [];
    config.value.subpages = [{ slug: 'old-series', albumIds: [ALBUM.id], enabled: false }];

    expect(await getMapData()).toEqual([]);
  });

  it('keeps it when an enabled subpage lists it too, and links it there', async () => {
    config.value.standaloneAlbums = [];
    config.value.subpages = [
      { slug: 'old-series', albumIds: [ALBUM.id], enabled: false },
      { slug: 'travel', albumIds: [ALBUM.id], enabled: true },
    ];

    const locations = await getMapData();

    expect(locations).toHaveLength(1);
    expect(locations[0].albums[0].subpageSlug).toBe('travel');
  });
});

/**
 * `hidden: true` keeps a subpage reachable by direct link only. The map is a
 * listing: a marker names the album, links it under the subpage's address and
 * shows one of its photos, so an album only a hidden subpage carries must not
 * appear on it. Its photos stay reachable through the link (publishedAssets
 * still asks onlineAlbumIds, which is not narrowed).
 */
describe('getMapData and hidden subpages', () => {
  const berlin = { latitude: 52.5, longitude: 13.4, city: 'Berlin', country: 'Germany' };

  beforeEach(() => {
    getAlbum.mockResolvedValue({ id: ALBUM.id, assets: [asset('a', berlin)] });
  });

  it('leaves out an album whose only subpage is hidden', async () => {
    config.value.standaloneAlbums = [];
    config.value.subpages = [
      { slug: 'private', albumIds: [ALBUM.id], enabled: true, hidden: true },
    ];

    expect(await getMapData()).toEqual([]);
    expect(getAlbum).not.toHaveBeenCalled();
  });

  it('keeps it when a listed subpage carries it too, and links it there', async () => {
    config.value.standaloneAlbums = [];
    config.value.subpages = [
      { slug: 'private', albumIds: [ALBUM.id], enabled: true, hidden: true },
      { slug: 'travel', albumIds: [ALBUM.id], enabled: true },
    ];

    const locations = await getMapData();

    expect(locations).toHaveLength(1);
    expect(locations[0].albums[0].subpageSlug).toBe('travel');
  });

  it('keeps a standalone album that a hidden subpage also carries, linked standalone', async () => {
    config.value.standaloneAlbums = [ALBUM.id];
    config.value.subpages = [
      { slug: 'private', albumIds: [ALBUM.id], enabled: true, hidden: true },
    ];

    const locations = await getMapData();

    expect(locations).toHaveLength(1);
    expect(locations[0].albums[0].subpageSlug).toBeUndefined();
  });
});

describe('listedAlbumIds', () => {
  it('drops albums of offline and hidden subpages, keeps standalone and listed ones', () => {
    const ids = listedAlbumIds({
      standaloneAlbums: ['s'],
      subpages: [
        { albumIds: ['v', 'shared'], enabled: true },
        { albumIds: ['off'], enabled: false },
        { albumIds: ['h', 'shared'], enabled: true, hidden: true },
      ],
    });

    expect([...ids].sort()).toEqual(['s', 'shared', 'v']);
  });
});

/**
 * The /map header counted protected subpages and albums that /api/map drops
 * for a viewer who has not unlocked them, so the numbers did not match the map.
 */
describe('visibleMapCounts', () => {
  const site = {
    standaloneAlbums: ['solo', 'locked-solo'],
    subpages: [
      { slug: 'travel', albumIds: ['t1', 't2'], enabled: true },
      { slug: 'clients', albumIds: ['c1'], enabled: true },
      { slug: 'offline', albumIds: ['o1'], enabled: false },
      { slug: 'secret', albumIds: ['h1'], enabled: true, hidden: true },
    ],
  };
  const lockedKeys = new Set(['subpage:clients', 'album:locked-solo', 'album:t2']);
  const locked = (key: string, type: 'subpage' | 'album') => !lockedKeys.has(`${type}:${key}`);

  it('counts everything listed when nothing is locked', () => {
    expect(visibleMapCounts(site, () => true)).toEqual({ collections: 2, albums: 5 });
  });

  it('leaves out locked subpages, their albums and locked albums', () => {
    // travel (t1), solo — clients, c1, locked-solo and t2 stay locked.
    expect(visibleMapCounts(site, locked)).toEqual({ collections: 1, albums: 2 });
  });

  it('gates an album by the same subpage the map links it to', () => {
    const shared = {
      standaloneAlbums: [],
      subpages: [
        { slug: 'clients', albumIds: ['x'], enabled: true },
        { slug: 'travel', albumIds: ['x'], enabled: true },
      ],
    };
    // /api/map gates `x` by `clients`, its first listed subpage.
    expect(visibleMapCounts(shared, locked).albums).toBe(0);
  });
});
