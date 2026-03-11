import type { ImmichAlbum } from '@/lib/immich';
import type { PhotoItem } from './PhotoGrid';
import { PhotoGrid } from './PhotoGrid';
import { BackLink } from '@/components/BackLink';
import type { GridConfig } from '@/lib/config';
import React from 'react';

interface AlbumDetailViewProps {
  album: ImmichAlbum;
  images: PhotoItem[];
  layout: GridConfig['layout'];
  gridStyle: React.CSSProperties;
  backLinkHref: string;
  backLinkLabel: string;
  subtitle?: string;
}

export function AlbumDetailView({
  album,
  images,
  layout,
  gridStyle,
  backLinkHref,
  backLinkLabel,
  subtitle,
}: AlbumDetailViewProps) {
  return (
    <>
      <div className="album-header">
        <BackLink href={backLinkHref} label={backLinkLabel} />
        <h1 className="album-header__title">{album.albumName}</h1>
        {subtitle && (
          <p className="subpage-subtitle" style={{ textAlign: 'left', marginLeft: 0 }}>
            {subtitle}
          </p>
        )}
        <p className="album-header__meta">
          {images.length} {images.length === 1 ? 'photo' : 'photos'}
          {album.description && ` · ${album.description}`}
        </p>
      </div>
      <PhotoGrid assets={images} layout={layout} gridStyle={gridStyle} />
    </>
  );
}
