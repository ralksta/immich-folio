'use client';

import { useEffect } from 'react';

/**
 * The last resort: rendered when the root layout itself throws, which
 * `app/error.tsx` cannot catch — it is rendered *inside* that layout. The
 * layout reads the config and the request headers, so this is not a theoretical
 * case; without this file such a failure renders a blank page.
 *
 * Everything here is deliberately self-contained: it replaces the whole
 * document, so `globals.css` and the theme custom properties are not
 * guaranteed to be in scope. No config lookup, no `next/link` (there is no
 * router shell to speak of), no shared components. Same wording as
 * `app/error.tsx`, which explains why it does not name a cause: production
 * builds replace the message with a digest, so the component genuinely cannot
 * tell an Immich outage from anything else.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Folio] Root layout render failed:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0c0c0c',
          color: '#ededed',
          colorScheme: 'dark',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          padding: '24px',
        }}
      >
        <main style={{ maxWidth: '32rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 500, margin: '0 0 12px' }}>
            Something went wrong
          </h1>
          <p style={{ margin: '0 0 24px', lineHeight: 1.6, opacity: 0.75 }}>
            This site could not be loaded right now. It is usually temporary — try again in a
            moment.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: '10px 20px',
                border: '1px solid #ededed',
                borderRadius: '4px',
                background: 'transparent',
                color: 'inherit',
                font: 'inherit',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            {/* A plain <a>, not next/link: a full document request is exactly
                what is wanted here — a client-side transition would stay inside
                the tree whose root layout just failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                padding: '10px 20px',
                border: '1px solid transparent',
                borderRadius: '4px',
                color: 'inherit',
                textDecoration: 'none',
                opacity: 0.6,
              }}
            >
              Back to the gallery
            </a>
          </div>
          {error.digest && (
            <p style={{ marginTop: '24px', fontSize: '0.8rem', opacity: 0.4 }}>
              Reference: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
