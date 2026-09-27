/**
 * Server-side loader for `siteNavLinks()` — fetches subpages, albums, pages
 * and journal entries. Server only (pulls in `fs` via the services).
 */

import { immich } from './immich';
import { getConfig } from './config';
import { listJournalEntries } from './admin/journal-service';
import { listPages } from './admin/pages-service';
import { resolveMenu } from './pages';
import { getServerDictionary } from './i18n/server';
import { siteNavLinks, type SiteNavLink } from './siteNav';

export async function loadSiteNav(): Promise<SiteNavLink[]> {
  const [subpages, albums, journalEntries, pages] = await Promise.all([
    immich.getSubpages(),
    immich.getStandaloneAlbums(),
    listJournalEntries().catch(() => []),
    listPages().catch(() => []),
  ]);
  const config = getConfig();
  return siteNavLinks(
    {
      menu: resolveMenu(config.nav, subpages, pages),
      subpageAlbumCounts: new Map(subpages.map((sp) => [sp.slug, sp.albumCount])),
      albums,
      hasJournal: journalEntries.some((e) => !e.frontmatter.draft),
      aboutEnabled: config.aboutEnabled,
      map: config.map,
    },
    getServerDictionary(),
  );
}
