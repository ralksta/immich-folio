import type { ImmichAlbum } from '@/lib/immich';
import type { PhotoItem } from './PhotoGrid';
import { PhotoGrid } from './PhotoGrid';
import { BackLink } from '@/components/BackLink';
import type { GridConfig } from '@/lib/config';
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
}: AlbumDetailViewProps) {
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
            {...(heroBlurDataURL ? { placeholder: 'blur' as const, blurDataURL: heroBlurDataURL } : {})}
          />
          <div className="album-hero__overlay" />
        </div>
      )}
      <div className={`album-header${heroImageUrl ? ' album-header--has-hero' : ''}`}>
        <BackLink href={backLinkHref} label={backLinkLabel} />
        <h1 className="album-header__title">{album.albumName}</h1>
        {subtitle && (
          <p className="subpage-subtitle" style={{ textAlign: 'left', marginLeft: 0 }}>
            {subtitle}
          </p>
        )}
        {album.description && <p className="album-header__description">{album.description}</p>}
        <p className="album-header__meta">
          {images.length} {images.length === 1 ? 'photo' : 'photos'}
        </p>
      </div>
      <PhotoGrid assets={images} layout={layout} gridStyle={gridStyle} />
    </>
  );
}
