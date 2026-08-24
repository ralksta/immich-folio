/**
 * Sequential album navigation — the "previous / next album" pair at the foot of
 * an album detail page, so a visitor drifting through the portfolio is not
 * dropped at a dead end (#483).
 *
 * The order deliberately comes from whatever list the visitor just came
 * through — the surrounding subpage, or the standalone album list — rather than
 * from a separate ordering of its own. A "next" that disagreed with the grid
 * the visitor was looking at a moment ago would be worse than no control.
 *
 * Neighbours are not wrapped around: the first album has no previous and the
 * last has no next. Wrapping would guarantee a link in every position, but it
 * also sends someone who reaches the end of a sequence back to its start with
 * no sign that they have been round.
 */

/** The fields of an album this module needs. Structural, so `ImmichAlbum` fits. */
export interface AlbumNavCandidate {
  id: string;
  slug: string;
  albumName: string;
}

export interface AlbumNavLink {
  href: string;
  name: string;
}

export interface AlbumNavPair {
  prev?: AlbumNavLink;
  next?: AlbumNavLink;
}

/**
 * The neighbours of `currentId` within `siblings`, in that list's own order.
 *
 * `basePath` is the prefix the album slugs hang off: `''` for standalone albums
 * (`/album-slug`) or `/subpage-slug` for albums inside a subpage.
 *
 * Returns an empty pair when the album is not in the list, or when it is the
 * only one — both cases mean there is nothing to offer, and the caller renders
 * nothing.
 */
export function albumNeighbours(
  siblings: readonly AlbumNavCandidate[],
  currentId: string,
  basePath = '',
): AlbumNavPair {
  const index = siblings.findIndex((a) => a.id === currentId);
  if (index === -1 || siblings.length < 2) return {};

  const href = (album: AlbumNavCandidate) => `${basePath}/${album.slug}`;
  const link = (album: AlbumNavCandidate): AlbumNavLink => ({
    href: href(album),
    name: album.albumName,
  });

  const previous = index > 0 ? siblings[index - 1] : undefined;
  const following = index < siblings.length - 1 ? siblings[index + 1] : undefined;

  return {
    ...(previous ? { prev: link(previous) } : {}),
    ...(following ? { next: link(following) } : {}),
  };
}
