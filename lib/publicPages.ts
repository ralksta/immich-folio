/**
 * Which pages a crawler — or a feed reader — may be told about (#472, #471).
 *
 * This is the part that matters. A sitemap and a feed collect exactly what
 * access control otherwise hides: titles, cover images, publication dates. It
 * is a leak surface nobody notices, because it never shows up in the browser.
 *
 * The rules are kept here, as a pure function over a description of the site,
 * so both surfaces answer the same question the same way and every exclusion
 * can be stated as a test.
 */

export interface PublicAlbum {
  id: string;
  slug: string;
}

export interface PublicSubpage {
  slug: string;
  /** `enabled: false` in gallery.yaml — the subpage does not exist publicly. */
  enabled: boolean;
  /** `hidden: true` — reachable by direct link only, which a listing is not. */
  hidden: boolean;
  /** The subpage carries a password. */
  isProtected: boolean;
  albums: PublicAlbum[];
}

export interface PublicJournalEntry {
  slug: string;
  draft: boolean;
}

export interface SiteShape {
  /** A global site password is on and no one is past it. */
  siteLocked: boolean;
  subpages: PublicSubpage[];
  /** Albums that are not part of any subpage. */
  standaloneAlbums: PublicAlbum[];
  journal: PublicJournalEntry[];
  /** Whether an album carries its own password. Keyed by Immich album id. */
  isAlbumProtected: (albumId: string) => boolean;
  aboutEnabled: boolean;
  mapEnabled: boolean;
  journalEnabled: boolean;
}

/**
 * Every path that may appear in a public listing, in a stable order.
 *
 * A locked site yields nothing at all: the gate covers the whole site, so
 * naming its pages would describe exactly what the password withholds.
 */
export function publicPaths(site: SiteShape): string[] {
  if (site.siteLocked) return [];

  const paths: string[] = ['/'];

  if (site.aboutEnabled) paths.push('/about');
  if (site.mapEnabled) paths.push('/map');
  if (site.journalEnabled) paths.push('/journal');

  for (const subpage of site.subpages) {
    // A subpage that is off, unlisted, or behind a password is not a public
    // page — and neither is anything underneath it. Inheritance is the case
    // that is easy to miss: a public album under a protected subpage is not
    // reachable, so listing it would advertise a URL that only asks for a
    // password, and name the album while doing it.
    if (!subpage.enabled || subpage.hidden || subpage.isProtected) continue;

    paths.push(`/${subpage.slug}`);

    for (const album of subpage.albums) {
      if (site.isAlbumProtected(album.id)) continue;
      paths.push(`/${subpage.slug}/${album.slug}`);
    }
  }

  for (const album of site.standaloneAlbums) {
    if (site.isAlbumProtected(album.id)) continue;
    paths.push(`/${album.slug}`);
  }

  if (site.journalEnabled) {
    for (const entry of site.journal) {
      // Drafts stay visible to the logged-in admin and absent for everyone
      // else; a listing is "everyone else".
      if (entry.draft) continue;
      paths.push(`/journal/${entry.slug}`);
    }
  }

  // A slug collision between a subpage and a standalone album would otherwise
  // emit the same URL twice.
  return [...new Set(paths)];
}
