/**
 * SubpageNav — server component that renders navigation links
 * for all subpages and standalone albums in the header.
 */

import Link from 'next/link';
import { immich } from '@/lib/immich';
import { listJournalEntries } from '@/lib/admin/journal-service';

export async function SubpageNav() {
  const [subpages, standaloneAlbums, journalEntries] = await Promise.all([
    immich.getSubpages(),
    immich.getStandaloneAlbums(),
    listJournalEntries().catch(() => []),
  ]);

  const hasPublicJournal = journalEntries.some((e) => !e.frontmatter.draft);

  return (
    <>
      {subpages.map((sp) => (
        <Link key={sp.slug} href={`/${sp.slug}`} className="header__nav-link">
          {sp.name}
        </Link>
      ))}
      {hasPublicJournal && (
        <Link href="/journal" className="header__nav-link">
          Journal
        </Link>
      )}
      {standaloneAlbums.map((album) => (
        <Link key={album.id} href={`/${album.slug}`} className="header__nav-link">
          {album.albumName}
        </Link>
      ))}
    </>
  );
}
