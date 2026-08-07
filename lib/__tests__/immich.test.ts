import { describe, it, expect, vi, beforeEach } from 'vitest';
import { immich, ImmichUnavailableError } from '../immich';
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
      // Non-zero: a 0 TTL expires an entry in the same millisecond it is
      // written, which would make any caching assertion flaky. Isolation comes
      // from the cache.clear() in beforeEach, not from an unusable TTL.
      cacheTtl: 60_000,
      staleMaxAge: 86_400_000,
      immichTimeoutMs: 15000,
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

    // A null return means "Immich answered: this does not exist" and the page
    // turns it into notFound(). Every other failure must be distinguishable,
    // or an outage renders a hard 404 for albums that do exist.
    describe('distinguishes "gone" from "unavailable"', () => {
      it('returns null for 410 Gone', async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 410, statusText: 'Gone' });
        await expect((immich as any).request('/test')).resolves.toBeNull();
      });

      it('throws on a 5xx instead of reporting the resource as missing', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        });

        await expect((immich as any).request('/test')).rejects.toBeInstanceOf(
          ImmichUnavailableError,
        );
      });

      it('throws on a rejected API key rather than 404-ing every album', async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' });
        await expect((immich as any).request('/test')).rejects.toBeInstanceOf(
          ImmichUnavailableError,
        );
      });

      it('throws when the network is unreachable', async () => {
        mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
        await expect((immich as any).request('/test')).rejects.toBeInstanceOf(
          ImmichUnavailableError,
        );
      });

      it('throws when a gateway returns an HTML error page instead of JSON', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'text/html' },
          json: async () => ({}),
        });

        await expect((immich as any).request('/test')).rejects.toBeInstanceOf(
          ImmichUnavailableError,
        );
      });

      it('carries the upstream status for logging', async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 502, statusText: 'Bad Gateway' });
        await expect((immich as any).request('/test')).rejects.toMatchObject({ status: 502 });
      });
    });
  });

  // Without a budget the only ceiling is undici's default, measured in minutes.
  // Every page is force-dynamic, so an Immich that accepts connections but never
  // answers would hold each visitor's render open for that whole window.
  describe('timeouts', () => {
    const timeoutError = () => {
      const err = new Error('The operation was aborted due to timeout');
      err.name = 'TimeoutError';
      return err;
    };

    it('sends an abort signal with every JSON request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
      });

      await (immich as any).request('/test');
      expect(mockFetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });

    it('reports a timed-out request as unavailable, not as a missing resource', async () => {
      mockFetch.mockRejectedValueOnce(timeoutError());

      await expect((immich as any).request('/test')).rejects.toBeInstanceOf(ImmichUnavailableError);
    });

    it('names the budget in the error so a misconfigured timeout is diagnosable', async () => {
      mockFetch.mockRejectedValueOnce(timeoutError());
      await expect((immich as any).request('/test')).rejects.toThrow(/15000ms/);
    });

    // The stream methods deliberately use a headers-only timeout. A whole-request
    // timeout would truncate a large original photo or a long video mid-transfer.
    it('stops the clock once stream headers arrive, so a slow body is not truncated', async () => {
      vi.useFakeTimers();
      try {
        let captured: AbortSignal | undefined;
        mockFetch.mockImplementation(async (_url: string, init: { signal?: AbortSignal }) => {
          captured = init.signal;
          return {
            ok: true,
            status: 200,
            body: new ReadableStream(),
            headers: { get: () => null },
          };
        });

        const result = await immich.streamAsset('asset-1');
        expect(result).not.toBeNull();

        // Far beyond the 15s budget: a whole-request timeout would abort here
        // and kill an in-progress download.
        vi.advanceTimersByTime(60 * 60 * 1000);
        expect(captured?.aborted).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('still aborts a stream that never returns headers', async () => {
      vi.useFakeTimers();
      try {
        let captured: AbortSignal | undefined;
        mockFetch.mockImplementation(
          (_url: string, init: { signal?: AbortSignal }) =>
            new Promise((_resolve, reject) => {
              captured = init.signal;
              init.signal?.addEventListener('abort', () => reject(timeoutError()));
            }),
        );

        const pending = immich.streamAsset('asset-1');
        // Attach the rejection handler *before* advancing timers: the abort
        // fires during advanceTimersByTimeAsync, and a promise that rejects
        // with no handler yet attached is reported as an unhandled rejection,
        // which fails the whole vitest run.
        const rejects = expect(pending).rejects.toBeInstanceOf(ImmichUnavailableError);
        await vi.advanceTimersByTimeAsync(15001);

        await rejects;
        expect(captured?.aborted).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // The image/video routes serve these URLs with `immutable` on success and turn
  // a null into a 404. A bare 404 is heuristically cacheable, so an outage that
  // looked like "missing" could pin a broken image in the browser cache.
  describe('stream failures distinguish gone from unavailable', () => {
    const streamRes = (status: number) => ({
      ok: status >= 200 && status < 300,
      status,
      body: null,
      headers: { get: () => null },
    });

    it('streamAsset returns null for a genuinely missing asset', async () => {
      mockFetch.mockResolvedValueOnce(streamRes(404));
      await expect(immich.streamAsset('asset-1')).resolves.toBeNull();
    });

    it('streamAsset throws when Immich errors rather than reporting it missing', async () => {
      mockFetch.mockResolvedValueOnce(streamRes(500));
      await expect(immich.streamAsset('asset-1')).rejects.toBeInstanceOf(ImmichUnavailableError);
    });

    it('streamAsset throws when the network is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(immich.streamAsset('asset-1')).rejects.toBeInstanceOf(ImmichUnavailableError);
    });

    it('streamAsset throws on a 200 with no body', async () => {
      mockFetch.mockResolvedValueOnce(streamRes(200));
      await expect(immich.streamAsset('asset-1')).rejects.toBeInstanceOf(ImmichUnavailableError);
    });

    it('streamVideo returns null for a genuinely missing video', async () => {
      mockFetch.mockResolvedValueOnce(streamRes(404));
      await expect(immich.streamVideo('asset-1')).resolves.toBeNull();
    });

    it('streamVideo throws when Immich errors', async () => {
      mockFetch.mockResolvedValueOnce(streamRes(502));
      await expect(immich.streamVideo('asset-1')).rejects.toBeInstanceOf(ImmichUnavailableError);
    });

    it('streamVideo still accepts a 206 partial response for seeking', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 206,
        body: new ReadableStream(),
        headers: { get: () => null },
      });

      const result = await immich.streamVideo('asset-1', 'bytes=0-1023');
      expect(result?.status).toBe(206);
    });
  });

  // Measured before the fix: 5 sequential lookups of a missing asset produced 5
  // upstream fetches. The homepage resolves every gallery.yaml hero ID on each
  // render and is force-dynamic, so a hero photo deleted from Immich cost one
  // 404 round-trip per page view, indefinitely.
  describe('negative caching', () => {
    const notFound = { ok: false, status: 404, statusText: 'Not Found' };

    it('queries Immich once for a repeatedly-requested missing asset', async () => {
      mockFetch.mockResolvedValue(notFound);

      for (let i = 0; i < 5; i++) {
        await expect(immich.getAssetInfo('missing-asset')).resolves.toBeNull();
      }

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('queries Immich once for a repeatedly-requested missing album', async () => {
      mockFetch.mockResolvedValue(notFound);

      for (let i = 0; i < 3; i++) {
        await expect(immich.getAlbum('album-1')).resolves.toBeNull();
      }

      // One album request + one metadata-search request, from the first call only.
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('does not cache an outage, which would outlive the recovery', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Unavailable' });
      await expect(immich.getAssetInfo('asset-1')).rejects.toBeInstanceOf(ImmichUnavailableError);

      // Immich recovers: the very next call must reach it, not replay the failure.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 'asset-1' }),
      });

      await expect(immich.getAssetInfo('asset-1')).resolves.toMatchObject({ id: 'asset-1' });
    });

    it('a cached absence is cleared by invalidation, so a fix takes effect at once', async () => {
      mockFetch.mockResolvedValue(notFound);
      await expect(immich.getAssetInfo('asset-1')).resolves.toBeNull();

      immich.invalidateAll();

      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 'asset-1' }),
      });

      await expect(immich.getAssetInfo('asset-1')).resolves.toMatchObject({ id: 'asset-1' });
    });
  });

  // The regression this whole error type exists to prevent.
  describe('outage handling', () => {
    it('getAlbum propagates an outage instead of returning null', async () => {
      // Not mockResolvedValueOnce: getAlbum fires the album and metadata-search
      // requests concurrently, so both need the failing response.
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });

      await expect(immich.getAlbum('album-1')).rejects.toBeInstanceOf(ImmichUnavailableError);
    });

    it('getAlbums propagates an outage instead of returning an empty list', async () => {
      // Returning [] here would render the homepage as "this gallery has no
      // albums" while Immich is merely down.
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });

      await expect(immich.getAlbums()).rejects.toBeInstanceOf(ImmichUnavailableError);
    });

    it('a failed album does not leave a stale entry in the in-flight map', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });
      await expect(immich.getAlbum('album-1')).rejects.toBeInstanceOf(ImmichUnavailableError);

      // A stranded pending promise would make every later call replay the
      // failure forever, even after Immich recovers.
      expect((immich as any).pendingAlbumPromises.has('album-1')).toBe(false);
      expect((immich as any).pendingAlbumsPromise).toBeNull();
    });

    it('ping reports unreachable as false rather than throwing', async () => {
      // /api/health and /api/admin/status render this as a status field.
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(immich.ping()).resolves.toBe(false);
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

describe('stale fallback when Immich is unavailable', () => {
  const mockFetch = global.fetch as any;

  beforeEach(() => {
    vi.clearAllMocks();
    cache.clear();
  });

  it('serves the previously cached album list instead of throwing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => [
        {
          id: 'album-1',
          albumName: 'Original',
          description: '',
          albumThumbnailAssetId: null,
          assetCount: 1,
          assets: [],
          createdAt: '',
          updatedAt: '',
          order: 'desc',
        },
      ],
    });

    const fresh = await immich.getAlbums();
    expect(fresh).toHaveLength(1);

    vi.useFakeTimers();
    // Strictly past cacheTtl (60_000ms) so cache.get()'s fresh-only check
    // misses and the fallback path — not a lucky cache hit — is what's tested.
    vi.advanceTimersByTime(60_001);
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const stale = await immich.getAlbums();
    vi.useRealTimers();

    expect(stale).toHaveLength(1);
    expect(stale[0].id).toBe('album-1');
  });

  it('still throws when there is nothing cached to fall back to', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(immich.getAlbums()).rejects.toThrow(ImmichUnavailableError);
  });

  it('does not swallow a definitive 404 as an outage', async () => {
    // A missing album must keep reporting missing, not fall back to stale data.
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: () => 'application/json' },
    });
    await expect(immich.getAlbum('album-1')).resolves.toBeNull();
  });

  it('still refuses albums outside the allowlist', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(immich.getAlbum('not-allowed')).resolves.toBeNull();
  });
});
