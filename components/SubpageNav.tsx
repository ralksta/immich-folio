/**
 * SubpageNav — server component that renders navigation links
 * for all subpages, menu pages and standalone albums in the header.
 *
 * Subpages and content pages (#722) share one order, the order of the
 * `subpages:` list in gallery.yaml, where a page appears as `- page: <slug>`.
 */

import { NavLink } from './NavLink';
import { immich } from '@/lib/immich';
import { getConfig } from '@/lib/config';
import { listJournalEntries } from '@/lib/admin/journal-service';
import { listPages } from '@/lib/admin/pages-service';
import { resolveMenu } from '@/lib/pages';
import { getServerDictionary } from '@/lib/i18n/server';

export async function SubpageNav() {
  const [subpages, standaloneAlbums, journalEntries, pages] = await Promise.all([
    immich.getSubpages(),
    immich.getStandaloneAlbums(),
    listJournalEntries().catch(() => []),
    listPages().catch(() => []),
  ]);
  const config = getConfig();
  // EXPERIMENTAL: external nav links from settings.yaml, appended after the
  // internal entries. Sanitised to http(s) in getConfig().
  const navLinks = config.navLinks;

  const menu = resolveMenu(config.nav, subpages, pages);
  const t = getServerDictionary();

  const hasPublicJournal = journalEntries.some((e) => !e.frontmatter.draft);

  return (
    <>
      {menu.map((item) => (
        <NavLink key={item.key} href={item.href}>
          {item.label}
        </NavLink>
      ))}
      {hasPublicJournal && <NavLink href="/journal">{t.nav.journal}</NavLink>}
      {standaloneAlbums.map((album) => (
        <NavLink key={album.id} href={`/${album.slug}`}>
          {album.albumName}
        </NavLink>
      ))}
      {navLinks.map((link) => (
        <a
          key={link.url}
          href={link.url}
          className="header__nav-link header__nav-link--external"
          target="_blank"
          rel="noopener noreferrer"
        >
          {link.label}
        </a>
      ))}
    </>
  );
}
