/**
 * The site's navigation entries, in the one order the header and the home
 * page hero share (#696): subpages and content pages (gallery.yaml order),
 * standalone albums, Journal, About, Map.
 *
 * Client-safe: callers do the fetching and pass the results in.
 */

import type { Dictionary } from './i18n';
import type { MenuItem } from './pages';

export interface SiteNavLink {
  key: string;
  href: string;
  label: string;
  /** "3 albums" / "12 photos" — only the hero shows it, and only presets that want it. */
  count?: string;
}

export interface SiteNavInput {
  /** Subpages and content pages, from `resolveMenu()`. */
  menu: readonly MenuItem[];
  /** Album count per subpage slug, for the hero's count line. */
  subpageAlbumCounts?: ReadonlyMap<string, number>;
  albums: ReadonlyArray<{ id: string; slug: string; albumName: string; assetCount?: number }>;
  /** At least one published (non-draft) journal entry. */
  hasJournal: boolean;
  aboutEnabled: boolean;
  map: boolean;
}

export function siteNavLinks(input: SiteNavInput, t: Dictionary): SiteNavLink[] {
  const links: SiteNavLink[] = input.menu.map((item) => {
    const n = input.subpageAlbumCounts?.get(item.href.slice(1));
    return {
      ...item,
      ...(item.key.startsWith('sp-') && n !== undefined ? { count: t.common.albums(n) } : {}),
    };
  });
  for (const a of input.albums) {
    links.push({
      key: `al-${a.id}`,
      href: `/${a.slug}`,
      label: a.albumName,
      ...(a.assetCount !== undefined ? { count: t.common.photos(a.assetCount) } : {}),
    });
  }
  if (input.hasJournal) links.push({ key: 'journal', href: '/journal', label: t.nav.journal });
  if (input.aboutEnabled) links.push({ key: 'about', href: '/about', label: t.nav.about });
  if (input.map) links.push({ key: 'map', href: '/map', label: t.nav.map });
  return links;
}
