/**
 * Immich assets → the PhotoItem props the grid and lightbox render.
 *
 * Shared by the album routes and the client proofing page, so both render a
 * photo exactly the same way.
 */

import type { ImmichAsset } from '@/lib/immich';
import { encodeAssetId } from '@/lib/tokens';
import {
  assetAspectRatio,
  assetCaption,
  assetExifSummary,
  assetPlaceholder,
  downloadUrl,
  exifUrl,
  imageUrl,
  videoUrl,
  zoomUrl,
} from '@/lib/urls';
import { zoomDimensions, zoomSourceFor } from '@/lib/zoomSource';
import type { PhotoItem } from './PhotoGrid';

/**
 * `showExif` covers the hover overlay only, and that overlay carries camera,
 * lens and focal length — so it follows the `camera` group, not the panel.
 *
 * `showCaption` follows the `caption` group and decides whether the Immich
 * description becomes alt text; see `assetCaption`.
 */
export function toPhotoItems(
  assets: ImmichAsset[],
  showExif: boolean,
  showCaption: boolean,
  /** The album offering downloads, or undefined when it does not. */
  downloadAlbumId?: string,
  /**
   * The album whose page offers lightbox zoom, or undefined when zoom resolves
   * off for it (#467). Each photo still has to be zoomable on its own.
   */
  zoomAlbumId?: string,
): PhotoItem[] {
  return assets
    .filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO')
    .map((a) => {
      const ph = assetPlaceholder(a);
      const exif = showExif && a.type === 'IMAGE' ? assetExifSummary(a) : undefined;
      const caption = assetCaption(a, showCaption);
      const isVideo = a.type === 'VIDEO';
      const zoomSize = zoomAlbumId && zoomSourceFor(a) ? zoomDimensions(a) : undefined;
      return {
        id: encodeAssetId(a.id),
        type: isVideo ? 'video' : 'image',
        thumbUrl: imageUrl(a, 'preview'),
        previewUrl: imageUrl(a, 'preview'),
        ...(isVideo ? { videoUrl: videoUrl(a.id) } : {}),
        exifUrl: exifUrl(a.id),
        ...(ph ? { blurDataURL: ph.blurDataURL, dominantColor: ph.dominantColor } : {}),
        ...(exif ?? {}),
        ...(caption ? { caption } : {}),
        ...(downloadAlbumId ? { downloadUrl: downloadUrl(downloadAlbumId, a.id) } : {}),
        ...(zoomAlbumId && zoomSize
          ? {
              zoomUrl: zoomUrl(zoomAlbumId, a.id),
              zoomWidth: zoomSize.width,
              zoomHeight: zoomSize.height,
            }
          : {}),
        aspectRatio: assetAspectRatio(a),
      };
    });
}
