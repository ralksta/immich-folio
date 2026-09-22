import Link from 'next/link';
import Image from 'next/image';
import { imageUrl } from '@/lib/urls';
import { SubpageSectionConfig } from '@/lib/config';
import { getServerDictionary } from '@/lib/i18n/server';
import { BackLink } from '@/components/BackLink';

interface SubpageAlbum {
  id: string;
  slug: string;
  albumName: string;
  assetCount: number;
  albumThumbnailAssetId: string | null;
  /** EXPERIMENTAL: focal point for the cover crop (CSS object-position) */
  coverPosition?: string;
}

interface Placeholder {
  blurDataURL?: string;
  dominantColor?: string;
}

interface SubpageGridViewProps {
  slug: string;
  title?: string;
  subtitle?: string;
  albums: SubpageAlbum[];
  coverPlaceholders: (Placeholder | null)[];
  sections?: SubpageSectionConfig[];
  /** 1-based position among all subpages — feeds the "03 — Collection" kicker. */
  index?: number;
  /** `--subpage-columns` / `--subpage-gap` from the resolved grid config. */
  gridStyle?: React.CSSProperties;
  /** The subpage that follows this one in the nav/homepage order, if any (#591). */
  nextSubpage?: { slug: string; name: string };
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const photoCount = (n: number) => getServerDictionary().common.photos(n);

function AlbumGrid({
  albums,
  placeholderMap,
  slug,
  gridStyle,
}: {
  albums: SubpageAlbum[];
  placeholderMap: Map<string, Placeholder | null>;
  slug: string;
  gridStyle?: React.CSSProperties;
}) {
  return (
    <div className="subpage-grid" style={gridStyle}>
      {albums.map((album, i) => {
        const ph = placeholderMap.get(album.id) ?? null;
        return (
          <Link
            key={album.id}
            href={`/${slug}/${album.slug}`}
            className="subpage-grid__item"
            aria-label={getServerDictionary().subpage.coverAria(
              album.albumName,
              photoCount(album.assetCount),
            )}
          >
            {/* The loading colour belongs to the image, not the card: presets
                with a caption bar below the cover (studio-modern) would
                otherwise paint the bar in the photo's dominant colour, and
                their --text-primary caption becomes dark-on-dark in light mode. */}
            <span
              className="subpage-grid__item-media"
              style={ph?.dominantColor ? { backgroundColor: ph.dominantColor } : undefined}
            >
              {album.albumThumbnailAssetId ? (
                <Image
                  src={imageUrl(album.albumThumbnailAssetId, 'preview')}
                  alt=""
                  fill
                  sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw"
                  loading="lazy"
                  {...(album.coverPosition
                    ? { style: { objectPosition: album.coverPosition } }
                    : {})}
                  {...(ph ? { placeholder: 'blur' as const, blurDataURL: ph.blurDataURL } : {})}
                />
              ) : (
                <span
                  className="skeleton"
                  style={{ display: 'block', width: '100%', height: '100%' }}
                  aria-hidden="true"
                />
              )}
              <span className="subpage-grid__item-badge" aria-hidden="true">
                {photoCount(album.assetCount)}
              </span>
              <span className="subpage-grid__item-overlay" aria-hidden="true">
                <span className="subpage-grid__item-title">{album.albumName}</span>
                <span className="subpage-grid__item-count">{photoCount(album.assetCount)}</span>
              </span>
            </span>

            {/* Always-visible caption bar — shown by presets that use it. */}
            <span className="subpage-grid__item-caption" aria-hidden="true">
              <span className="subpage-grid__item-index">{pad2(i + 1)}</span>
              <span className="subpage-grid__item-caption-title">{album.albumName}</span>
              <span className="subpage-grid__item-caption-count">
                {photoCount(album.assetCount)}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function SubpageGridView({
  slug,
  title,
  subtitle,
  albums,
  coverPlaceholders,
  sections,
  index,
  gridStyle,
  nextSubpage,
}: SubpageGridViewProps) {
  // Build lookup maps once
  const albumMap = new Map(albums.map((a) => [a.id, a]));
  const placeholderMap = new Map(albums.map((a, i) => [a.id, coverPlaceholders[i] ?? null]));

  const t = getServerDictionary();
  const hasSections = sections && sections.length > 0;
  const totalPhotos = albums.reduce((sum, a) => sum + a.assetCount, 0);

  return (
    <div className="subpage-container">
      <header className="subpage-header">
        <div className="subpage-header__main">
          <BackLink href="/" label={t.common.backToGallery} />
          {index !== undefined && (
            <p className="subpage-header__kicker" aria-hidden="true">
              {t.subpage.collectionKicker(pad2(index))}
            </p>
          )}
          {title && <h1 className="subpage-title">{title}</h1>}
          {subtitle && <p className="subpage-subtitle">{subtitle}</p>}
        </div>
        {(title || subtitle) && (
          <p className="subpage-header__meta" aria-hidden="true">
            {t.common.albums(albums.length)} · {photoCount(totalPhotos)}
          </p>
        )}
      </header>

      {/* Typographic Table of Contents */}
      {hasSections && (
        <nav className="subpage-toc" aria-label={t.subpage.sectionsNav}>
          {sections.map((sec, i) => (
            <span key={sec.slug} className="subpage-toc__entry">
              <a href={`#${sec.slug}`} className="subpage-toc__link">
                <span className="subpage-toc__num">{String(i + 1).padStart(2, '0')}</span>
                <span className="subpage-toc__label">{sec.title}</span>
              </a>
            </span>
          ))}
        </nav>
      )}

      {/* Sectioned layout */}
      {hasSections ? (
        sections.map((sec) => {
          const sectionAlbums = sec.albumIds
            .map((id) => albumMap.get(id))
            .filter(Boolean) as SubpageAlbum[];

          return (
            <section key={sec.slug} id={sec.slug} className="subpage-section">
              <header className="subpage-section__header">
                <h2 className="subpage-section__title">{sec.title}</h2>
                {sec.description && <p className="subpage-section__desc">{sec.description}</p>}
                <div className="subpage-section__rule" aria-hidden="true" />
              </header>
              <AlbumGrid
                albums={sectionAlbums}
                placeholderMap={placeholderMap}
                slug={slug}
                gridStyle={gridStyle}
              />
            </section>
          );
        })
      ) : (
        /* Flat layout (no sections) */
        <AlbumGrid
          albums={albums}
          placeholderMap={placeholderMap}
          slug={slug}
          gridStyle={gridStyle}
        />
      )}

      {/* Onward navigation to the next subpage in nav order (#591) — a subpage
          grid otherwise dead-ends into the browser's back button. */}
      {nextSubpage && (
        <nav className="album-nav" aria-label={t.subpage.nextSubpageAria(nextSubpage.name)}>
          <span aria-hidden="true" />
          <Link
            href={`/${nextSubpage.slug}`}
            className="album-nav__link album-nav__link--next"
            aria-label={t.subpage.nextSubpageAria(nextSubpage.name)}
          >
            <span className="album-nav__text">
              <span className="album-nav__kicker">{t.subpage.nextSubpage}</span>
              <span className="album-nav__name">{nextSubpage.name}</span>
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </nav>
      )}
    </div>
  );
}
