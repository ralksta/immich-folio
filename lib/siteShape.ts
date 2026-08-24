/**
 * Build the description of the site that `publicPaths()` reasons about (#472).
 *
 * Kept apart from the pure rules so the exclusions stay testable without a
 * running Immich, and so the sitemap and the feed cannot answer the visibility
 * question differently.
 */

import { getConfig } from './config';
import { immich } from './immich';
import { isProtected, isSiteLocked } from './auth';
import { listJournalEntries } from './admin/journal-service';
import type { SiteShape, PublicAlbum } from './publicPages';

export async function buildSiteShape(): Promise<SiteShape> {
  const config = getConfig();

  // Allowlisted albums only — getAlbums() already drops everything else, so an
  // album that was never published cannot reach a listing through here.
  const albums = await immich.getAlbums();
  const byId = new Map(albums.map((album) => [album.id, album]));
  const resolve = (ids: string[]): PublicAlbum[] =>
    ids
      .map((id) => byId.get(id))
      .filter((album): album is NonNullable<typeof album> => Boolean(album))
      .map((album) => ({ id: album.id, slug: album.slug }));

  const journal = await listJournalEntries().catch(() => []);

  return {
    siteLocked: isSiteLocked(),
    subpages: config.subpages.map((subpage) => ({
      slug: subpage.slug,
      enabled: subpage.enabled !== false,
      hidden: subpage.hidden === true,
      isProtected: isProtected(subpage.slug, 'subpage'),
      albums: resolve(subpage.albumIds),
    })),
    standaloneAlbums: resolve(config.standaloneAlbums),
    journal: journal.map((entry) => ({
      slug: entry.slug,
      draft: entry.frontmatter.draft === true,
    })),
    isAlbumProtected: (albumId) => isProtected(albumId, 'album'),
    aboutEnabled: config.aboutEnabled,
    mapEnabled: config.map,
    // There is no switch for the journal; it exists when it has entries.
    journalEnabled: journal.length > 0,
  };
}
