/**
 * Server-side URL helpers for generating public-facing asset URLs.
 * These use encoded tokens instead of raw Immich UUIDs.
 */

import { encodeAssetId } from './tokens';
import { env } from './env';
import { thumbHashToBlurDataUrl, thumbHashToDominantHex } from './thumbhash';
import type { ImmichAsset } from './immich';

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

/**
 * Generate a public image proxy URL for an asset.
 */
export function imageUrl(
  assetId: string,
  size: 'thumbnail' | 'preview' | 'original' = 'preview',
): string {
  return `/api/image/${encodeAssetId(assetId)}?size=${size}${cacheBuster}`;
}

/**
 * Generate a public EXIF API URL for an asset.
 */
export function exifUrl(assetId: string): string {
  return `/api/exif/${encodeAssetId(assetId)}`;
}

/**
 * Generate a public video proxy URL for an asset.
 */
export function videoUrl(assetId: string): string {
  // No `size` here, so the buster is the only query parameter.
  const v = cacheBuster ? `?${cacheBuster.slice(1)}` : '';
  return `/api/video/${encodeAssetId(assetId)}${v}`;
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
  const lens = exif.lensModel || undefined;
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
 * Compute the natural aspect ratio (width / height) from EXIF dimensions.
 * Returns undefined if dimensions are not available.
 */
export function assetAspectRatio(asset: Pick<ImmichAsset, 'exifInfo'>): number | undefined {
  const w = asset.exifInfo?.exifImageWidth;
  const h = asset.exifInfo?.exifImageHeight;
  if (w && h && h > 0) return w / h;
  return undefined;
}
