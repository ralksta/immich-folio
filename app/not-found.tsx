import Link from 'next/link';
import type { Metadata } from 'next';
import { getServerDictionary } from '@/lib/i18n/server';

/**
 * The head of a 404 that was decided before streaming — by proxy.ts or by a
 * page calling notFound() outside any Suspense boundary. Next then renders
 * this file inside the root layout and takes the metadata from the layouts
 * and from here, never from the page, so without this the tab read the bare
 * site title while a soft 404 read "Not found".
 *
 * `robots: null` drops the layout's `index, follow`, which contradicted the
 * `noindex` Next adds to every 404 on its own.
 */
export function generateMetadata(): Metadata {
  return { title: getServerDictionary().error.notFoundTitle, robots: null };
}

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
