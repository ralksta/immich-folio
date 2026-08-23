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
}: AlbumDetailViewProps) {
  const metaDetail = albumMetaDetail(album, showGear);
  const t = getServerDictionary();

  return (
    <>
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
      />
    </>
  );
}
