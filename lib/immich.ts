/**
 * Server-only Immich API client.
 * Inspired by immich-public-proxy's approach but uses API key auth
 * to access specific albums rather than shared link keys.
 *
 * API key never leaves the server — all client-facing image
 * requests go through our proxy route.
 */

import { getConfig, slugify, type SubpageConfig } from './config';
import { cache } from './cache';

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
  exifInfo?: ImmichExifInfo;
  isTrashed: boolean;
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
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  dateTimeOriginal: string | null;
  description: string | null;
}

export type ImageSize = 'thumbnail' | 'preview' | 'original';

/**
 * Thrown when Immich could not answer: transport failure, an error status, or
 * a non-JSON body where JSON was requested.
 *
 * This is deliberately distinct from a `null` return, which means Immich *did*
 * answer and said the resource does not exist. Conflating the two made every
 * album URL render a hard 404 while Immich was down — including albums that
 * exist — because the page calls `notFound()` on a null album. Only 404/410
 * are treated as "gone"; everything else is an outage and must surface as one.
 */
export class ImmichUnavailableError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ImmichUnavailableError';
    this.status = status;
  }
}

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
  private pendingAlbumsPromise: Promise<ImmichAlbum[]> | null = null;
  private pendingAlbumPromises = new Map<string, Promise<ImmichAlbum | null>>();
  private pendingAssetPromises = new Map<string, Promise<ImmichAsset | null>>();

  private get config() {
    return getConfig();
  }

  private async request<T>(endpoint: string, body?: unknown): Promise<T | null> {
    if (this.config.needsSetup) return null;

    const url = `${this.config.immich.apiUrl}${endpoint}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'x-api-key': this.config.immich.apiKey,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      console.error(`[Immich] Failed to reach ${url}:`, error);
      throw new ImmichUnavailableError(`Cannot reach Immich for ${endpoint}`);
    }

    if (!res.ok) {
      console.error(`[Immich] ${res.status} ${res.statusText} for ${endpoint}`);
      // Only "gone" means gone. A 5xx, a rate limit, or a rejected API key all
      // mean Immich cannot serve us right now — rendering those as a missing
      // album would tell visitors and crawlers the content no longer exists.
      if (res.status !== 404 && res.status !== 410) {
        throw new ImmichUnavailableError(
          `Immich returned ${res.status} ${res.statusText} for ${endpoint}`,
          res.status,
        );
      }
      return null;
    }

    const contentType = res.headers.get('Content-Type') || '';
    if (!contentType.includes('application/json')) {
      // We always send Accept: application/json. Anything else is a gateway or
      // proxy error page, not a valid answer about the resource.
      throw new ImmichUnavailableError(
        `Immich returned non-JSON (${contentType || 'no Content-Type'}) for ${endpoint}`,
      );
    }

    try {
      return (await res.json()) as T;
    } catch (error) {
      console.error(`[Immich] Malformed JSON from ${url}:`, error);
      throw new ImmichUnavailableError(`Immich returned malformed JSON for ${endpoint}`);
    }
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
    if (this.config.needsSetup || !this.config.immich.apiUrl) return null;

    const endpoint = `/assets/${encodeURIComponent(assetId)}/video/playback`;
    const url = `${this.config.immich.apiUrl}${endpoint}`;
    try {
      const headers: Record<string, string> = {
        'x-api-key': this.config.immich.apiKey,
      };
      if (rangeHeader) {
        headers['Range'] = rangeHeader;
      }

      const res = await fetch(url, { headers });

      if ((!res.ok && res.status !== 206) || !res.body) {
        console.error(`[Immich] Failed to stream video ${assetId}: ${res.status}`);
        return null;
      }

      return {
        stream: res.body,
        contentType: res.headers.get('Content-Type') || 'video/mp4',
        contentLength: res.headers.get('Content-Length'),
        contentRange: res.headers.get('Content-Range'),
        status: res.status === 206 ? 206 : 200,
      };
    } catch (error) {
      console.error(`[Immich] Video stream error for ${assetId}:`, error);
      return null;
    }
  }

  /**
   * Stream a binary response from Immich (for image proxying).
   */
  async streamAsset(
    assetId: string,
    size: ImageSize = 'preview',
  ): Promise<{ stream: ReadableStream; contentType: string; contentLength: string | null } | null> {
    if (this.config.needsSetup || !this.config.immich.apiUrl) return null;

    const endpoint =
      size === 'original'
        ? `/assets/${encodeURIComponent(assetId)}/original`
        : `/assets/${encodeURIComponent(assetId)}/thumbnail?size=${size}`;

    const url = `${this.config.immich.apiUrl}${endpoint}`;
    try {
      const res = await fetch(url, {
        headers: {
          'x-api-key': this.config.immich.apiKey,
        },
      });

      if (!res.ok || !res.body) {
        console.error(`[Immich] Failed to stream ${assetId}: ${res.status}`);
        return null;
      }

      return {
        stream: res.body,
        contentType: res.headers.get('Content-Type') || 'application/octet-stream',
        contentLength: res.headers.get('Content-Length'),
      };
    } catch (error) {
      console.error(`[Immich] Stream error for ${assetId}:`, error);
      return null;
    }
  }

  /**
   * Get ALL configured albums (filtered by the full allowlist).
   * Uses ?shared=true to only fetch albums that have been shared in Immich.
   */
  async getAlbums(): Promise<ImmichAlbum[]> {
    const cacheKey = 'albums-list';
    const cached = cache.get<ImmichAlbum[]>(cacheKey);
    if (cached) return cached;

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
              slug: slugify(name),
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

        cache.set(cacheKey, filtered, this.config.cacheTtl);
        return filtered;
      } finally {
        this.pendingAlbumsPromise = null;
      }
    })();

    return this.pendingAlbumsPromise;
  }

  /**
   * Get only standalone albums (not in any subpage) — for the homepage.
   */
  async getStandaloneAlbums(): Promise<ImmichAlbum[]> {
    const albums = await this.getAlbums();
    // The API returns albums in its own order; gallery.yaml order wins.
    const orderIdx = new Map(this.config.standaloneAlbums.map((id, i) => [id, i]));
    return albums
      .filter((a) => orderIdx.has(a.id))
      .sort((a, b) => orderIdx.get(a.id)! - orderIdx.get(b.id)!);
  }

  /**
   * Get enriched subpage summaries for the homepage.
   */
  async getSubpages(): Promise<SubpageSummary[]> {
    if (this.config.subpages.length === 0) return [];

    const albums = await this.getAlbums();
    const albumMap = new Map(albums.map((a) => [a.id, a]));

    return this.config.subpages.map((sp) => {
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
  ): Promise<{ subpage: SubpageConfig; albums: ImmichAlbum[] } | null> {
    const subpage = this.config.subpages.find((sp) => sp.slug === subpageSlug);
    if (!subpage) return null;

    const allAlbums = await this.getAlbums();
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

  async getAlbum(albumId: string): Promise<ImmichAlbum | null> {
    // Security: only serve configured albums
    if (!this.config.albums.includes(albumId)) {
      console.warn(`[Immich] Album ${albumId} is not in LIGHTBOX_ALBUMS`);
      return null;
    }

    const cacheKey = `album-${albumId}`;
    const cached = cache.get<ImmichAlbum>(cacheKey);
    if (cached) return cached;

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
        if (!album) return null;

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
        const dir = album.order === 'asc' ? 1 : -1;
        album.assets.sort(
          (a, b) => dir * (Date.parse(a.fileCreatedAt) - Date.parse(b.fileCreatedAt)),
        );

        const name = this.config.albumOverrides[album.id] ?? album.albumName;
        const description = this.config.albumDescriptions[album.id] ?? album.description ?? '';
        album.albumName = name;
        album.description = description;
        album.slug = slugify(name);

        cache.set(cacheKey, album, this.config.cacheTtl);
        return album;
      } finally {
        this.pendingAlbumPromises.delete(albumId);
      }
    })();

    this.pendingAlbumPromises.set(albumId, promise);
    return promise;
  }

  /**
   * Find an album by its URL slug.
   * If subpageSlug is provided, only search within that subpage's albums.
   */
  async getAlbumBySlug(slug: string, subpageSlug?: string): Promise<ImmichAlbum | null> {
    const albums = await this.getAlbums();

    let searchSet = albums;
    if (subpageSlug) {
      const subpage = this.config.subpages.find((sp) => sp.slug === subpageSlug);
      if (!subpage) return null;
      const subpageIds = new Set(subpage.albumIds);
      searchSet = albums.filter((a) => subpageIds.has(a.id));
    }

    const match = searchSet.find((a) => a.slug === slug);
    if (!match) return null;
    return this.getAlbum(match.id);
  }

  /**
   * Check if a slug corresponds to a subpage.
   */
  isSubpageSlug(slug: string): boolean {
    return this.config.subpages.some((sp) => sp.slug === slug);
  }

  /**
   * Get asset info including EXIF data.
   */
  async getAssetInfo(assetId: string): Promise<ImmichAsset | null> {
    const cacheKey = `asset-${assetId}`;
    const cached = cache.get<ImmichAsset>(cacheKey);
    if (cached) return cached;

    // ⚡ Bolt: Deduplicate concurrent requests for the same asset ID.
    // If a request for this asset is already in flight (e.g. from Promise.all in a grid),
    // return the pending promise instead of triggering a redundant API call.
    if (this.pendingAssetPromises.has(assetId)) {
      return this.pendingAssetPromises.get(assetId)!;
    }

    const promise = (async () => {
      try {
        const asset = await this.request<ImmichAsset>(`/assets/${encodeURIComponent(assetId)}`);
        if (!asset) return null;

        cache.set(cacheKey, asset, this.config.cacheTtl);
        return asset;
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
    } catch {
      // "Is Immich reachable?" — unreachable is the answer, not an exception.
      // Both callers (/api/health, /api/admin/status) render this as a status.
      return false;
    }
  }
}

export const immich = new ImmichClient();
