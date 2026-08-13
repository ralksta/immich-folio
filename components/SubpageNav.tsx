/**
 * SubpageNav — server component that renders navigation links
 * for all subpages and standalone albums in the header.
 */

import Link from 'next/link';
import { immich } from '@/lib/immich';
import { getConfig } from '@/lib/config';

export async function SubpageNav() {
  const [subpages, standaloneAlbums] = await Promise.all([
    immich.getSubpages(),
    immich.getStandaloneAlbums(),
  ]);
  // EXPERIMENTAL: external nav links from settings.yaml, appended after the
  // internal entries. Sanitised to http(s) in getConfig().
  const navLinks = getConfig().navLinks;

  return (
    <>
      {subpages.map((sp) => (
        <Link key={sp.slug} href={`/${sp.slug}`} className="header__nav-link">
          {sp.name}
        </Link>
      ))}
      {standaloneAlbums.map((album) => (
        <Link key={album.id} href={`/${album.slug}`} className="header__nav-link">
          {album.albumName}
        </Link>
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
