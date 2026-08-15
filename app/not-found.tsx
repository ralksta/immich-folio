import Link from 'next/link';
import { getServerDictionary } from '@/lib/i18n/server';

/**
 * Rendered when a page calls notFound() — i.e. Immich answered and the album
 * or asset genuinely does not exist.
 *
 * The counterpart is error.tsx, which handles the case where Immich could not
 * answer at all. Keeping the two apart is the whole point of the
 * ImmichUnavailableError split: an outage must not tell a visitor (or a
 * crawler) that their content is gone.
 */
export default function NotFound() {
  const t = getServerDictionary();
  return (
    <div className="empty-state">
      <h1 className="empty-state__title">{t.error.notFoundTitle}</h1>
      <p className="empty-state__text">{t.error.notFoundText}</p>
      <div className="empty-state__actions">
        <Link href="/" className="empty-state__button">
          {t.common.backToGallery}
        </Link>
      </div>
    </div>
  );
}
