import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/admin/auth', () => ({
  isAdminEnabled: () => true,
  isAdminAuthenticated: async () => true,
}));

vi.mock('@/lib/config', () => ({
  getConfig: () => ({ needsSetup: false }),
}));

const getAlbumAssetsRaw = vi.fn();
vi.mock('@/lib/immich', () => ({
  immich: {
    get getAlbumAssetsRaw() {
      return getAlbumAssetsRaw;
    },
  },
}));

import { GET } from '../route';

const ALBUM = '11111111-1111-1111-1111-111111111111';

const asset = (id: string, type: 'IMAGE' | 'VIDEO') => ({
  id,
  type,
  originalFileName: `${id}.jpg`,
  fileCreatedAt: '2024-01-01T00:00:00.000Z',
  isFavorite: false,
});

const call = (albumId: string, query = '') =>
  GET(new NextRequest(`http://localhost/api/admin/albums/${albumId}/assets${query}`), {
    params: Promise.resolve({ albumId }),
  });

describe('GET /api/admin/albums/[albumId]/assets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAlbumAssetsRaw.mockResolvedValue([
      asset('img-1', 'IMAGE'),
      asset('vid-1', 'VIDEO'),
      asset('img-2', 'IMAGE'),
    ]);
  });

  // Without this, `..%2f..%2fusers` resolves inside fetch() to an arbitrary
  // Immich endpoint, called with the server's API key.
  it('rejects an album ID that is not a UUID', async () => {
    const res = await call('..%2f..%2fusers');

    expect(res.status).toBe(400);
    expect(getAlbumAssetsRaw).not.toHaveBeenCalled();
  });

  it('returns images only by default, so the hero picker is unaffected', async () => {
    const res = await call(ALBUM);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.assets.map((a: { id: string }) => a.id)).toEqual(['img-1', 'img-2']);
  });

  // The public grid renders videos, so the sort editor has to be able to pin
  // one — otherwise a video could only ever sit in the unpinned tail.
  it('includes videos when types=all', async () => {
    const res = await call(ALBUM, '?types=all');
    const body = await res.json();

    expect(body.assets.map((a: { id: string }) => a.id)).toEqual(['img-1', 'vid-1', 'img-2']);
  });

  /**
   * Immich 3.x stopped embedding assets in `GET /albums/:id`, which is what
   * this route used to read — so it returned nothing, and threw outright when
   * the key was absent. It has to go through the client's paginated metadata
   * search instead.
   */
  it('reads assets through the Immich client rather than the album endpoint', async () => {
    await call(ALBUM);

    expect(getAlbumAssetsRaw).toHaveBeenCalledWith(ALBUM);
  });

  it('reports an upstream failure as a 500 rather than an empty album', async () => {
    getAlbumAssetsRaw.mockRejectedValue(new Error('immich down'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await call(ALBUM);

    expect(res.status).toBe(500);
    err.mockRestore();
  });
});
