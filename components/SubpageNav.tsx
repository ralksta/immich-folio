/**
 * SubpageNav — server component that renders navigation links
 * for all subpages and standalone albums in the header.
 */

import { NavLink } from './NavLink';
import { immich } from '@/lib/immich';
import { getConfig } from '@/lib/config';
import { listJournalEntries } from '@/lib/admin/journal-service';
import { getServerDictionary } from '@/lib/i18n/server';

export async function SubpageNav() {
  const [subpages, standaloneAlbums, journalEntries] = await Promise.all([
    immich.getSubpages(),
    immich.getStandaloneAlbums(),
    listJournalEntries().catch(() => []),
  ]);
  // EXPERIMENTAL: external nav links from settings.yaml, appended after the
  // internal entries. Sanitised to http(s) in getConfig().
  const navLinks = getConfig().navLinks;
  const t = getServerDictionary();

  const hasPublicJournal = journalEntries.some((e) => !e.frontmatter.draft);

  return (
    <>
      {subpages.map((sp) => (
        <NavLink key={sp.slug} href={`/${sp.slug}`}>
          {sp.name}
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
