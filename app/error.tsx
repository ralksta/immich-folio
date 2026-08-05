'use client';

import { useEffect } from 'react';
import Link from 'next/link';

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
  useEffect(() => {
    console.error('[Folio] Page render failed:', error);
  }, [error]);

  return (
    <div className="empty-state">
      <h1 className="empty-state__title">Something went wrong</h1>
      <p className="empty-state__text">
        This page could not be loaded right now. It is usually temporary — try again in a moment.
      </p>
      <div className="empty-state__actions">
        <button type="button" onClick={reset} className="empty-state__button">
          Try again
        </button>
        <Link href="/" className="empty-state__button empty-state__button--quiet">
          Back to the gallery
        </Link>
      </div>
      {error.digest && (
        <p
          className="empty-state__text"
          style={{ marginTop: 24, fontSize: '0.8rem', opacity: 0.5 }}
        >
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
