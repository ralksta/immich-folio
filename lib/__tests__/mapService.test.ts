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

vi.mock('@/lib/config', () => ({
  getConfig: () => ({ subpages: [], cacheTtl: 60_000 }),
}));

vi.mock('@/lib/cache', () => ({
  cache: { get: () => undefined, set: () => {} },
}));

import { getMapData } from '@/lib/mapService';

const ALBUM = { id: 'album-1', albumName: 'Trip', slug: 'trip' };

function asset(id: string, exif: Record<string, unknown>) {
  return { id, exifInfo: exif };
}

beforeEach(() => {
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
