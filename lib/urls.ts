/**
 * Server-side URL helpers for generating public-facing asset URLs.
 * These use encoded tokens instead of raw Immich UUIDs.
 */

import { encodeAssetId } from './tokens';
import { env } from './env';
import { cdnBase } from './cdn';
import { thumbHashToBlurDataUrl, thumbHashToDominantHex } from './thumbhash';
import type { ImmichAsset } from './immich';
import { formatLens } from './exif';

/**
 * Optional cache-buster, appended to every image and video URL.
 *
 * These responses are served `immutable` for a year, so the browser never
 * revalidates and the ETag is never consulted — the URL is the only thing that
 * can invalidate a browser cache. Setting IMAGE_CACHE_VERSION changes all of
 * them at once, which is what you want after Immich regenerates thumbnails or a
 * photo is rotated: the asset ID does not change, so nothing else would.
 *
 * Empty by default — the returned URLs are then byte-identical to before.
 */
const cacheBuster = env.IMAGE_CACHE_VERSION ? `&v=${env.IMAGE_CACHE_VERSION}` : '';

/** What an image URL needs to know about an asset beyond its ID (#831). */
export interface ImageRef {
  id: string;
  isEdited?: boolean | null;
  updatedAt?: string | null;
}

/**
 * The `e` parameter an edited photo's image URL carries, or null for a photo
 * that is not edited (#831).
 *
 * Immich applies an edit made in its editor (crop, rotate) only when asked
 * with `edited=true`. The image route always asks — the server decides that
 * an edit is shown, not the URL. The marker is purely a cache key: the asset
 * ID does not change when a photo is edited, so without it a browser or CDN
 * that cached the unedited preview under the same URL would keep showing it
 * for a year (`immutable`). Only edited photos get a new URL; every other URL
 * stays as it was, which is why this is not a bump of IMAGE_CACHE_VERSION.
 *
 * The value is the asset's `updatedAt` in whole seconds, base 36 — precise
 * enough to tell two edits apart, without publishing the millisecond. Immich regenerates an
 * asset's thumbnails and ThumbHash (and, for a crop or a quarter turn, its
 * dimensions) when an edit is applied or changed, which writes the asset and
 * moves `updatedAt` — so a re-edit produces a new URL once the album cache
 * (CACHE_TTL) has picked it up. Other updates to an edited photo move it too;
 * that costs one refetch of that photo, nothing more.
 */
export function editMarker(asset: Omit<ImageRef, 'id'>): string | null {
  if (asset.isEdited !== true) return null;
  const time = asset.updatedAt ? Date.parse(asset.updatedAt) : NaN;
  return Number.isFinite(time) && time >= 1000 ? Math.floor(time / 1000).toString(36) : '1';
}

/**
 * Generate a public image proxy URL for an asset. Absolute, on the CDN, when
 * CDN mode is on (lib/cdn.ts); relative otherwise.
 *
 * Pass the asset rather than its ID wherever it is at hand: only then can an
 * edited photo get its edit marker (see editMarker()). A bare ID still shows
 * the edit — the route always asks for it — but under the same URL as before
 * the edit, so a copy cached earlier can outlive it.
 */
export function imageUrl(
  asset: string | ImageRef,
  size: 'thumbnail' | 'preview' | 'original' = 'preview',
): string {
  const ref = typeof asset === 'string' ? { id: asset } : asset;
  const marker = editMarker(ref);
  const edit = marker ? `&e=${marker}` : '';
  return `${cdnBase()}/api/image/${encodeAssetId(ref.id)}?size=${size}${edit}${cacheBuster}`;
}

/**
 * Generate a public EXIF API URL for an asset.
 */
export function exifUrl(assetId: string): string {
  return `/api/exif/${encodeAssetId(assetId)}`;
}

/**
 * Generate a public video proxy URL for an asset — on the CDN in CDN mode,
 * like imageUrl().
 */
export function videoUrl(assetId: string): string {
  // No `size` here, so the buster is the only query parameter.
  const v = cacheBuster ? `?${cacheBuster.slice(1)}` : '';
  return `${cdnBase()}/api/video/${encodeAssetId(assetId)}${v}`;
}

/**
 * Placeholder data derived from an asset's ThumbHash.
 */
export interface PlaceholderData {
  blurDataURL: string;
  dominantColor: string;
}

/**
 * Generate blur placeholder and dominant color from an asset's ThumbHash.
 * Returns null if the asset has no ThumbHash.
 */
export function assetPlaceholder(asset: Pick<ImmichAsset, 'thumbhash'>): PlaceholderData | null {
  if (!asset.thumbhash) return null;
  try {
    return {
      blurDataURL: thumbHashToBlurDataUrl(asset.thumbhash),
      dominantColor: thumbHashToDominantHex(asset.thumbhash),
    };
  } catch {
    return null;
  }
}

/**
 * Compact EXIF summary for hover overlays.
 */
export interface ExifSummary {
  camera?: string;
  lens?: string;
  focalLength?: string;
}

/**
 * Extract a compact EXIF summary from an asset's exifInfo.
 * Returns undefined if no relevant EXIF data is available.
 */
export function assetExifSummary(asset: Pick<ImmichAsset, 'exifInfo'>): ExifSummary | undefined {
  const exif = asset.exifInfo;
  if (!exif) return undefined;

  const camera = exif.model || undefined;
  // A phone's lens names the phone again; the camera is already on the tile.
  const lens = formatLens(exif.lensModel, exif.model) || undefined;
  const focalLength = exif.focalLength ? `${exif.focalLength}mm` : undefined;

  if (!camera && !lens && !focalLength) return undefined;
  return { camera, lens, focalLength };
}

/**
 * The download URL for an original file (#475).
 *
 * Carries the album as well as the asset: the route authorises the download
 * against the album that offered it, and checks the asset really belongs to
 * that album.
 */
export function downloadUrl(albumId: string, assetId: string): string {
  return `/api/download/${encodeAssetId(albumId)}/${encodeAssetId(assetId)}`;
}

/**
 * The full-resolution image the lightbox zooms into (#467).
 *
 * Shaped like downloadUrl() for the same reason: the route authorises the
 * zoom against the album that offered it — allowlist, every password gate,
 * zoom resolved on — and checks the asset belongs to it. Relative even in CDN
 * mode: the answer depends on the visitor's cookies and is `private`, so it
 * must not be cached at the edge.
 */
export function zoomUrl(albumId: string, assetId: string): string {
  return `/api/zoom/${encodeAssetId(albumId)}/${encodeAssetId(assetId)}`;
}

/**
 * The endpoint that streams an album (or a selection of its assets) as a ZIP.
 *
 * Carries only the album: the route re-checks the allowlist, the `download`
 * opt-in and every password gate, exactly like the single-asset download. A
 * `GET` returns the whole album; a `POST` with `{ "assets": [<token>, …] }`
 * returns just those assets.
 */
export function archiveUrl(albumId: string): string {
  return `/api/download/${encodeAssetId(albumId)}/archive`;
}

/**
 * The Immich asset description, trimmed, for use as image alt text.
 *
 * Gated on the `caption` EXIF group rather than served unconditionally. That
 * switch exists because the description is the one field that can hold private
 * notes (#506), and an alt attribute publishes it to crawlers and view-source
 * exactly as a visible caption would. A site that has switched captions off has
 * said it does not want that text on the page.
 *
 * Returns undefined when there is nothing to say, which leaves `alt=""` — the
 * correct markup for a decorative image, and better than inventing filler.
 */
export function assetCaption(
  asset: Pick<ImmichAsset, 'exifInfo'>,
  showCaption: boolean,
): string | undefined {
  if (!showCaption) return undefined;
  return asset.exifInfo?.description?.trim() || undefined;
}

/**
 * EXIF orientations that rotate the frame a quarter turn.
 *
 * Most cameras expose the sensor in landscape whatever way the body is held,
 * and record the rotation as a flag rather than rewriting the pixels. So a
 * portrait frame arrives as 7008x4672 with orientation 6, and the browser turns
 * it upright on display. Taking the stored dimensions at face value would call
 * that photo landscape.
 *
 * 1-4 are upright or mirrored in place and leave the ratio alone; 5-8 all carry
 * a 90 degree turn, so width and height swap.
 */
const ROTATED_ORIENTATIONS = new Set([5, 6, 7, 8]);

/**
 * Compute the natural aspect ratio (width / height) from EXIF dimensions,
 * as the image is displayed rather than as it is stored.
 * Returns undefined if dimensions are not available.
 *
 * A photo edited in Immich (#831) is the exception: its EXIF still describes
 * the file as stored, before a crop or a quarter turn, while the edited
 * rendition Folio shows has other proportions. Immich's top-level
 * `width`/`height` are the edited, upright size, so those are used for it.
 */
export function assetAspectRatio(
  asset: Pick<ImmichAsset, 'exifInfo' | 'isEdited' | 'width' | 'height'>,
): number | undefined {
  if (asset.isEdited === true) {
    // Without the edited size there is nothing right to say: EXIF would give
    // the unedited proportions. Undefined leaves the layout's default ratio.
    return asset.width && asset.height && asset.width > 0 && asset.height > 0
      ? asset.width / asset.height
      : undefined;
  }
  const w = asset.exifInfo?.exifImageWidth;
  const h = asset.exifInfo?.exifImageHeight;
  if (!w || !h || h <= 0) return undefined;

  // Immich reports the flag as a string; anything unparseable is left upright.
  const orientation = Number(asset.exifInfo?.orientation);
  return ROTATED_ORIENTATIONS.has(orientation) ? h / w : w / h;
}
