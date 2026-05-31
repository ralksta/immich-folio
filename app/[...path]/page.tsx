/**
 * Catch-all route — handles both subpage listings and album detail pages.
 *
 * Single segment:
 *   - If slug matches a subpage → render subpage album grid
 *   - If slug matches a standalone album → render album detail
 *
 * Two segments:
 *   - Treat as subpage-slug/album-slug → render album detail
 *     with back-link to the subpage
 */

import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { immich, type ImmichAsset } from '@/lib/immich';
import { notFound } from 'next/navigation';
import { PhotoGrid, type PhotoItem } from './PhotoGrid';
import {
  imageUrl,
  exifUrl,
  videoUrl,
  assetPlaceholder,
  assetExifSummary,
  assetAspectRatio,
} from '@/lib/urls';
import { getConfig, type GridConfig } from '@/lib/config';
import { isProtected, isAuthenticated } from '@/lib/auth';
import PasswordGate from '@/components/PasswordGate';
import { BackLink } from '@/components/BackLink';
import { AlbumDetailView } from './AlbumDetailView';
import { SubpageGridView } from './SubpageGridView';

// Render at request time — requires live Immich connection
export const dynamic = 'force-dynamic';

interface PathPageProps {
  params: Promise<{ path: string[] }>;
}

export async function generateMetadata({ params }: PathPageProps): Promise<Metadata> {
  const { path } = await params;
  if (!path || path.length === 0) return {};

  const slug = path[0];
  let title = slug;
  let subtitle = '';

  if (path.length === 2) {
    const album = await immich.getAlbumBySlug(path[1], slug);
    if (album) {
      title = album.albumName;
      const count = album.assets.filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO').length;
      subtitle = `${count} photo${count === 1 ? '' : 's'}`;
    }
  } else if (immich.isSubpageSlug(slug)) {
    const result = await immich.getSubpageAlbums(slug);
    if (result) {
      // Single album → use album name; multiple → use subpage name
      if (result.albums.length === 1) {
        const album = await immich.getAlbumBySlug(result.albums[0].slug, slug);
        if (album) {
          title = album.albumName;
          const count = album.assets.filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO').length;
          subtitle = `${count} photo${count === 1 ? '' : 's'}`;
        }
      } else {
        title = result.subpage.name;
      }
    }
  } else {
    const album = await immich.getAlbumBySlug(slug);
    if (album) {
      title = album.albumName;
      const count = album.assets.filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO').length;
      subtitle = `${count} photo${count === 1 ? '' : 's'}`;
    }
  }

  const ogUrl = `/api/og?title=${encodeURIComponent(title)}${subtitle ? `&subtitle=${encodeURIComponent(subtitle)}` : ''}`;

  return {
    title,
    openGraph: { title, images: [ogUrl] },
    twitter: { card: 'summary_large_image', title, images: [ogUrl] },
  };
}

/** Map Immich assets to PhotoItem props for the grid/lightbox. */
function toPhotoItems(assets: ImmichAsset[], showExif: boolean): PhotoItem[] {
  return assets
    .filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO')
    .map((a) => {
      const ph = assetPlaceholder(a);
      const exif = showExif && a.type === 'IMAGE' ? assetExifSummary(a) : undefined;
      const isVideo = a.type === 'VIDEO';
      return {
        id: a.id,
        type: isVideo ? 'video' : 'image',
        thumbUrl: imageUrl(a.id, 'preview'),
        previewUrl: imageUrl(a.id, 'preview'),
        originalUrl: imageUrl(a.id, 'original'),
        ...(isVideo ? { videoUrl: videoUrl(a.id) } : {}),
        exifUrl: exifUrl(a.id),
        ...(ph ? { blurDataURL: ph.blurDataURL, dominantColor: ph.dominantColor } : {}),
        ...(exif ?? {}),
        aspectRatio: assetAspectRatio(a),
      };
    });
}

/**
 * Returns a PasswordGate element if the key (slug or ID) is protected and
 * not yet authenticated, otherwise returns null.
 */
async function gateIfProtected(
  key: string,
  type: 'subpage' | 'album' = 'subpage',
  titleOverride?: string,
): Promise<React.ReactElement | null> {
  if (!isProtected(key, type)) return null;
  const cookieStore = await cookies();
  const getCookie = (name: string) => cookieStore.get(name)?.value;
  if (isAuthenticated(key, getCookie, type)) return null;

  let title = titleOverride || key;
  if (!titleOverride && type === 'subpage') {
    const subpageData = await immich.getSubpageAlbums(key);
    title = subpageData?.subpage.name ?? key;
  }

  return <PasswordGate slug={key} title={title} type={type} />;
}

/** Fetch hero image URL + blur placeholder for an album if configured. */
async function getAlbumHeroData(
  albumId: string,
  config: ReturnType<typeof getConfig>,
): Promise<{ heroImageUrl: string; heroBlurDataURL?: string } | null> {
  const heroAssetId = config.albumHeroImages[albumId];
  if (!heroAssetId) return null;
  const asset = await immich.getAssetInfo(heroAssetId);
  const ph = asset ? assetPlaceholder(asset) : null;
  return {
    heroImageUrl: imageUrl(heroAssetId, 'preview'),
    heroBlurDataURL: ph?.blurDataURL,
  };
}

export default async function PathPage({ params }: PathPageProps) {
  const { path } = await params;
  const config = getConfig();

  // Build grid CSS custom properties, optionally merging subpage overrides
  const buildGridStyle = (overrides?: Partial<GridConfig>): React.CSSProperties => {
    const g = { ...config.grid, ...overrides };
    return {
      '--grid-columns': g.columns,
      '--grid-gap': `${g.gap}px`,
      '--grid-aspect-ratio': g.aspectRatio,
    } as React.CSSProperties;
  };
  const resolveLayout = (overrides?: Partial<GridConfig>) =>
    overrides?.layout ?? config.grid.layout;

  if (!path || path.length === 0) {
    notFound();
  }

  // ── Two segments: subpage/album ──────────────────────────────
  if (path.length === 2) {
    const [subpageSlug, albumSlug] = path;

    // Password gate for protected subpages
    const gate = await gateIfProtected(subpageSlug);
    if (gate) return gate;

    const album = await immich.getAlbumBySlug(albumSlug, subpageSlug);

    if (!album) {
      notFound();
    }

    // Look up subpage config for grid overrides and back link
    const subpageData = await immich.getSubpageAlbums(subpageSlug);
    const spGrid = subpageData?.subpage.grid;
    const subpageName = subpageData?.subpage.name ?? subpageSlug;

    const images = toPhotoItems(album.assets, config.exifOnHover);

    // Password gate for protected albums
    const albumGate = await gateIfProtected(album.id, 'album', album.albumName);
    if (albumGate) return albumGate;

    const heroData = await getAlbumHeroData(album.id, config);

    return (
      <AlbumDetailView
        album={album}
        images={images}
        layout={resolveLayout(spGrid)}
        gridStyle={buildGridStyle(spGrid)}
        backLinkHref={`/${subpageSlug}`}
        backLinkLabel={`Back to ${subpageName}`}
        {...heroData}
      />
    );
  }

  // ── Single segment: subpage or standalone album ──────────────
  const slug = path[0];

  // Check if it's a subpage
  if (immich.isSubpageSlug(slug)) {
    // Password gate for protected subpages
    const gate = await gateIfProtected(slug);
    if (gate) return gate;

    const result = await immich.getSubpageAlbums(slug);
    if (!result || result.albums.length === 0) {
      notFound();
    }

    const { albums } = result;

    // ── Single album → full-bleed (skip album grid) ──────────
    if (albums.length === 1) {
      const album = await immich.getAlbumBySlug(albums[0].slug, slug);
      if (!album) notFound();

      const images = toPhotoItems(album.assets, config.exifOnHover);

      // Password gate for protected albums
      const albumGate = await gateIfProtected(album.id, 'album', album.albumName);
      if (albumGate) return albumGate;

      const heroData = await getAlbumHeroData(album.id, config);

      return (
        <AlbumDetailView
          album={album}
          images={images}
          layout={resolveLayout(result.subpage.grid)}
          gridStyle={buildGridStyle(result.subpage.grid)}
          subtitle={result.subpage.subtitle}
          backLinkHref="/"
          backLinkLabel="Back to Gallery"
          {...heroData}
        />
      );
    }

    // ── Multiple albums → show album grid ─────────────────────

    // Override albumThumbnailAssetId with the configured hero image (if any)
    const albumsWithHero = albums.map((album) => {
      const heroId = config.albumHeroImages[album.id];
      return heroId ? { ...album, albumThumbnailAssetId: heroId } : album;
    });

    // Batch-fetch ThumbHash for album cover placeholders
    const coverPlaceholders = await Promise.all(
      albumsWithHero.map(async (album) => {
        if (!album.albumThumbnailAssetId) return null;
        const asset = await immich.getAssetInfo(album.albumThumbnailAssetId);
        return asset ? assetPlaceholder(asset) : null;
      }),
    );

    return (
      <SubpageGridView
        slug={slug}
        title={result.subpage.title || result.subpage.name}
        subtitle={result.subpage.subtitle}
        albums={albumsWithHero}
        coverPlaceholders={coverPlaceholders}
        sections={result.subpage.sections}
      />
    );
  }

  // Otherwise treat as a standalone album slug
  const album = await immich.getAlbumBySlug(slug);
  if (!album) {
    notFound();
  }

  const images = toPhotoItems(album.assets, config.exifOnHover);

  // Password gate for protected albums
  const albumGate = await gateIfProtected(album.id, 'album', album.albumName);
  if (albumGate) return albumGate;

  const heroData = await getAlbumHeroData(album.id, config);

  return (
    <AlbumDetailView
      album={album}
      images={images}
      layout={resolveLayout()}
      gridStyle={buildGridStyle()}
      backLinkHref="/"
      backLinkLabel="Back to Gallery"
      {...heroData}
    />
  );
}
