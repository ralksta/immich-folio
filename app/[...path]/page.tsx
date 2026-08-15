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

import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { immich, type ImmichAsset } from '@/lib/immich';
import { notFound } from 'next/navigation';
import type { PhotoItem } from './PhotoGrid';
import {
  imageUrl,
  exifUrl,
  videoUrl,
  assetPlaceholder,
  assetExifSummary,
  assetAspectRatio,
} from '@/lib/urls';
import { encodeAssetId } from '@/lib/tokens';
import { getConfig, type GridConfig } from '@/lib/config';
import { isProtected, isAuthenticated } from '@/lib/auth';
import { isAdminAuthenticated } from '@/lib/admin/auth';
import PasswordGate from '@/components/PasswordGate';
import { AdminDiagnosticBanner } from '@/components/AdminDiagnosticBanner';
import { AlbumDetailView } from './AlbumDetailView';
import { SubpageGridView } from './SubpageGridView';
import { EssayView } from './EssayView';
import { parseEssayMarkdown } from '@/lib/essay';
import { loadEssayFromFile } from '@/lib/admin/journal-service';

// Render at request time — requires live Immich connection
export const dynamic = 'force-dynamic';

interface PathPageProps {
  params: Promise<{ path: string[] }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PathPageProps): Promise<Metadata> {
  const { path } = await params;
  if (!path || path.length === 0) return {};

  const slug = path[0];
  let title = slug;
  let subtitle = '';
  let description: string | undefined = undefined;
  if (path.length === 1 && immich.isSubpageSlug(slug)) {
    const result = await immich.getSubpageAlbums(slug);
    if (result) {
      if (result.subpage.subtitle) {
        description = result.subpage.subtitle;
      }
      if (result.albums.length === 1) {
        const album = await immich.getAlbumBySlug(result.albums[0].slug, slug);
        if (album) {
          title = album.albumName;
          const count = album.assets.filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO').length;
          subtitle = `${count} photo${count === 1 ? '' : 's'}`;
        }
      } else {
        title = result.subpage.title || result.subpage.name;
      }
    }
  } else if (path.length === 2) {
    const album = await immich.getAlbumBySlug(path[1], slug);
    if (album) {
      title = album.albumName;
      const count = album.assets.filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO').length;
      subtitle = `${count} photo${count === 1 ? '' : 's'}`;
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
    description: description || (subtitle ? `${title} — ${subtitle}` : undefined),
    openGraph: {
      title,
      description: description || (subtitle ? `${title} — ${subtitle}` : undefined),
      images: [ogUrl],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: description || (subtitle ? `${title} — ${subtitle}` : undefined),
      images: [ogUrl],
    },
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
        id: encodeAssetId(a.id),
        type: isVideo ? 'video' : 'image',
        thumbUrl: imageUrl(a.id, 'preview'),
        previewUrl: imageUrl(a.id, 'preview'),
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

export default async function PathPage({ params, searchParams }: PathPageProps) {
  const { path } = await params;
  const sParams = (await searchParams) || {};
  const forceFresh = sParams.fresh === '1' || sParams.preview === 'true';

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

  // Client proofing — `proofing.enabled` in settings.yaml is the default and a
  // subpage's own `proofing:` flag overrides it in either direction. Albums
  // reached without a subpage follow the global setting.
  const proofingFor = (subpage?: { proofing?: boolean }) =>
    subpage?.proofing ?? config.proofing.enabled;

  // EXPERIMENTAL: per-album grid override — merged over the subpage grid so
  // the precedence is global < subpage < album.
  const mergeAlbumGrid = (
    albumId: string,
    spGrid?: Partial<GridConfig>,
  ): Partial<GridConfig> | undefined => {
    const albumGrid = config.albumGrids[albumId];
    if (!albumGrid) return spGrid;
    return { ...spGrid, ...albumGrid };
  };

  if (!path || path.length === 0) {
    notFound();
  }

  // ── Two segments: subpage/album ──────────────────────────────
  if (path.length === 2) {
    const [subpageSlug, albumSlug] = path;

    // Password gate for protected subpages
    const gate = await gateIfProtected(subpageSlug);
    if (gate) return gate;

    const album = await immich.getAlbumBySlug(albumSlug, subpageSlug, forceFresh);

    if (!album) {
      if (await isAdminAuthenticated()) {
        return (
          <AdminDiagnosticBanner
            slug={`${subpageSlug}/${albumSlug}`}
            reason={`Album "${albumSlug}" could not be found or returned no assets from Immich.`}
          />
        );
      }
      notFound();
    }

    // Look up subpage config for grid overrides and back link
    const subpageData = await immich.getSubpageAlbums(subpageSlug, forceFresh);
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
        layout={resolveLayout(mergeAlbumGrid(album.id, spGrid))}
        gridStyle={buildGridStyle(mergeAlbumGrid(album.id, spGrid))}
        backLinkHref={`/${subpageSlug}`}
        backLinkLabel={`Back to ${subpageName}`}
        watermark={config.watermark}
        proofing={proofingFor(subpageData?.subpage)}
        allowMailto={config.proofing.allowMailto}
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

    const result = await immich.getSubpageAlbums(slug, forceFresh);
    if (!result || result.albums.length === 0) {
      if (await isAdminAuthenticated()) {
        const spConfig = config.subpages.find((sp) => sp.slug === slug);
        return (
          <AdminDiagnosticBanner
            slug={slug}
            subpageName={spConfig?.name}
            configuredAlbumCount={spConfig?.albumIds.length}
          />
        );
      }
      notFound();
    }

    const { albums } = result;

    // ── Photo Essay / Storytelling Mode ───────────────────────
    const isEssay =
      result.subpage.grid?.layout === 'essay' ||
      !!result.subpage.essayFile ||
      !!result.subpage.essayText;

    if (isEssay) {
      let essayParsed = result.subpage.essayText
        ? parseEssayMarkdown(result.subpage.essayText)
        : result.subpage.essayFile
          ? loadEssayFromFile(result.subpage.essayFile)
          : null;

      // Fetch assets from all subpage albums
      const allAlbums = await Promise.all(
        albums.map((a) => immich.getAlbumBySlug(a.slug, slug, forceFresh)),
      );
      const allAssets = allAlbums.flatMap((a) => (a ? a.assets : []));
      const images = toPhotoItems(allAssets, config.exifOnHover);

      // Fallback structured essay if layout: 'essay' is set without custom markdown file
      if (!essayParsed) {
        essayParsed = {
          frontmatter: {
            title: result.subpage.title || result.subpage.name,
            subtitle: result.subpage.subtitle,
          },
          blocks: albums.flatMap((a) => [
            { type: 'heading' as const, level: 2, text: a.albumName },
            ...a.assets.map((asset) => ({
              type: 'photo' as const,
              assetId: encodeAssetId(asset.id),
              caption: asset.exifInfo?.description || undefined,
              layout: 'contained' as const,
            })),
          ]),
          referencedAssetIds: [],
        };
      }

      // A published story is not an album handover, so an essay only gets the
      // proofing controls when its subpage asks for them explicitly — the
      // global default does not reach in here.
      const essayProofing = result.subpage.proofing === true;

      return (
        <EssayView
          essay={essayParsed}
          assets={images}
          title={result.subpage.title || result.subpage.name}
          subtitle={result.subpage.subtitle}
          watermark={config.watermark}
          proofing={essayProofing}
          allowMailto={config.proofing.allowMailto}
        />
      );
    }

    // ── Single album → full-bleed (skip album grid) ──────────
    if (albums.length === 1) {
      const album = await immich.getAlbumBySlug(albums[0].slug, slug, forceFresh);
      if (!album) {
        if (await isAdminAuthenticated()) {
          return (
            <AdminDiagnosticBanner
              slug={slug}
              subpageName={result.subpage.name}
              configuredAlbumCount={result.subpage.albumIds.length}
              reason={`Single album "${albums[0].albumName}" was not found or returned 0 assets.`}
            />
          );
        }
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
          layout={resolveLayout(mergeAlbumGrid(album.id, result.subpage.grid))}
          gridStyle={buildGridStyle(mergeAlbumGrid(album.id, result.subpage.grid))}
          subtitle={result.subpage.subtitle}
          backLinkHref="/"
          backLinkLabel="Back to Gallery"
          watermark={config.watermark}
          proofing={proofingFor(result.subpage)}
          allowMailto={config.proofing.allowMailto}
          {...heroData}
        />
      );
    }

    // ── Multiple albums → show album grid ─────────────────────

    // Override albumThumbnailAssetId with the configured hero image (if any)
    const albumsWithHero = albums.map((album) => {
      const heroId = config.albumHeroImages[album.id];
      // EXPERIMENTAL: coverPosition rides along so the card crop can honour
      // the configured focal point.
      const coverPosition = config.albumCoverPositions[album.id];
      return {
        ...album,
        ...(heroId ? { albumThumbnailAssetId: heroId } : {}),
        ...(coverPosition ? { coverPosition } : {}),
      };
    });

    // Batch-fetch ThumbHash for album cover placeholders
    const coverPlaceholders = await Promise.all(
      albumsWithHero.map(async (album) => {
        if (!album.albumThumbnailAssetId) return null;
        const asset = await immich.getAssetInfo(album.albumThumbnailAssetId);
        return asset ? assetPlaceholder(asset) : null;
      }),
    );

    // 1-based position among the enabled subpages — drives the header kicker.
    const enabledSubpages = config.subpages.filter((sp) => sp.enabled !== false);
    const subpageIndex = enabledSubpages.findIndex((sp) => sp.slug === slug);

    return (
      <SubpageGridView
        slug={slug}
        title={result.subpage.title || result.subpage.name}
        subtitle={result.subpage.subtitle}
        albums={albumsWithHero}
        coverPlaceholders={coverPlaceholders}
        sections={result.subpage.sections}
        {...(subpageIndex >= 0 ? { index: subpageIndex + 1 } : {})}
      />
    );
  }

  // Otherwise treat as a standalone album slug
  const album = await immich.getAlbumBySlug(slug, undefined, forceFresh);
  if (!album) {
    if (await isAdminAuthenticated()) {
      return (
        <AdminDiagnosticBanner
          slug={slug}
          reason={`Standalone album slug "${slug}" could not be found in published Immich albums.`}
        />
      );
    }
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
      layout={resolveLayout(mergeAlbumGrid(album.id))}
      gridStyle={buildGridStyle(mergeAlbumGrid(album.id))}
      backLinkHref="/"
      backLinkLabel="Back to Gallery"
      watermark={config.watermark}
      proofing={proofingFor()}
      allowMailto={config.proofing.allowMailto}
      {...heroData}
    />
  );
}
