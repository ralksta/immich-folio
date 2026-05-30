import { describe, it, expect, vi, beforeEach } from 'vitest';
import { immich } from '../immich';
import * as config from '../config';

// Mock the config by wrapping it in a factory
vi.mock('../config', async () => {
  const actual = await vi.importActual<typeof config>('../config');
  return {
    ...actual,
    getConfig: () => ({
      immich: { apiUrl: 'http://immich.test/api', apiKey: 'test-key' },
      authSecret: 'test-auth-secret-32-chars-long-min',
      albums: ['album-1', 'album-2'],
      standaloneAlbums: ['album-1'],
      subpages: [],
      albumOverrides: { 'album-1': 'Override Name' },
      albumDescriptions: {},
      cacheTtl: 0,
    }),
  };
});

// Mock fetch globally
global.fetch = vi.fn();

describe('ImmichClient', () => {
  const mockFetch = global.fetch as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('request()', () => {
    it('returns data on successful JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ foo: 'bar' }),
      });

      // Access private method via any casting for testing
      const result = await (immich as any).request('/test');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('returns null on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await (immich as any).request('/test');
      expect(result).toBeNull();
    });
  });

  describe('getAlbums()', () => {
    it('filters and overrides albums based on config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => [
          { id: 'album-1', albumName: 'Original Name', assetCount: 10 },
          { id: 'album-3', albumName: 'Not Allowed', assetCount: 5 },
        ],
      });

      const albums = await immich.getAlbums();
      expect(albums).toHaveLength(1);
      expect(albums[0].id).toBe('album-1');
      expect(albums[0].albumName).toBe('Override Name');
      expect(albums[0].slug).toBe('override-name');
    });
  });

  describe('getAlbum()', () => {
    it('returns null for unallowed album IDs', async () => {
      const album = await immich.getAlbum('album-3');
      expect(album).toBeNull();
    });

    it('returns album data and filters trashed assets', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          id: 'album-1',
          albumName: 'Name',
          assets: [
            { id: 'asset-1', isTrashed: false },
            { id: 'asset-2', isTrashed: true },
          ],
        }),
      });

      const album = await immich.getAlbum('album-1');
      expect(album?.assets).toHaveLength(1);
      expect(album?.assets[0].id).toBe('asset-1');
    });
  });
});
