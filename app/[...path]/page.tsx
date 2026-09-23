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
  assetCaption,
  assetExifSummary,
  downloadUrl,
  archiveUrl,
  assetAspectRatio,
} from '@/lib/urls';
import { encodeAssetId, decodeAssetId } from '@/lib/tokens';
import {
  buildCoverGridVars,
  getConfig,
  hasExifPanelContent,
  normalizeSlug,
  resolveProofing,
  type GridConfig,
} from '@/lib/config';
import { isProtected, isAuthenticated, withoutLockedAlbums } from '@/lib/auth';
import { isAdminAuthenticated } from '@/lib/admin/auth';
import PasswordGate from '@/components/PasswordGate';
import { AdminDiagnosticBanner } from '@/components/AdminDiagnosticBanner';
import { AlbumDetailView } from './AlbumDetailView';
import { albumNeighbours } from '@/lib/albumNav';
import { albumStructuredData } from '@/lib/structuredData';
import { absoluteUrl } from '@/lib/siteUrl';
import { SubpageGridView } from './SubpageGridView';
import { EssayView } from './EssayView';
import { parseEssayMarkdown, type EssayBlock } from '@/lib/essay';
import { pinsForEntry } from '@/lib/journalMap';
import { expandAlbumBlocks } from '@/lib/journalAlbum';
import { mapBlockAssetIds } from '@/lib/journal';
import { strictestPrecision, type LocationPrecision } from '@/lib/mapPrecision';
import { loadEssayFromFile } from '@/lib/admin/journal-service';
import { getServerDictionary } from '@/lib/i18n/server';

// Render at request time — requires live Immich connection
export const dynamic = 'force-dynamic';

interface PathPageProps {
  params: Promise<{ path: string[] }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Whether `key` is password-protected and this request has not unlocked it.
 * generateMetadata runs unconditionally — unlike the page body, nothing
 * downstream of it stops a real title, photo count or cover image from
 * reaching an unauthenticated `<head>` unless this is checked first
 * (GHSA-fvgv-97g3-wjr7).
 */
async function isLocked(key: string, type: 'subpage' | 'album'): Promise<boolean> {
  if (!isProtected(key, type)) return false;
  const cookieStore = await cookies();
  const getCookie = (name: string) => cookieStore.get(name)?.value;
  return !isAuthenticated(key, getCookie, type);
}

export async function generateMetadata({ params, searchParams }: PathPageProps): Promise<Metadata> {
  // Next hands catch-all segments over percent-encoded, so a non-ASCII slug
  // ("/家族相册") would never match a stored one. Decode once, here, and every
  // comparison downstream works on the same form (#522).
  const { path: rawPath } = await params;
  const path = rawPath?.map(normalizeSlug);
  if (!path || path.length === 0) return {};

  // A shared photo link's whole point is that it reaches the server — unlike
  // the #photo-N hash it replaces, a `photo` query param is visible here, so
  // a link-preview bot can render the photo itself rather than the album's
  // generic card (#588).
  const sp = (await searchParams) || {};
  const photoToken = typeof sp.photo === 'string' ? sp.photo : undefined;
  const photoAssetId = photoToken ? decodeAssetId(photoToken) : null;
  let photoAsset: ImmichAsset | undefined;

  const slug = path[0];
  let title = slug;
  let subtitle = '';
  let description: string | undefined = undefined;
  if (path.length === 1 && immich.isSubpageSlug(slug)) {
    const subpageLocked = await isLocked(slug, 'subpage');
    const result = await immich.getSubpageAlbums(slug);
    if (result) {
      if (!subpageLocked && result.subpage.subtitle) {
        description = result.subpage.subtitle;
      }
      if (result.albums.length === 1) {
        const album = await immich.getAlbumBySlug(result.albums[0].slug, slug);
        if (album && !subpageLocked && !(await isLocked(album.id, 'album'))) {
          title = album.albumName;
          const count = album.assets.filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO').length;
          subtitle = `${count} photo${count === 1 ? '' : 's'}`;
          if (photoAssetId) photoAsset = album.assets.find((a) => a.id === photoAssetId);
        }
      } else if (!subpageLocked) {
        title = result.subpage.title || result.subpage.name;
      }
    }
  } else if (path.length === 2) {
    const album = await immich.getAlbumBySlug(path[1], slug);
    if (album && !(await isLocked(slug, 'subpage')) && !(await isLocked(album.id, 'album'))) {
      title = album.albumName;
      const count = album.assets.filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO').length;
      subtitle = `${count} photo${count === 1 ? '' : 's'}`;
      if (photoAssetId) photoAsset = album.assets.find((a) => a.id === photoAssetId);
    }
  } else {
    const album = await immich.getAlbumBySlug(slug);
    if (album && !(await isLocked(album.id, 'album'))) {
      title = album.albumName;
      const count = album.assets.filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO').length;
      subtitle = `${count} photo${count === 1 ? '' : 's'}`;
      if (photoAssetId) photoAsset = album.assets.find((a) => a.id === photoAssetId);
    }
  }

  // The title stays the album's — it's still the context a reader wants —
  // but the description prefers the photo's own caption, and the image is
  // the photo itself rather than the generated text card.
  const ogDescription =
    photoAsset?.exifInfo?.description?.trim() ||
    description ||
    (subtitle ? `${title} — ${subtitle}` : undefined);
  const ogImage = photoAsset
    ? imageUrl(photoAsset.id, 'preview')
    : `/api/og?title=${encodeURIComponent(title)}${subtitle ? `&subtitle=${encodeURIComponent(subtitle)}` : ''}`;

  return {
    title,
    description: ogDescription,
    openGraph: {
      title,
      description: ogDescription,
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: ogDescription,
      images: [ogImage],
    },
  };
}

/** Map Immich assets to PhotoItem props for the grid/lightbox. */
/**
 * `showExif` covers the hover overlay only, and that overlay carries camera,
 * lens and focal length — so it follows the `camera` group, not the panel.
 *
 * `showCaption` follows the `caption` group and decides whether the Immich
 * description becomes alt text; see `assetCaption`.
 */
function toPhotoItems(
  assets: ImmichAsset[],
  showExif: boolean,
  showCaption: boolean,
  /** The album offering downloads, or undefined when it does not. */
  downloadAlbumId?: string,
): PhotoItem[] {
  return assets
    .filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO')
    .map((a) => {
      const ph = assetPlaceholder(a);
      const exif = showExif && a.type === 'IMAGE' ? assetExifSummary(a) : undefined;
      const caption = assetCaption(a, showCaption);
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
        ...(caption ? { caption } : {}),
        ...(downloadAlbumId ? { downloadUrl: downloadUrl(downloadAlbumId, a.id) } : {}),
        aspectRatio: assetAspectRatio(a),
      };
    });
}

/**
 * JSON-LD for an album page. Null unless a site URL is configured — structured
 * data is a set of claims about absolute URLs, and there is nothing truthful to
 * claim without one (#472).
 */
function structuredDataFor(
  album: { albumName: string; description?: string; albumThumbnailAssetId?: string | null },
  path: string,
  photoCount: number,
) {
  const config = getConfig();
  const cover = album.albumThumbnailAssetId
    ? absoluteUrl(config.siteUrl, imageUrl(album.albumThumbnailAssetId, 'preview'))
    : null;
  return albumStructuredData({
    siteUrl: config.siteUrl,
    pageUrl: absoluteUrl(config.siteUrl, path),
    albumName: album.albumName,
    ...(album.description ? { description: album.description } : {}),
    coverUrl: cover,
    ...(config.legal.name?.trim() ? { creator: config.legal.name } : {}),
    ...(config.seo.license ? { license: config.seo.license } : {}),
    photoCount,
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
  // Next hands catch-all segments over percent-encoded, so a non-ASCII slug
  // ("/家族相册") would never match a stored one. Decode once, here, and every
  // comparison downstream works on the same form (#522).
  const { path: rawPath } = await params;
  const path = rawPath?.map(normalizeSlug);
  const sParams = (await searchParams) || {};
  // ?fresh=1 / ?preview=true forces a cache-bypassing Immich refetch — cheap
  // to trigger, and every subpage request fans out into an album-list fetch
  // plus paged metadata search calls per album. Gated to admins so it cannot
  // be used to force-refresh (or, before the immich.ts fix alongside this,
  // to empty) the shared cache from an unauthenticated request.
  const forceFresh =
    (sParams.fresh === '1' || sParams.preview === 'true') && (await isAdminAuthenticated());

  const config = getConfig();

  // Build grid CSS custom properties, optionally merging subpage overrides
  const buildGridStyle = (overrides?: Partial<GridConfig>): React.CSSProperties => {
    const g = { ...config.grid, ...overrides };
    // `gap` is only emitted when someone chose one. Each preset declares its own
    // photo spacing as part of its look (2px minimal, 40px monograph), and
    // emitting the resolved fallback unconditionally overwrote that — the three
    // presets that fought back with a hardcoded `column-gap` then ignored the
    // setting entirely, which is #513. Inline beats the preset's declaration, so
    // an explicit value still wins everywhere.
    return {
      '--grid-columns': g.columns,
      ...(overrides?.gap != null || config.gridGapExplicit ? { '--grid-gap': `${g.gap}px` } : {}),
      '--grid-aspect-ratio': g.aspectRatio,
    } as React.CSSProperties;
  };
  const resolveLayout = (overrides?: Partial<GridConfig>) =>
    overrides?.layout ?? config.grid.layout;

  // The album-cover grid on a subpage is sized by its own `coverGrid`, which
  // touches nothing but the cover tiles (#523). An unset column count still
  // falls back to the global one; `gap` deliberately does not follow the global
  // setting — see buildCoverGridVars() for why.
  const buildCoverGridStyle = (overrides?: Partial<GridConfig>): React.CSSProperties =>
    buildCoverGridVars(overrides, config.grid.columns) as React.CSSProperties;

  // Client proofing — `proofing.enabled` in settings.yaml is the default and a
  // subpage's own `proofing:` flag overrides it in either direction. Albums
  // reached without a subpage follow the global setting.
  const proofingFor = (subpage?: { proofing?: boolean }) =>
    resolveProofing(subpage, config.proofing.enabled);

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

    const images = toPhotoItems(
      album.assets,
      config.exif.onHover && config.exif.camera,
      config.exif.caption,
      config.albumDownloads[album.id] ? album.id : undefined,
    );

    // Password gate for protected albums
    const albumGate = await gateIfProtected(album.id, 'album', album.albumName);
    if (albumGate) return albumGate;

    const heroData = await getAlbumHeroData(album.id, config);

    // Neighbours come from the subpage list the visitor just came through, in
    // that list's own order, so "next" agrees with the grid they saw (#483).
    const nav = subpageData ? albumNeighbours(subpageData.albums, album.id, `/${subpageSlug}`) : {};

    return (
      <AlbumDetailView
        album={album}
        images={images}
        nav={nav}
        structuredData={structuredDataFor(album, `/${subpageSlug}/${albumSlug}`, images.length)}
        layout={resolveLayout(mergeAlbumGrid(album.id, spGrid))}
        gridStyle={buildGridStyle(mergeAlbumGrid(album.id, spGrid))}
        backLinkHref={`/${subpageSlug}`}
        backLinkLabel={getServerDictionary().common.backTo(subpageName)}
        watermark={config.watermark}
        showExifPanel={hasExifPanelContent(config.exif)}
        showGear={config.exif.camera}
        proofing={proofingFor(subpageData?.subpage)}
        allowMailto={config.proofing.allowMailto}
        downloadArchiveUrl={config.albumDownloads[album.id] ? archiveUrl(album.id) : undefined}
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

      // Fetch assets from the subpage's albums. An essay has no per-album
      // gate to pass through, so an album with its own password stays out
      // until it has been unlocked.
      const cookieStore = await cookies();
      const openAlbums = withoutLockedAlbums(albums, (name) => cookieStore.get(name)?.value);
      const allAlbums = await Promise.all(
        openAlbums.map((a) => immich.getAlbumBySlug(a.slug, slug, forceFresh)),
      );
      const allAssets = allAlbums.flatMap((a) => (a ? a.assets : []));

      // Album blocks in an essay file: expand them the way the journal page
      // does, from a raw fetch, and add those photos to the page's assets.
      // Their ids are encoded here because this path hands EssayView tokens.
      if (essayParsed?.blocks.some((b) => b.type === 'album')) {
        const byAlbum = new Map<string, typeof allAssets>();
        for (const b of essayParsed.blocks) {
          if (b.type !== 'album' || !b.albumId || byAlbum.has(b.albumId)) continue;
          try {
            byAlbum.set(b.albumId, await immich.getAlbumAssetsRaw(b.albumId));
          } catch (error) {
            // eslint-disable-next-line no-console
            console.warn(`[essay] ${slug}: album ${b.albumId} could not be loaded:`, error);
          }
        }
        const expanded = expandAlbumBlocks(
          essayParsed.blocks,
          (id) => byAlbum.get(id),
          config.albumManualOrders,
        );
        const albumIds = new Set(expanded.albumAssetIds);
        const known = new Set(allAssets.map((a) => a.id));
        for (const list of byAlbum.values()) {
          for (const asset of list) {
            if (!albumIds.has(asset.id) || known.has(asset.id)) continue;
            known.add(asset.id);
            allAssets.push(asset);
          }
        }
        essayParsed = {
          ...essayParsed,
          blocks: expanded.blocks.map((b) =>
            mapBlockAssetIds(b, (id) => (albumIds.has(id) ? encodeAssetId(id) : id)),
          ),
        };
      }

      const images = toPhotoItems(
        allAssets,
        config.exif.onHover && config.exif.camera,
        config.exif.caption,
      );

      // Fallback structured essay if layout: 'essay' is set without custom markdown file
      if (!essayParsed) {
        essayParsed = {
          frontmatter: {
            title: result.subpage.title || result.subpage.name,
            subtitle: result.subpage.subtitle,
          },
          blocks: openAlbums.flatMap((a) => [
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

      // Map blocks: pins from the subpage's own albums, each album's
      // `location:` precision applied (an asset in two albums takes the
      // stricter). Dropped entirely when the site has no map.
      if (essayParsed.blocks.some((b) => b.type === 'map')) {
        const precisionByAsset = new Map<string, LocationPrecision>();
        for (const album of allAlbums) {
          if (!album) continue;
          const level = config.albumLocationPrecision[album.id] ?? 'exact';
          for (const asset of album.assets) {
            const prev = precisionByAsset.get(asset.id);
            precisionByAsset.set(asset.id, prev ? strictestPrecision([prev, level]) : level);
          }
        }
        const precisionOf = (id: string) => precisionByAsset.get(id) ?? 'exact';
        const allIds = allAssets.map((a) => a.id);
        essayParsed = {
          ...essayParsed,
          blocks: essayParsed.blocks.flatMap((b): EssayBlock[] => {
            if (b.type !== 'map') return [b];
            if (!config.map) return [];
            const pins = pinsForEntry(b.items, allAssets, allIds, precisionOf);
            return [{ type: 'map', caption: b.caption, line: b.line, items: [], pins }];
          }),
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

      const images = toPhotoItems(
        album.assets,
        config.exif.onHover && config.exif.camera,
        config.exif.caption,
        config.albumDownloads[album.id] ? album.id : undefined,
      );

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
          backLinkLabel={getServerDictionary().common.backToGallery}
          watermark={config.watermark}
          showExifPanel={hasExifPanelContent(config.exif)}
          showGear={config.exif.camera}
          proofing={proofingFor(result.subpage)}
          allowMailto={config.proofing.allowMailto}
          downloadArchiveUrl={config.albumDownloads[album.id] ? archiveUrl(album.id) : undefined}
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

    // The subpage that follows this one in the same list the nav/homepage
    // build from — hidden and disabled subpages are already excluded there,
    // so "next" never points somewhere the visitor could not otherwise reach
    // (#591).
    const navSubpages = await immich.getSubpages(forceFresh);
    const navIndex = navSubpages.findIndex((sp) => sp.slug === slug);
    const nextSubpage =
      navIndex >= 0 && navIndex < navSubpages.length - 1 ? navSubpages[navIndex + 1] : undefined;

    return (
      <SubpageGridView
        slug={slug}
        title={result.subpage.title || result.subpage.name}
        subtitle={result.subpage.subtitle}
        albums={albumsWithHero}
        coverPlaceholders={coverPlaceholders}
        sections={result.subpage.sections}
        gridStyle={buildCoverGridStyle(result.subpage.coverGrid)}
        {...(subpageIndex >= 0 ? { index: subpageIndex + 1 } : {})}
        {...(nextSubpage
          ? { nextSubpage: { slug: nextSubpage.slug, name: nextSubpage.name } }
          : {})}
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

  const images = toPhotoItems(
    album.assets,
    config.exif.onHover && config.exif.camera,
    config.exif.caption,
    config.albumDownloads[album.id] ? album.id : undefined,
  );

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
      backLinkLabel={getServerDictionary().common.backToGallery}
      nav={albumNeighbours(await immich.getStandaloneAlbums(forceFresh), album.id)}
      structuredData={structuredDataFor(album, `/${slug}`, images.length)}
      watermark={config.watermark}
      showExifPanel={hasExifPanelContent(config.exif)}
      showGear={config.exif.camera}
      proofing={proofingFor()}
      allowMailto={config.proofing.allowMailto}
      downloadArchiveUrl={config.albumDownloads[album.id] ? archiveUrl(album.id) : undefined}
      {...heroData}
    />
  );
}
