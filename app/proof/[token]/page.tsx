/**
 * A client proofing link: /proof/<token>.
 *
 * Renders the session's album with the proofing controls in session mode —
 * hearts save to the server, and the client submits the selection when done.
 * The album does not have to be published; see immich.getProofingAlbum().
 *
 * Kept out of search engines and the sitemap: the URL is the credential.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { immich } from '@/lib/immich';
import { getConfig, hasExifPanelContent } from '@/lib/config';
import { encodeAssetId } from '@/lib/tokens';
import { getServerDictionary } from '@/lib/i18n/server';
import { downloadsRemaining, findSessionByToken, isExpired } from '@/lib/proofSessions';
import { AlbumDetailView } from '../../[...path]/AlbumDetailView';
import { toPhotoItems } from '../../[...path]/photoItems';

export const dynamic = 'force-dynamic';

interface ProofPageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: ProofPageProps): Promise<Metadata> {
  const { token } = await params;
  const session = await findSessionByToken(token);
  const t = getServerDictionary();
  return {
    title: session ? t.proofSession.greeting(session.clientName) : t.error.notFoundTitle,
    robots: { index: false, follow: false },
    // Never let the link travel as a Referer, not even to our own font host.
    referrer: 'no-referrer',
  };
}

export default async function ProofPage({ params }: ProofPageProps) {
  const { token } = await params;
  const session = await findSessionByToken(token);
  if (!session) notFound();

  const t = getServerDictionary();

  if (isExpired(session)) {
    return (
      <div className="empty-state">
        <h1 className="empty-state__title">{t.proofSession.expiredTitle}</h1>
        <p className="empty-state__text">{t.proofSession.expiredText}</p>
      </div>
    );
  }

  const album = await immich.getProofingAlbum(session.albumId);
  if (!album) notFound();

  const config = getConfig();
  const images = toPhotoItems(
    album.assets,
    config.exif.onHover && config.exif.camera,
    config.exif.caption,
  );

  // Only what is still in the album: a photo removed in Immich after it was
  // picked drops out of the selection instead of haunting the counter.
  const inAlbum = new Set(album.assets.map((a) => a.id));
  const selected = session.selection.filter((id) => inAlbum.has(id)).map(encodeAssetId);

  const validUntil = session.expiresOn
    ? new Date(`${session.expiresOn}T12:00:00`).toLocaleDateString(t.dateLocale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const gridStyle = {
    '--grid-columns': config.grid.columns,
    ...(config.gridGapExplicit ? { '--grid-gap': `${config.grid.gap}px` } : {}),
    '--grid-aspect-ratio': config.grid.aspectRatio,
  } as React.CSSProperties;

  return (
    <AlbumDetailView
      album={album}
      images={images}
      layout={config.grid.layout}
      gridStyle={gridStyle}
      watermark={config.watermark}
      showExifPanel={hasExifPanelContent(config.exif)}
      showGear={config.exif.camera}
      proofSession={{
        token: session.token,
        selected,
        submitted: Boolean(session.submittedAt),
        download: session.download,
        downloadsRemaining: downloadsRemaining(session),
      }}
      intro={
        <div className="proof-session-intro">
          <p className="proof-session-intro__greeting">
            {t.proofSession.greeting(session.clientName)}
          </p>
          <p className="proof-session-intro__text">
            {session.submittedAt ? t.proofSession.locked : t.proofSession.intro}
          </p>
          {validUntil && (
            <p className="proof-session-intro__meta">{t.proofSession.validUntil(validUntil)}</p>
          )}
        </div>
      }
    />
  );
}
