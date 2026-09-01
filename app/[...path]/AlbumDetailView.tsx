import type { ImmichAlbum } from '@/lib/immich';
import type { PhotoItem } from './PhotoGrid';
import { PhotoGrid } from './PhotoGrid';
import { BackLink } from '@/components/BackLink';
import type { GridConfig } from '@/lib/config';
import type { LightboxWatermark } from '@/components/Lightbox';
import Image from 'next/image';
import React from 'react';
import { getServerDictionary } from '@/lib/i18n/server';
import { albumMetaDetail } from '@/lib/albumMeta';
import { AlbumNav } from '@/components/AlbumNav';
import { StructuredData } from '@/components/StructuredData';
import type { AlbumNavPair } from '@/lib/albumNav';

interface AlbumDetailViewProps {
  album: ImmichAlbum;
  images: PhotoItem[];
  layout: GridConfig['layout'];
  gridStyle: React.CSSProperties;
  backLinkHref: string;
  backLinkLabel: string;
  subtitle?: string;
  heroImageUrl?: string;
  heroBlurDataURL?: string;
  watermark?: LightboxWatermark;
  /** Whether the lightbox may offer its info panel at all. */
  showExifPanel?: boolean;
  /** Whether the header may name the camera and lens. Follows the `camera` group. */
  showGear?: boolean;
  /** Client proofing — favorite hearts, selection bar and send-off modal. */
  proofing?: boolean;
  /** Offer the "send by email" button in the proofing modal. */
  allowMailto?: boolean;
  /**
   * The ZIP endpoint for this album, when it offers downloads (#475). Renders a
   * "download album" link in the header and lets the proofing modal offer a
   * "download selected" action.
   */
  downloadArchiveUrl?: string;
  /** Neighbouring albums in the surrounding list, for the foot navigation. */
  nav?: AlbumNavPair;
  /** JSON-LD for this album, or null when no site URL is configured (#472). */
  structuredData?: Record<string, unknown> | null;
}

export function AlbumDetailView({
  album,
  images,
  layout,
  gridStyle,
  backLinkHref,
  backLinkLabel,
  subtitle,
  heroImageUrl,
  heroBlurDataURL,
  watermark,
  showExifPanel = true,
  showGear = true,
  proofing,
  allowMailto,
  downloadArchiveUrl,
  nav,
  structuredData,
}: AlbumDetailViewProps) {
  const metaDetail = albumMetaDetail(album, showGear);
  const t = getServerDictionary();

  return (
    <>
      {structuredData && <StructuredData data={structuredData} />}
      {heroImageUrl && (
        <div className="album-hero">
          <Image
            src={heroImageUrl}
            alt={album.albumName}
            fill
            priority
            sizes="100vw"
            style={{ objectFit: 'cover' }}
            {...(heroBlurDataURL
              ? { placeholder: 'blur' as const, blurDataURL: heroBlurDataURL }
              : {})}
          />
          <div className="album-hero__overlay" />
        </div>
      )}
      <div className={`album-header${heroImageUrl ? ' album-header--has-hero' : ''}`}>
        <div className="album-header__main">
          <BackLink href={backLinkHref} label={backLinkLabel} />
          <h1 className="album-header__title">{album.albumName}</h1>
          {subtitle && (
            <p className="subpage-subtitle" style={{ textAlign: 'left', marginLeft: 0 }}>
              {subtitle}
            </p>
          )}
          {album.description && <p className="album-header__description">{album.description}</p>}
          {downloadArchiveUrl && (
            <a className="album-header__download" href={downloadArchiveUrl}>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t.common.downloadAlbum}
            </a>
          )}
        </div>
        <p className="album-header__meta">
          <span className="album-header__meta-count">{t.common.photos(images.length)}</span>
          {metaDetail.date && <span className="album-header__meta-date"> · {metaDetail.date}</span>}
          {metaDetail.gear && <span className="album-header__meta-gear">{metaDetail.gear}</span>}
        </p>
      </div>
      <PhotoGrid
        assets={images}
        layout={layout}
        gridStyle={gridStyle}
        watermark={watermark}
        showExifPanel={showExifPanel}
        proofing={proofing}
        allowMailto={allowMailto}
        downloadArchiveUrl={downloadArchiveUrl}
      />
      {nav && <AlbumNav {...nav} />}
    </>
  );
}
