import { describe, it, expect, vi, beforeEach } from 'vitest';
import { immich } from '../immich';
import * as config from '../config';
import { cache } from '../cache';

// Mock the config by wrapping it in a factory
vi.mock('../config', async () => {
  const actual = await vi.importActual<typeof config>('../config');
  return {
    ...actual,
    getConfig: () => ({
      immich: { apiUrl: 'http://immich.test/api', apiKey: 'test-key' },
      authSecret: 'test-auth-secret-32-chars-long-min',
      albums: ['album-1', 'album-2'],
      standaloneAlbums: ['album-2', 'album-1'],
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
    // getAlbum() memoises into the module-level LRU; without this, later tests
    // read a previous test's album and never reach the mocked fetch.
    cache.clear();
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

  describe('getStandaloneAlbums()', () => {
    it('orders albums by gallery.yaml order, not Immich API order', async () => {
      // The Immich API returns albums in its own (creation/update) order;
      // the config lists album-2 first, so that must win on the homepage.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => [
          { id: 'album-1', albumName: 'First in API', assetCount: 1 },
          { id: 'album-2', albumName: 'Second in API', assetCount: 1 },
        ],
      });

      const albums = await immich.getStandaloneAlbums();
      expect(albums.map((a) => a.id)).toEqual(['album-2', 'album-1']);
    });
  });

  describe('getAlbum()', () => {
    it('returns null for unallowed album IDs', async () => {
      const album = await immich.getAlbum('album-3');
      expect(album).toBeNull();
    });

    /**
     * Immich 3.x returns an empty `assets` array from GET /albums/:id, so
     * assets come from a separate POST /search/metadata call. Route the mock by
     * URL rather than by call order — the two run concurrently.
     */
    function mockAlbumApi(options: {
      order?: 'asc' | 'desc';
      pages?: Array<{ items: unknown[]; nextPage: string | null }>;
    }) {
      const pages = options.pages ?? [];
      const json = (body: unknown) => ({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => body,
      });

      mockFetch.mockImplementation(async (url: string, init?: { body?: string }) => {
        if (url.includes('/search/metadata')) {
          const page = JSON.parse(init?.body ?? '{}').page ?? 1;
          const p = pages[page - 1] ?? { items: [], nextPage: null };
          return json({ assets: { items: p.items, nextPage: p.nextPage, total: p.items.length } });
        }
        // Mirrors the real 3.x response: assetCount set, assets empty.
        return json({
          id: 'album-1',
          albumName: 'Name',
          assetCount: 2,
          assets: [],
          order: options.order ?? 'desc',
        });
      });
    }

    const asset = (id: string, date: string, isTrashed = false) => ({
      id,
      isTrashed,
      fileCreatedAt: date,
    });

    it('loads assets via metadata search and filters trashed ones', async () => {
      mockAlbumApi({
        pages: [
          {
            items: [
              asset('asset-1', '2024-01-02T00:00:00Z'),
              asset('asset-2', '2024-01-03T00:00:00Z', true),
            ],
            nextPage: null,
          },
        ],
      });

      const album = await immich.getAlbum('album-1');
      expect(album?.assets).toHaveLength(1);
      expect(album?.assets[0].id).toBe('asset-1');
    });

    it('requests EXIF data — without it the grid, lightbox and map go blank', async () => {
      mockAlbumApi({ pages: [{ items: [], nextPage: null }] });
      await immich.getAlbum('album-1');

      const search = mockFetch.mock.calls.find((c: unknown[]) =>
        String(c[0]).includes('/search/metadata'),
      );
      expect(search).toBeDefined();
      const body = JSON.parse((search[1] as { body: string }).body);
      expect(body.withExif).toBe(true);
      expect(body.albumIds).toEqual(['album-1']);
      expect(search[1].method).toBe('POST');
    });

    it('follows pagination until nextPage is null', async () => {
      mockAlbumApi({
        pages: [
          { items: [asset('a', '2024-01-01T00:00:00Z')], nextPage: '2' },
          { items: [asset('b', '2024-01-02T00:00:00Z')], nextPage: '3' },
          { items: [asset('c', '2024-01-03T00:00:00Z')], nextPage: null },
        ],
      });

      const album = await immich.getAlbum('album-1');
      expect(album?.assets.map((a) => a.id)).toEqual(['c', 'b', 'a']); // desc by fileCreatedAt
    });

    it('honours the album sort order', async () => {
      const items = [
        asset('old', '2024-01-01T00:00:00Z'),
        asset('new', '2024-06-01T00:00:00Z'),
        asset('mid', '2024-03-01T00:00:00Z'),
      ];

      mockAlbumApi({ order: 'asc', pages: [{ items, nextPage: null }] });
      let album = await immich.getAlbum('album-1');
      expect(album?.assets.map((a) => a.id)).toEqual(['old', 'mid', 'new']);

      cache.clear(); // same album id — otherwise the asc result is reused
      mockAlbumApi({ order: 'desc', pages: [{ items, nextPage: null }] });
      album = await immich.getAlbum('album-1');
      expect(album?.assets.map((a) => a.id)).toEqual(['new', 'mid', 'old']);
    });
  });
});
