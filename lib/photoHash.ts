/**
 * The `#photo-N` permalink shared by the photo grid and the lightbox.
 *
 * The grid writes and restores it; the lightbox offers a button that copies it
 * (#478). The format lives here so the two cannot drift apart.
 *
 * The link is positional, as `gallery.yaml.example` documents: it names a
 * place in the album, not an asset, so reordering an album moves where a
 * shared link lands.
 */

/** Parse `#photo-N`. Returns a 0-based index, or null if it is not one. */
export function parsePhotoHash(hash: string): number | null {
  const match = hash.match(/^#photo-(\d+)$/);
  if (!match) return null;
  const index = parseInt(match[1], 10) - 1; // 1-indexed in the URL
  return index >= 0 ? index : null;
}

/** The hash for a 0-based index, 1-indexed for the reader. */
export function buildPhotoHash(index: number): string {
  return `#photo-${index + 1}`;
}

/**
 * An absolute permalink to one photo.
 *
 * Takes the location parts rather than reading `window`, so it is pure and the
 * caller does not depend on the grid's hash-sync effect having run yet.
 */
export function buildPhotoPermalink(
  location: { origin: string; pathname: string; search: string },
  index: number,
): string {
  return `${location.origin}${location.pathname}${location.search}${buildPhotoHash(index)}`;
}
