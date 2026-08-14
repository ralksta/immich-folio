import type { ImmichAlbum } from '@/lib/immich';
import type { PhotoItem } from './PhotoGrid';
import { PhotoGrid } from './PhotoGrid';
import { BackLink } from '@/components/BackLink';
import type { GridConfig } from '@/lib/config';
import type { LightboxWatermark } from '@/components/Lightbox';
import Image from 'next/image';
import React from 'react';

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
}

/**
 * Extra detail for the album header — shooting date and camera/lens, read off
 * the first asset that carries EXIF. Both are rendered in their own spans and
 * hidden by default; only presets that ask for them show them, so the header
 * keeps reading "86 photos" everywhere else.
 */
function albumMetaDetail(album: ImmichAlbum): { date?: string; gear?: string } {
  const first = album.assets.find((a) => a.exifInfo);
  const exif = first?.exifInfo;

  const taken = exif?.dateTimeOriginal || first?.fileCreatedAt;
  const gear = [exif?.model, exif?.lensModel].filter(Boolean).join(' · ');

  return {
    ...(taken ? { date: formatMonthYear(taken) } : {}),
    ...(gear ? { gear } : {}),
  };
}

function formatMonthYear(iso: string): string | undefined {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
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
}: AlbumDetailViewProps) {
  const metaDetail = albumMetaDetail(album);

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
          <span className="album-header__meta-count">
            {images.length} {images.length === 1 ? 'photo' : 'photos'}
          </span>
          {metaDetail.date && <span className="album-header__meta-date"> · {metaDetail.date}</span>}
          {metaDetail.gear && <span className="album-header__meta-gear">{metaDetail.gear}</span>}
        </p>
      </div>
      <PhotoGrid assets={images} layout={layout} gridStyle={gridStyle} watermark={watermark} />
    </>
  );
}
