/**
 * SubpageNav — server component that renders the header's navigation links
 * after Home: subpages and content pages, standalone albums, Journal, About,
 * Map (`lib/siteNav.ts`, shared with the home page hero), then any external
 * links.
 *
 * Subpages and content pages (#722) share one order, the order of the
 * `subpages:` list in gallery.yaml, where a page appears as `- page: <slug>`.
 */

import { NavLink } from './NavLink';
import { getConfig } from '@/lib/config';
import { loadSiteNav } from '@/lib/siteNav.server';

export async function SubpageNav() {
  const links = await loadSiteNav();
  // EXPERIMENTAL: external nav links from settings.yaml, appended after the
  // internal entries. Sanitised to http(s) in getConfig().
  const navLinks = getConfig().navLinks;

  return (
    <>
      {links.map((item) => (
        <NavLink key={item.key} href={item.href}>
          {item.label}
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
