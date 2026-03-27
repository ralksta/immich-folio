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

  private get config() {
    return getConfig();
  }

  private async request<T>(endpoint: string): Promise<T | null> {
    if (this.config.needsSetup) return null;

    const url = `${this.config.immich.apiUrl}${endpoint}`;
    try {
      const res = await fetch(url, {
        headers: {
          'x-api-key': this.config.immich.apiKey,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        console.error(`[Immich] ${res.status} ${res.statusText} for ${endpoint}`);
        return null;
      }

      const contentType = res.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        return (await res.json()) as T;
      }
      return null;
    } catch (error) {
      console.error(`[Immich] Failed to reach ${url}:`, error);
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
            return {
              ...album,
              albumName: name,
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
    const standaloneIds = new Set(this.config.standaloneAlbums);
    return albums.filter((a) => standaloneIds.has(a.id));
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
  async getAlbum(albumId: string): Promise<ImmichAlbum | null> {
    // Security: only serve configured albums
    if (!this.config.albums.includes(albumId)) {
      console.warn(`[Immich] Album ${albumId} is not in LIGHTBOX_ALBUMS`);
      return null;
    }

    const cacheKey = `album-${albumId}`;
    const cached = cache.get<ImmichAlbum>(cacheKey);
    if (cached) return cached;

    const album = await this.request<ImmichAlbum>(`/albums/${encodeURIComponent(albumId)}`);
    if (!album) return null;

    // Filter out trashed assets
    album.assets = (album.assets || []).filter((a) => !a.isTrashed);

    const name = this.config.albumOverrides[album.id] ?? album.albumName;
    album.albumName = name;
    album.slug = slugify(name);

    cache.set(cacheKey, album, this.config.cacheTtl);
    return album;
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

    const asset = await this.request<ImmichAsset>(`/assets/${encodeURIComponent(assetId)}`);
    if (!asset) return null;

    cache.set(cacheKey, asset, this.config.cacheTtl);
    return asset;
  }

  /**
   * Check if the Immich server is reachable.
   */
  async ping(): Promise<boolean> {
    const res = await this.request<{ res: string }>('/server/ping');
    return !!res;
  }
}

export const immich = new ImmichClient();
