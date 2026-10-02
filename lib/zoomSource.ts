/**
 * Which file the lightbox zoom (#467) may show for an asset, if any.
 *
 * Decided from what the album response already carries — the original's MIME
 * type, else its file extension — so the page knows without asking Immich.
 *
 *   - `original`: JPEG and AVIF. The browser shows them as they are, and
 *     lib/locationScrub.ts removes GPS and sub-city place names from both on
 *     the way through.
 *   - `fullsize`: formats a browser cannot show (HEIC/HEIF, RAW/DNG, TIFF,
 *     JPEG XL, …). Immich's full-size rendition is a JPEG it renders from the
 *     original, at the original's resolution — but only when "full-size
 *     preview" is enabled in Immich's image settings and the asset has been
 *     processed since. Whether it exists is not in the album response, so the
 *     zoom route asks Immich when the visitor zooms and answers 404 when there
 *     is none; the lightbox then says so and stays on the preview.
 *   - `edited`: photos edited in Immich's editor (crop, rotate), whatever
 *     their format (#831). Their original is the unedited file — whatever a
 *     crop removed is still in it — so it is never used. Measured against
 *     Immich 3.2, `thumbnail?size=fullsize&edited=true` is the edited photo at
 *     full resolution, a JPEG without EXIF, and it exists whether or not
 *     full-size previews are switched on. The preview Folio shows carries the
 *     same edit, so the two share their geometry.
 *   - `null`: not zoomable. Videos. And PNG, WebP and GIF: the browser could
 *     show those originals, but the scrubber does not edit their metadata
 *     (eXIf/iTXt chunks, RIFF EXIF/XMP chunks), so they would go out with any
 *     GPS they carry. Immich has no rendition to fall back on either — its
 *     full-size endpoint redirects web-compatible formats to the original.
 *
 * Client-safe: no `fs`, no Immich client.
 */

export type ZoomSource = 'original' | 'fullsize' | 'edited';

/** Originals served as they are (after scrubbing). */
const ORIGINAL_MIME = new Set(['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/avif']);
const ORIGINAL_EXT = /\.(jpe?g|jpe|jfif|avif)$/i;

/** Browser-displayable, but their metadata is not scrubbed: never zoomed. */
const UNSCRUBBED_MIME = new Set([
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/apng',
]);
const UNSCRUBBED_EXT = /\.(png|apng|webp|gif|svg)$/i;

/** What the zoom route may send back: the formats the two sources produce. */
export const ZOOM_CONTENT_TYPES: ReadonlySet<string> = new Set(['image/jpeg', 'image/avif']);

export function zoomSourceFor(asset: {
  type?: string;
  originalMimeType?: string | null;
  originalFileName?: string | null;
  isEdited?: boolean | null;
}): ZoomSource | null {
  if (asset.type !== 'IMAGE') return null;
  if (asset.isEdited === true) return 'edited';
  const mime = asset.originalMimeType?.toLowerCase().split(';')[0].trim();
  if (mime) {
    if (ORIGINAL_MIME.has(mime)) return 'original';
    if (UNSCRUBBED_MIME.has(mime)) return null;
    return mime.startsWith('image/') ? 'fullsize' : null;
  }
  const name = asset.originalFileName ?? '';
  if (ORIGINAL_EXT.test(name)) return 'original';
  if (UNSCRUBBED_EXT.test(name)) return null;
  // No type and no recognisable extension: not enough to go on.
  return /\.[a-z0-9]+$/i.test(name) ? 'fullsize' : null;
}

const ROTATED_ORIENTATIONS = new Set([5, 6, 7, 8]);

/**
 * The zoom image's pixel size as the browser will report it — upright, after
 * the EXIF orientation is applied. The lightbox needs it before the file has
 * loaded, so the first gesture can go straight to 1:1.
 *
 * Immich's top-level `width`/`height` are already upright, and for a photo
 * edited in Immich they are the edited size — the size of the `edited`
 * source; EXIF dimensions are as stored and are turned here. Undefined when neither is known — the asset
 * is then not offered for zoom.
 */
export function zoomDimensions(asset: {
  isEdited?: boolean | null;
  width?: number | null;
  height?: number | null;
  exifInfo?: {
    exifImageWidth?: number | null;
    exifImageHeight?: number | null;
    orientation?: string | null;
  } | null;
}): { width: number; height: number } | undefined {
  if (asset.width && asset.height && asset.width > 0 && asset.height > 0) {
    return { width: asset.width, height: asset.height };
  }
  // An edited photo (#831) has no fallback: EXIF describes the unedited file,
  // and a wrong size would put the zoom image off the preview's box. No size,
  // no zoom.
  if (asset.isEdited === true) return undefined;
  const w = asset.exifInfo?.exifImageWidth;
  const h = asset.exifInfo?.exifImageHeight;
  if (!w || !h || w <= 0 || h <= 0) return undefined;
  return ROTATED_ORIENTATIONS.has(Number(asset.exifInfo?.orientation))
    ? { width: h, height: w }
    : { width: w, height: h };
}
