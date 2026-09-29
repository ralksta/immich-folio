/**
 * Server-side loader for `siteNavLinks()` — fetches subpages, albums, pages
 * and journal entries. Server only (pulls in `fs` via the services).
 *
 * Memoised per request with React's `cache()`: the root layout's header nav
 * and the home page's hero nav both ask for it in one render, and the journal
 * listing is shared with the journal pages (`lib/journal.server.ts`).
 */

import { cache } from 'react';
import { immich } from './immich';
import { getConfig } from './config';
import { listJournalEntriesForRequest } from './journal.server';
import { listPages } from './admin/pages-service';
import { resolveMenu } from './pages';
import { getServerDictionary } from './i18n/server';
import { siteNavLinks, type SiteNavLink } from './siteNav';

export const loadSiteNav = cache(async function loadSiteNav(): Promise<SiteNavLink[]> {
  const [subpages, albums, journalEntries, pages] = await Promise.all([
    immich.getSubpages(),
    immich.getStandaloneAlbums(),
    listJournalEntriesForRequest().catch(() => []),
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
});
