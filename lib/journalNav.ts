/**
 * Sequential journal navigation — the "previous / next entry" pair at the foot
 * of a journal entry, mirroring `albumNav.ts` (#483) for the journal (#591).
 *
 * `siblings` must already be filtered to what the current visitor may see —
 * a draft, or a password-protected entry they have not unlocked, must never
 * appear here even as a name-only link (GHSA-fvgv-97g3-wjr7 was exactly this
 * class of leak for the index and page metadata).
 *
 * Neighbours are not wrapped around, for the same reason as albums: reaching
 * the end of the journal should feel like an ending, not send the reader back
 * to its start with no sign that they have been round.
 */

export interface JournalNavCandidate {
  slug: string;
  title: string;
}

export interface JournalNavLink {
  href: string;
  title: string;
}

export interface JournalNavPair {
  prev?: JournalNavLink;
  next?: JournalNavLink;
}

/**
 * The neighbours of `currentSlug` within `siblings`, in that list's own order
 * (publication order, newest first, same as `/journal` and `listJournalEntries()`).
 *
 * Returns an empty pair when the entry is not in the list, or when it is the
 * only one — both cases mean there is nothing to offer, and the caller renders
 * nothing.
 */
export function journalNeighbours(
  siblings: readonly JournalNavCandidate[],
  currentSlug: string,
): JournalNavPair {
  const index = siblings.findIndex((e) => e.slug === currentSlug);
  if (index === -1 || siblings.length < 2) return {};

  const link = (entry: JournalNavCandidate): JournalNavLink => ({
    href: `/journal/${entry.slug}`,
    title: entry.title,
  });

  const previous = index > 0 ? siblings[index - 1] : undefined;
  const following = index < siblings.length - 1 ? siblings[index + 1] : undefined;

  return {
    ...(previous ? { prev: link(previous) } : {}),
    ...(following ? { next: link(following) } : {}),
  };
}
