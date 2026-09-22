/**
 * JournalNav — the "← previous entry / next entry →" pair at the foot of a
 * journal entry, mirroring AlbumNav (#483) for the journal (#591).
 *
 * Renders nothing when there is no neighbour in either direction, so a lone
 * entry keeps its quiet ending.
 */

import Link from 'next/link';
import { getServerDictionary } from '@/lib/i18n/server';
import type { JournalNavPair } from '@/lib/journalNav';

function Chevron({ direction }: { direction: 'prev' | 'next' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points={direction === 'prev' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
    </svg>
  );
}

export function JournalNav({ prev, next }: JournalNavPair) {
  const t = getServerDictionary();
  if (!prev && !next) return null;

  return (
    <nav className="album-nav" aria-label={t.common.entryNavAria}>
      {prev ? (
        <Link
          href={prev.href}
          className="album-nav__link album-nav__link--prev"
          aria-label={t.common.prevEntryAria(prev.title)}
        >
          <Chevron direction="prev" />
          <span className="album-nav__text">
            <span className="album-nav__kicker">{t.common.prevEntry}</span>
            <span className="album-nav__name">{prev.title}</span>
          </span>
        </Link>
      ) : (
        /* Holds the next link against the right edge when there is no previous. */
        <span aria-hidden="true" />
      )}
      {next && (
        <Link
          href={next.href}
          className="album-nav__link album-nav__link--next"
          aria-label={t.common.nextEntryAria(next.title)}
        >
          <span className="album-nav__text">
            <span className="album-nav__kicker">{t.common.nextEntry}</span>
            <span className="album-nav__name">{next.title}</span>
          </span>
          <Chevron direction="next" />
        </Link>
      )}
    </nav>
  );
}
