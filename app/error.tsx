'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useDictionary } from '@/components/I18nProvider';

/**
 * Rendered when a page throws — in practice almost always
 * ImmichUnavailableError, since that is what the Immich client raises when the
 * server cannot answer.
 *
 * The wording deliberately does not name Immich or claim to know the cause.
 * Next.js strips error messages in production builds and replaces them with a
 * digest, so this component genuinely cannot tell an Immich outage from any
 * other server error — asserting one would be a guess shown to visitors. The
 * distinction that matters is already made structurally: notFound() renders
 * not-found.tsx, a throw renders this.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useDictionary();

  useEffect(() => {
    console.error('[Folio] Page render failed:', error);
  }, [error]);

  return (
    <div className="empty-state">
      <h1 className="empty-state__title">{t.error.errorTitle}</h1>
      <p className="empty-state__text">{t.error.errorText}</p>
      <div className="empty-state__actions">
        <button type="button" onClick={reset} className="empty-state__button">
          {t.error.tryAgain}
        </button>
        <Link href="/" className="empty-state__button empty-state__button--quiet">
          {t.common.backToGallery}
        </Link>
      </div>
      {error.digest && (
        <p
          className="empty-state__text"
          style={{ marginTop: 24, fontSize: '0.8rem', opacity: 0.5 }}
        >
          {t.error.reference(error.digest)}
        </p>
      )}
    </div>
  );
}
