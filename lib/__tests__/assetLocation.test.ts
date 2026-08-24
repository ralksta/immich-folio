import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LocationPrecision } from '@/lib/mapPrecision';

/**
 * The per-album `location:` setting governed the map and nothing else, so an
 * album asking to be absent from it still had its city named in the lightbox
 * info panel. These pin the join: an asset inherits the setting of the albums
 * that carry it.
 */
const albumLocationPrecision: Record<string, LocationPrecision> = {};

vi.mock('@/lib/config', async () => {
  const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config');
  return {
    ...actual,
    getConfig: () => ({ albumLocationPrecision }),
  };
});

const getAlbum = vi.fn();
vi.mock('@/lib/immich', () => ({
  immich: { getAlbum: (id: string) => getAlbum(id) },
}));

import { assetLocationPrecision } from '@/lib/assetLocation';

const ASSET = 'asset-1';
const OTHER = 'asset-2';

/** An album whose assets are just ids. */
const album = (id: string, assetIds: string[]) => ({
  id,
  assets: assetIds.map((a) => ({ id: a })),
});

beforeEach(() => {
  for (const key of Object.keys(albumLocationPrecision)) delete albumLocationPrecision[key];
  getAlbum.mockReset();
});

describe('assetLocationPrecision', () => {
  it('is exact when no album restricts anything, without asking Immich at all', async () => {
    await expect(assetLocationPrecision(ASSET)).resolves.toBe('exact');
    // The common case must not cost a single album fetch.
    expect(getAlbum).not.toHaveBeenCalled();
  });

  it('takes the setting of an album that carries the asset', async () => {
    albumLocationPrecision['album-a'] = 'country';
    getAlbum.mockResolvedValue(album('album-a', [ASSET]));
    await expect(assetLocationPrecision(ASSET)).resolves.toBe('country');
  });

  it('ignores an album that restricts but does not carry the asset', async () => {
    albumLocationPrecision['album-a'] = 'hidden';
    getAlbum.mockResolvedValue(album('album-a', [OTHER]));
    await expect(assetLocationPrecision(ASSET)).resolves.toBe('exact');
  });

  // Same rule as a merged map marker: the cautious setting governs.
  it('takes the strictest when several albums carry the asset', async () => {
    albumLocationPrecision['album-a'] = 'city';
    albumLocationPrecision['album-b'] = 'hidden';
    getAlbum.mockImplementation(async (id: string) => album(id, [ASSET]));
    await expect(assetLocationPrecision(ASSET)).resolves.toBe('hidden');
  });

  it('only asks about albums that actually restrict something', async () => {
    albumLocationPrecision['album-a'] = 'exact';
    albumLocationPrecision['album-b'] = 'city';
    getAlbum.mockImplementation(async (id: string) => album(id, [ASSET]));
    await assetLocationPrecision(ASSET);
    expect(getAlbum).toHaveBeenCalledTimes(1);
    expect(getAlbum).toHaveBeenCalledWith('album-b');
  });

  // Failing open would publish the position the setting exists to withhold.
  it('withholds the place when an album cannot be read', async () => {
    albumLocationPrecision['album-a'] = 'city';
    getAlbum.mockRejectedValue(new Error('Immich is down'));
    await expect(assetLocationPrecision(ASSET)).resolves.toBe('hidden');
  });

  it('withholds it when the album is gone from the allowlist', async () => {
    albumLocationPrecision['album-a'] = 'city';
    getAlbum.mockResolvedValue(null);
    await expect(assetLocationPrecision(ASSET)).resolves.toBe('hidden');
  });
});
