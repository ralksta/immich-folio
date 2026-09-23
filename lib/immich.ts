/**
 * Server-only Immich API client.
 * Inspired by immich-public-proxy's approach but uses API key auth
 * to access specific albums rather than shared link keys.
 *
 * API key never leaves the server — all client-facing image
 * requests go through our proxy route.
 *
 * What this file is about is *what* Folio asks Immich for: albums, subpages,
 * assets, EXIF. How the asking happens lives in ./immichTransport, and when a
 * cached answer may still be served in ./immichCache (#610).
 */

import { getConfig, albumSlug, normalizeSlug, type SubpageConfig } from './config';
import { cache } from './cache';
import { compareByCaptureTime, sortAlbumAssets, DEFAULT_ALBUM_SORT } from './albumSort';
import { ImmichUnavailableError, isTimeout, requestJson } from './immichTransport';
import {
  MISSING,
  type Missing,
  cacheSet as cacheSetWithStale,
  staleOrThrow as serveStaleOrThrow,
  staleOrMissing as serveStaleOrMissing,
} from './immichCache';

// Part of this module's public surface since before the split; six call sites
// import it from here.
export { ImmichUnavailableError };

// ── Types ──────────────────────────────────────────────────────

export interface ImmichAlbum {
  id: string;
  slug: string;
  albumName: string;
  description: string;
  albumThumbnailAssetId: string | null;
  assetCount: number;
  assets: ImmichAsset[];
  createdAt: string;
  updatedAt: string;
  order: 'asc' | 'desc';
}

export interface ImmichAsset {
  id: string;
  type: 'IMAGE' | 'VIDEO';
  originalFileName: string;
  originalMimeType: string;
  thumbhash: string | null;
  fileCreatedAt: string;
  /** Capture time in the photographer's local zone — Immich's timeline sort key. */
  localDateTime?: string;
  exifInfo?: ImmichExifInfo;
  isTrashed: boolean;
  /** Only surfaced in the admin pickers. Optional: older Immich responses omit it. */
  isFavorite?: boolean;
}

export interface ImmichExifInfo {
  make: string | null;
  model: string | null;
  lensModel: string | null;
  focalLength: number | null;
  fNumber: number | null;
  exposureTime: string | null;
  iso: number | null;
  exifImageWidth: number | null;
  exifImageHeight: number | null;
  /**
   * EXIF orientation flag, as a numeric string ('1'..'8').
   *
   * Optional: Immich only fills it when the file carries the tag, and older
   * responses omit the field entirely.
   */
  orientation?: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  dateTimeOriginal: string | null;
  description: string | null;
}

export type ImageSize = 'thumbnail' | 'preview' | 'original';

/** Enriched subpage with album metadata (for rendering cards). */
export interface SubpageSummary {
  name: string;
  slug: string;
  albumCount: number;
  totalAssetCount: number;
  coverAssetId: string | null;
}

// Note: Album summary logging state is kept in the client instance.

// ── API Client ─────────────────────────────────────────────────

class ImmichClient {
  private hasLoggedAlbums = false;
  private hasWarnedNoCredentials = false;
  private pendingAlbumsPromise: Promise<ImmichAlbum[]> | null = null;
  private pendingAlbumPromises = new Map<string, Promise<ImmichAlbum | null>>();
  private pendingAssetPromises = new Map<string, Promise<ImmichAsset | null>>();

  private get config() {
    return getConfig();
  }

  /**
   * Whether a request to Immich is possible at all.
   *
   * Deliberately *not* `needsSetup`: a deployment with credentials but no
   * gallery.yaml can talk to Immich perfectly well, and the admin panel depends
   * on that to browse albums before the file exists. Gating on `needsSetup`
   * made every call return null before the fetch, so `ping()` reported the
   * server as disconnected without a single line in the log (#507).
   */
  private get hasCredentials(): boolean {
    const { apiUrl, apiKey } = this.config.immich;
    return !!apiUrl && !!apiKey;
  }

  /** Says once why nothing is being requested, rather than failing in silence. */
  private warnNoCredentials(what: string): void {
    if (this.hasWarnedNoCredentials) return;
    this.hasWarnedNoCredentials = true;
    console.warn(
      `[Immich] No API URL or API key configured — skipping ${what} and every ` +
        'later request. Set IMMICH_API_URL and IMMICH_API_KEY, or run the setup wizard at /install.',
    );
  }

  /** Cache write that carries the configured stale window. */
  private cacheSet<T>(key: string, data: T): void {
    cacheSetWithStale(key, data, this.config.cacheTtl, this.config.staleMaxAge);
  }

  /** See ./immichCache — the policy lives there, testable on its own. */
  private staleOrThrow<T>(cacheKey: string, error: unknown, label: string): T {
    return serveStaleOrThrow<T>(cacheKey, error, label);
  }

  /** For keys that may hold MISSING — a single album or asset. See ./immichCache. */
  private staleOrMissing<T>(cacheKey: string, error: unknown, label: string): T | null {
    return serveStaleOrMissing<T>(cacheKey, error, label);
  }

  /**
   * One JSON request to Immich, with the credentials check in front of it.
   *
   * The request itself lives in ./immichTransport; what belongs here is the
   * decision not to make one at all, which is a question about this
   * deployment rather than about HTTP.
   */
  private async request<T>(endpoint: string, body?: unknown): Promise<T | null> {
    if (!this.hasCredentials) {
      this.warnNoCredentials(endpoint);
      return null;
    }

    return requestJson<T>({
      apiUrl: this.config.immich.apiUrl,
      apiKey: this.config.immich.apiKey,
      timeoutMs: this.config.immichTimeoutMs,
      endpoint,
      body,
    });
  }

  /**
   * Stream a video from Immich with optional Range header forwarding.
   * Range support is required for `<video>` seeking in browsers.
   */
  async streamVideo(
    assetId: string,
    rangeHeader?: string | null,
  ): Promise<{
    stream: ReadableStream;
    contentType: string;
    contentLength: string | null;
    contentRange: string | null;
    status: 200 | 206;
  } | null> {
    if (!this.hasCredentials) return null;

    const endpoint = `/assets/${encodeURIComponent(assetId)}/video/playback`;
    const url = `${this.config.immich.apiUrl}${endpoint}`;

    // Bound the wait for response *headers* only. The `finally` clears the timer
    // the moment they arrive, so the body may then stream for as long as it
    // needs — a whole-request timeout would truncate playback mid-video and
    // break seeking, since every range request would restart the clock.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.immichTimeoutMs);

    try {
      const headers: Record<string, string> = {
        'x-api-key': this.config.immich.apiKey,
      };
      if (rangeHeader) {
        headers['Range'] = rangeHeader;
      }

      const res = await fetch(url, { headers, signal: controller.signal });

      if (!res.ok && res.status !== 206) {
        console.error(`[Immich] Failed to stream video ${assetId}: ${res.status}`);
        // Neither branch below reads the body — an unconsumed one keeps its
        // socket out of undici's pool until GC finalises it (#635).
        await res.body?.cancel();
        if (res.status !== 404 && res.status !== 410) {
          throw new ImmichUnavailableError(
            `Immich returned ${res.status} streaming video ${assetId}`,
            res.status,
          );
        }
        return null;
      }

      if (!res.body) {
        throw new ImmichUnavailableError(`Immich returned an empty body for video ${assetId}`);
      }

      return {
        stream: res.body,
        contentType: res.headers.get('Content-Type') || 'video/mp4',
        contentLength: res.headers.get('Content-Length'),
        contentRange: res.headers.get('Content-Range'),
        status: res.status === 206 ? 206 : 200,
      };
    } catch (error) {
      if (error instanceof ImmichUnavailableError) throw error;
      console.error(
        isTimeout(error)
          ? `[Immich] Video ${assetId} did not respond within ${this.config.immichTimeoutMs}ms`
          : `[Immich] Video stream error for ${assetId}:`,
        error,
      );
      throw new ImmichUnavailableError(
        isTimeout(error)
          ? `Immich did not respond within ${this.config.immichTimeoutMs}ms for video ${assetId}`
          : `Cannot reach Immich to stream video ${assetId}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Stream a binary response from Immich (for image proxying).
   */
  async streamAsset(
    assetId: string,
    size: ImageSize = 'preview',
  ): Promise<{ stream: ReadableStream; contentType: string; contentLength: string | null } | null> {
    if (!this.hasCredentials) return null;

    const endpoint =
      size === 'original'
        ? `/assets/${encodeURIComponent(assetId)}/original`
        : `/assets/${encodeURIComponent(assetId)}/thumbnail?size=${size}`;

    const url = `${this.config.immich.apiUrl}${endpoint}`;

    // Headers-only timeout, same reasoning as streamVideo: an original-size
    // photo is legitimately slow to transfer and must not be capped.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.immichTimeoutMs);

    try {
      const res = await fetch(url, {
        headers: {
          'x-api-key': this.config.immich.apiKey,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        console.error(`[Immich] Failed to stream ${assetId}: ${res.status}`);
        // Neither branch below reads the body — an unconsumed one keeps its
        // socket out of undici's pool until GC finalises it (#635).
        await res.body?.cancel();
        if (res.status !== 404 && res.status !== 410) {
          throw new ImmichUnavailableError(
            `Immich returned ${res.status} streaming asset ${assetId}`,
            res.status,
          );
        }
        return null;
      }

      if (!res.body) {
        throw new ImmichUnavailableError(`Immich returned an empty body for asset ${assetId}`);
      }

      return {
        stream: res.body,
        contentType: res.headers.get('Content-Type') || 'application/octet-stream',
        contentLength: res.headers.get('Content-Length'),
      };
    } catch (error) {
      if (error instanceof ImmichUnavailableError) throw error;
      console.error(
        isTimeout(error)
          ? `[Immich] Asset ${assetId} did not respond within ${this.config.immichTimeoutMs}ms`
          : `[Immich] Stream error for ${assetId}:`,
        error,
      );
      throw new ImmichUnavailableError(
        isTimeout(error)
          ? `Immich did not respond within ${this.config.immichTimeoutMs}ms for asset ${assetId}`
          : `Cannot reach Immich to stream asset ${assetId}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Get ALL configured albums (filtered by the full allowlist).
   * Uses ?shared=true to only fetch albums that have been shared in Immich.
   */
  async getAlbums(forceFresh = false): Promise<ImmichAlbum[]> {
    const cacheKey = 'albums-list';
    // forceFresh only skips the read below; it must not delete the entry
    // outright. Deleting first meant a request that then failed left every
    // later visitor with nothing to fall back to — staleOrThrow() below reads
    // from the same key, so the old entry has to survive until cacheSet()
    // overwrites it on success.
    if (!forceFresh) {
      const cached = cache.get<ImmichAlbum[]>(cacheKey);
      if (cached) return cached;
    }

    if (this.pendingAlbumsPromise) {
      return this.pendingAlbumsPromise;
    }

    this.pendingAlbumsPromise = (async () => {
      try {
        const all = await this.request<ImmichAlbum[]>('/albums?shared=true');
        if (!all) return [];

        const allowedIds = new Set(this.config.albums);
        const filtered = all
          .filter((album) => allowedIds.has(album.id))
          .map((album) => {
            const name = this.config.albumOverrides[album.id] ?? album.albumName;
            const description = this.config.albumDescriptions[album.id] ?? album.description ?? '';
            return {
              ...album,
              albumName: name,
              description,
              slug: albumSlug(name, album.id),
            };
          });

        // Log album summary on first load so admins can see what's published
        if (!this.hasLoggedAlbums) {
          this.hasLoggedAlbums = true;
          console.log('\n[Lightbox] Published albums:');
          console.log('─'.repeat(80));

          // Log standalone albums
          const standaloneIds = new Set(this.config.standaloneAlbums);
          const standalone = filtered.filter((a) => standaloneIds.has(a.id));
          if (standalone.length > 0) {
            console.log('  Standalone:');
            for (const a of standalone) {
              console.log(`    📷 ${a.albumName}`);
              console.log(`       URL: /${a.slug}  •  ${a.assetCount} photos  •  ID: ${a.id}`);
            }
          }

          // Log subpage groupings
          for (const sp of this.config.subpages) {
            const spAlbums = filtered.filter((a) => sp.albumIds.includes(a.id));
            console.log(`  📁 ${sp.name} (/${sp.slug}):`);
            for (const a of spAlbums) {
              console.log(`    📷 ${a.albumName}`);
              console.log(`       URL: /${sp.slug}/${a.slug}  •  ${a.assetCount} photos`);
            }
          }

          const missing = this.config.albums.filter((id) => !all.some((a) => a.id === id));
          if (missing.length > 0) {
            console.warn(`  ⚠️  Unknown album IDs: ${missing.join(', ')}`);
          }
          console.log('─'.repeat(80) + '\n');
        }

        // Not while the install is unfinished. The dummy setup config carries an
        // empty allowlist, so `filtered` is [] no matter what Immich returned —
        // and caching that outlives the wizard that fixes it, because
        // invalidateAll() runs in the install route's own module instance
        // (Next bundles each route separately; see lib/install.ts). The gallery
        // then looks empty until the server restarts.
        if (!this.config.needsSetup) {
          this.cacheSet(cacheKey, filtered);
        }
        return filtered;
      } catch (error) {
        return this.staleOrThrow<ImmichAlbum[]>(cacheKey, error, 'album list');
      } finally {
        this.pendingAlbumsPromise = null;
      }
    })();

    return this.pendingAlbumsPromise;
  }

  /**
   * Get only standalone albums (not in any subpage) — for the homepage.
   */
  async getStandaloneAlbums(forceFresh = false): Promise<ImmichAlbum[]> {
    const albums = await this.getAlbums(forceFresh);
    // The API returns albums in its own order; gallery.yaml order wins.
    const orderIdx = new Map(this.config.standaloneAlbums.map((id, i) => [id, i]));
    return albums
      .filter((a) => orderIdx.has(a.id))
      .sort((a, b) => orderIdx.get(a.id)! - orderIdx.get(b.id)!);
  }

  /**
   * Get enriched subpage summaries for the homepage.
   */
  async getSubpages(forceFresh = false): Promise<SubpageSummary[]> {
    // hidden (EXPERIMENTAL) drops a subpage from every list this feeds (nav,
    // homepage, hero) while getSubpageAlbums()/isValidSubpage() still resolve
    // it — unlike enabled:false, which 404s the page entirely.
    const activeSubpages = this.config.subpages.filter(
      (sp) => sp.enabled !== false && sp.hidden !== true,
    );
    if (activeSubpages.length === 0) return [];

    const albums = await this.getAlbums(forceFresh);
    const albumMap = new Map(albums.map((a) => [a.id, a]));

    return activeSubpages.map((sp) => {
      const spAlbums = sp.albumIds
        .map((id) => albumMap.get(id))
        .filter((a): a is ImmichAlbum => a !== undefined);

      return {
        name: sp.name,
        slug: sp.slug,
        albumCount: spAlbums.length,
        totalAssetCount: spAlbums.reduce((sum, a) => sum + a.assetCount, 0),
        coverAssetId: spAlbums[0]?.albumThumbnailAssetId ?? null,
      };
    });
  }

  /**
   * Get albums belonging to a specific subpage.
   */
  async getSubpageAlbums(
    subpageSlug: string,
    forceFresh = false,
  ): Promise<{ subpage: SubpageConfig; albums: ImmichAlbum[] } | null> {
    const wanted = normalizeSlug(subpageSlug);
    const subpage = this.config.subpages.find((sp) => sp.slug === wanted && sp.enabled !== false);
    if (!subpage) return null;

    const allAlbums = await this.getAlbums(forceFresh);
    const subpageAlbumIds = new Set(subpage.albumIds);
    const albums = allAlbums.filter((a) => subpageAlbumIds.has(a.id));

    return { subpage, albums };
  }

  /**
   * Get a single album with its assets.
   */
  /**
   * Fetch every asset belonging to an album.
   *
   * Immich 3.x no longer embeds assets in `GET /albums/:id` — the response
   * still carries `assetCount` but `assets` comes back empty, and
   * `?withoutAssets=false` does not change that. Metadata search is the
   * supported replacement.
   *
   * `withExif` is required: without it the response omits `exifInfo`, and the
   * grid (aspect ratios), the lightbox EXIF panel and the map (GPS) all go
   * blank even though the images themselves load.
   */
  private async fetchAlbumAssets(albumId: string): Promise<ImmichAsset[]> {
    const PAGE_SIZE = 1000; // Immich rejects size > 1000 with a validation error
    const MAX_PAGES = 100; // Backstop against a malformed nextPage looping forever
    const assets: ImmichAsset[] = [];
    let page = 1;

    for (let i = 0; i < MAX_PAGES; i++) {
      const res = await this.request<{
        assets?: { items?: ImmichAsset[]; nextPage?: string | null };
      }>('/search/metadata', {
        albumIds: [albumId],
        withExif: true,
        size: PAGE_SIZE,
        page,
      });

      const items = res?.assets?.items;
      if (!items?.length) break;
      assets.push(...items);

      // nextPage is a string page number, or null on the last page. The
      // response's `total` only counts the current page, so it cannot bound
      // this loop.
      const next = Number(res?.assets?.nextPage);
      if (!Number.isFinite(next) || next <= page) break;
      page = next;
    }

    return assets;
  }

  /**
   * Every asset of an album, in the album's canonical Immich order, bypassing
   * the allowlist.
   *
   * For the admin panel only. `getAlbum()` refuses albums that are not in the
   * saved config, which is right for the public site but wrong for the page
   * builder: an album just dragged in has not been saved yet, so the picker
   * and the reorder editor would come up empty. Admin auth is the gate here.
   */
  async getAlbumAssetsRaw(albumId: string): Promise<ImmichAsset[]> {
    const [album, assets] = await Promise.all([
      this.request<ImmichAlbum>(`/albums/${encodeURIComponent(albumId)}`),
      this.fetchAlbumAssets(albumId),
    ]);
    if (!album) return [];

    // Same order the site would render under `sort: immich`. The reorder
    // editor's baseline has to match it exactly, or the assets it shows as
    // "follows automatically" would not be the ones that actually follow.
    return assets
      .filter((a) => !a.isTrashed)
      .sort(compareByCaptureTime(album.order === 'asc' ? 1 : -1));
  }

  /**
   * Apply the album's configured sort on the way out.
   *
   * Deliberately not folded into the cached load: the LRU holds one canonical
   * Immich-ordered copy per album, so the mode never has to enter the cache key
   * and a config change takes effect without depending on invalidation.
   *
   * The clone is load-bearing. `cache.get()` hands back the stored object by
   * reference, so sorting `album.assets` here would permanently reorder the
   * cached entry — and under request coalescing every concurrent caller would
   * be sorting the same array.
   */
  private withSort(album: ImmichAlbum): ImmichAlbum {
    const mode = this.config.albumSortModes[album.id] ?? DEFAULT_ALBUM_SORT;
    return {
      ...album,
      assets: sortAlbumAssets(album.assets, {
        mode,
        immichOrder: album.order,
        manualOrder: this.config.albumManualOrders[album.id],
      }),
    };
  }

  async getAlbum(albumId: string, forceFresh = false): Promise<ImmichAlbum | null> {
    const album = await this.loadAlbum(albumId, forceFresh);
    return album ? this.withSort(album) : null;
  }

  /**
   * An album for a client proofing link, whether or not it is published.
   *
   * Client galleries are usually not part of the public portfolio, so the
   * allowlist cannot be the gate here. The proofing session is: callers reach
   * this only after resolving a valid, unexpired session token, and pass that
   * session's own album ID — never one taken from the request.
   */
  async getProofingAlbum(albumId: string): Promise<ImmichAlbum | null> {
    const album = await this.loadAlbum(albumId, false, true);
    return album ? this.withSort(album) : null;
  }

  /** The cached load. Always yields the canonical Immich order; see withSort(). */
  private async loadAlbum(
    albumId: string,
    forceFresh: boolean,
    /** Only for getProofingAlbum(); see there. */
    bypassAllowlist = false,
  ): Promise<ImmichAlbum | null> {
    // Security: only serve configured albums
    if (!bypassAllowlist && !this.config.albums.includes(albumId)) {
      console.warn(`[Immich] Album ${albumId} is not in LIGHTBOX_ALBUMS`);
      return null;
    }

    const cacheKey = `album-${albumId}`;
    // See getAlbums(): forceFresh skips the cached read, it does not delete
    // the entry, so a fetch that then fails still has something to fall back
    // to via staleOrThrow() below.
    if (!forceFresh) {
      const cached = cache.get<ImmichAlbum | Missing>(cacheKey);
      if (cached) return cached === MISSING ? null : (cached as ImmichAlbum);
    }

    if (this.pendingAlbumPromises.has(albumId)) {
      return this.pendingAlbumPromises.get(albumId)!;
    }

    const promise = (async () => {
      try {
        // Metadata and assets come from two different endpoints (see
        // fetchAlbumAssets); they are independent, so fetch them together.
        const [album, assets] = await Promise.all([
          this.request<ImmichAlbum>(`/albums/${encodeURIComponent(albumId)}`),
          this.fetchAlbumAssets(albumId),
        ]);
        if (!album) {
          this.cacheSet(cacheKey, MISSING);
          return null;
        }

        // An album that Immich says has photos but returns none is almost
        // always a server older than 3.0, where metadata search behaves
        // differently. Say so instead of rendering a silently empty gallery.
        if (album.assetCount > 0 && assets.length === 0) {
          console.warn(
            `[Immich] Album "${album.albumName}" reports ${album.assetCount} assets but the metadata search returned none. ` +
              `Immich Folio requires Immich 3.0 or newer.`,
          );
        }

        // Filter out trashed assets
        album.assets = assets.filter((a) => !a.isTrashed);

        // The album endpoint used to return assets in the album's configured
        // order. Metadata search happens to default to fileCreatedAt desc, but
        // that is not contractual — sort explicitly so 'asc' albums are right.
        //
        // This is the *canonical* order, and it is what goes into the cache.
        // A configured per-album sort is applied later, on the way out of
        // getAlbum(); see withSort().
        album.assets.sort(compareByCaptureTime(album.order === 'asc' ? 1 : -1));

        const name = this.config.albumOverrides[album.id] ?? album.albumName;
        const description = this.config.albumDescriptions[album.id] ?? album.description ?? '';
        album.albumName = name;
        album.description = description;
        album.slug = albumSlug(name, album.id);

        this.cacheSet(cacheKey, album);
        return album;
      } catch (error) {
        return this.staleOrMissing<ImmichAlbum>(cacheKey, error, `album ${albumId}`);
      } finally {
        this.pendingAlbumPromises.delete(albumId);
      }
    })();

    this.pendingAlbumPromises.set(albumId, promise);
    return promise;
  }

  /**
   * Find an album by its URL slug.
   *
   * The search set follows the route, never the whole allowlist: with a
   * subpageSlug it is that subpage's albums, without one it is the standalone
   * albums. `config.albums` is the union of both, so searching it for a
   * top-level slug would answer for an album whose only route is a subpage —
   * past that subpage's password, and past `enabled: false`.
   */
  async getAlbumBySlug(
    slug: string,
    subpageSlug?: string,
    forceFresh = false,
  ): Promise<ImmichAlbum | null> {
    const albums = await this.getAlbums(forceFresh);

    let routeIds: Set<string>;
    if (subpageSlug) {
      const wantedSubpage = normalizeSlug(subpageSlug);
      const subpage = this.config.subpages.find(
        (sp) => sp.slug === wantedSubpage && sp.enabled !== false,
      );
      if (!subpage) return null;
      routeIds = new Set(subpage.albumIds);
    } else {
      routeIds = new Set(this.config.standaloneAlbums);
    }
    const searchSet = albums.filter((a) => routeIds.has(a.id));

    const wanted = normalizeSlug(slug);
    const match = searchSet.find((a) => a.slug === wanted);
    if (!match) return null;
    return this.getAlbum(match.id, forceFresh);
  }

  /**
   * Check if a slug corresponds to a subpage.
   */
  isSubpageSlug(slug: string): boolean {
    const wanted = normalizeSlug(slug);
    return this.config.subpages.some((sp) => sp.slug === wanted && sp.enabled !== false);
  }

  /**
   * Get asset info including EXIF data.
   */
  async getAssetInfo(assetId: string): Promise<ImmichAsset | null> {
    const cacheKey = `asset-${assetId}`;
    const cached = cache.get<ImmichAsset | Missing>(cacheKey);
    if (cached) return cached === MISSING ? null : (cached as ImmichAsset);

    // ⚡ Bolt: Deduplicate concurrent requests for the same asset ID.
    // If a request for this asset is already in flight (e.g. from Promise.all in a grid),
    // return the pending promise instead of triggering a redundant API call.
    if (this.pendingAssetPromises.has(assetId)) {
      return this.pendingAssetPromises.get(assetId)!;
    }

    const promise = (async () => {
      try {
        const asset = await this.request<ImmichAsset>(`/assets/${encodeURIComponent(assetId)}`);
        if (!asset) {
          // The homepage looks up every gallery.yaml hero ID on each render
          // (app/page.tsx), and those pages are force-dynamic — so a hero photo
          // deleted from Immich otherwise costs an upstream 404 every time.
          this.cacheSet(cacheKey, MISSING);
          return null;
        }

        this.cacheSet(cacheKey, asset);
        return asset;
      } catch (error) {
        return this.staleOrMissing<ImmichAsset>(cacheKey, error, `asset ${assetId}`);
      } finally {
        this.pendingAssetPromises.delete(assetId);
      }
    })();

    this.pendingAssetPromises.set(assetId, promise);
    return promise;
  }

  /**
   * Invalidate the cache for a specific album (by Immich UUID) and the
   * shared albums-list entry. Called by the webhook handler after an
   * album.updated / album.assetAdded event from Immich.
   */
  invalidateAlbum(albumId: string): void {
    cache.delete(`album-${albumId}`);
    cache.delete('albums-list');
    console.log(`[Immich] 🔄 Cache invalidated for album ${albumId}`);
  }

  /**
   * Invalidate all album caches at once (e.g. on a full sync event).
   */
  invalidateAll(): void {
    cache.clear();
    this.hasLoggedAlbums = false;
    console.log('[Immich] 🔄 Full cache cleared');
  }

  /**
   * Check if the Immich server is reachable.
   */
  async ping(): Promise<boolean> {
    try {
      const res = await this.request<{ res: string }>('/server/ping');
      return !!res;
    } catch (error) {
      // "Is Immich reachable?" — unreachable is the answer, not an exception.
      // Both callers (/api/health, /api/admin/status) render this as a status.
      // It is still logged: a red badge in the admin panel with nothing in the
      // log leaves the operator guessing (#507).
      console.warn('[Immich] Ping failed:', error);
      return false;
    }
  }
}

export const immich = new ImmichClient();
