import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as config from '../config';

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
};

vi.mock('../config', async () => {
  const actual = await vi.importActual<typeof config>('../config');
  return {
    ...actual,
    getConfig: () => ({
      immich: { apiUrl: state.apiUrl, apiKey: state.apiKey },
      authSecret: 'test-auth-secret-32-chars-long-min',
      albums: [],
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

  it('makes no request at all when credentials are absent', async () => {
    state.apiUrl = '';
    state.apiKey = '';
    state.needsCredentials = true;

    await expect(immich.ping()).resolves.toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
