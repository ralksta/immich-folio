import Link from 'next/link';

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
  return (
    <div className="empty-state">
      <h1 className="empty-state__title">Not found</h1>
      <p className="empty-state__text">
        This page does not exist, or the album is no longer published.
      </p>
      <div className="empty-state__actions">
        <Link href="/" className="empty-state__button">
          Back to the gallery
        </Link>
      </div>
    </div>
  );
}
