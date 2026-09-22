/**
 * Photo permalinks for the grid and the lightbox.
 *
 * `?photo=<assetId>` (assetId is the opaque per-asset token PhotoItem.id
 * already carries — see encodeAssetId) is the current format: a query
 * parameter, not a hash, because a hash never reaches the server. A hash-only
 * permalink got no OG preview card, and it named a *position* in the album
 * rather than a photo — reordering the album silently repointed every shared
 * link, and so did deleting a photo (#588).
 *
 * `#photo-N` (1-indexed, matching what `gallery.yaml.example` used to
 * document) is the format this replaces. Parsing it stays here indefinitely:
 * public instances have been sharing those links for months, and this module
 * is where the grid and the lightbox both read from, so it cannot drift.
 */

const PHOTO_QUERY_PARAM = 'photo';

/** Parse `#photo-N`. Returns a 0-based index, or null if it is not one. */
export function parsePhotoHash(hash: string): number | null {
  const match = hash.match(/^#photo-(\d+)$/);
  if (!match) return null;
  const index = parseInt(match[1], 10) - 1; // 1-indexed in the URL
  return index >= 0 ? index : null;
}

/** The legacy hash for a 0-based index, 1-indexed for the reader. */
export function buildPhotoHash(index: number): string {
  return `#photo-${index + 1}`;
}

/** Parse `?photo=<assetId>`. Returns the token, or null if it is absent. */
export function parsePhotoQuery(search: string): string | null {
  return new URLSearchParams(search).get(PHOTO_QUERY_PARAM);
}

/**
 * `search`, with `photo` set to `assetId` (or removed, when `assetId` is
 * null) and every other query parameter left as it was.
 */
export function buildPhotoQuery(search: string, assetId: string | null): string {
  const params = new URLSearchParams(search);
  if (assetId === null) {
    params.delete(PHOTO_QUERY_PARAM);
  } else {
    params.set(PHOTO_QUERY_PARAM, assetId);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * An absolute permalink to one photo, addressed by its stable asset id.
 *
 * Takes the location parts rather than reading `window`, so it is pure and
 * the caller does not depend on the grid's query-sync effect having run yet.
 */
export function buildPhotoPermalink(
  location: { origin: string; pathname: string; search: string },
  assetId: string,
): string {
  return `${location.origin}${location.pathname}${buildPhotoQuery(location.search, assetId)}`;
}
