import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as config from '../config';
import { cache } from '../cache';

/**
 * A deployment with credentials in the environment but no content/gallery.yaml
 * is `needsSetup`, yet Immich is perfectly reachable. The client used to gate
 * every request on that flag, so it returned null before the fetch — the admin
 * panel reported "Immich disconnected" and nothing at all was logged (#507).
 */
const state = {
  apiUrl: 'http://immich.test/api',
  apiKey: 'test-key',
  needsSetup: true,
  needsCredentials: false,
  needsGallery: true,
  albums: [] as string[],
};

vi.mock('../config', async () => {
  const actual = await vi.importActual<typeof config>('../config');
  return {
    ...actual,
    getConfig: () => ({
      immich: { apiUrl: state.apiUrl, apiKey: state.apiKey },
      authSecret: 'test-auth-secret-32-chars-long-min',
      albums: state.albums,
      standaloneAlbums: [],
      subpages: [],
      albumOverrides: {},
      albumDescriptions: {},
      albumSortModes: {},
      albumManualOrders: {},
      cacheTtl: 60_000,
      staleMaxAge: 86_400_000,
      immichTimeoutMs: 15000,
      needsSetup: state.needsSetup,
      needsCredentials: state.needsCredentials,
      needsGallery: state.needsGallery,
    }),
  };
});

global.fetch = vi.fn();

const { immich } = await import('../immich');

describe('ImmichClient — install state', () => {
  const mockFetch = global.fetch as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    state.apiUrl = 'http://immich.test/api';
    state.apiKey = 'test-key';
    state.needsCredentials = false;
    state.needsSetup = true;
    state.needsGallery = true;
    state.albums = [];
    cache.clear();
  });

  it('pings Immich even without a gallery.yaml', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ res: 'pong' }),
    });

    await expect(immich.ping()).resolves.toBe(true);
    expect(mockFetch).toHaveBeenCalledWith('http://immich.test/api/server/ping', expect.anything());
  });

  it('reports an unreachable Immich as disconnected rather than throwing', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(immich.ping()).resolves.toBe(false);
  });

  /**
   * The setup config carries an empty allowlist, so the filtered list is [] no
   * matter what Immich returned. Caching that made the gallery look empty until
   * the server restarted, because the wizard's invalidateAll() runs in another
   * bundle's module instance and never reached this cache.
   */
  it('does not cache the empty album list while setup is unfinished', async () => {
    const album = {
      id: 'album-1',
      albumName: 'Japan',
      description: '',
      albumThumbnailAssetId: null,
      assetCount: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const respond = () => ({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => [album],
    });

    mockFetch.mockResolvedValueOnce(respond());
    await expect(immich.getAlbums()).resolves.toEqual([]);

    // The wizard finishes: credentials unchanged, but now there is a gallery.
    state.needsSetup = false;
    state.needsGallery = false;
    state.albums = ['album-1'];

    mockFetch.mockResolvedValueOnce(respond());
    const after = await immich.getAlbums();
    expect(after.map((a) => a.id)).toEqual(['album-1']);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('makes no request at all when credentials are absent', async () => {
    state.apiUrl = '';
    state.apiKey = '';
    state.needsCredentials = true;

    await expect(immich.ping()).resolves.toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
