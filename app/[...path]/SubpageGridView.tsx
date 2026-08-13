import Link from 'next/link';
import Image from 'next/image';
import { imageUrl } from '@/lib/urls';
import { SubpageSectionConfig } from '@/lib/config';

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
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const photoCount = (n: number) => `${n} ${n === 1 ? 'photo' : 'photos'}`;

function AlbumGrid({
  albums,
  placeholderMap,
  slug,
}: {
  albums: SubpageAlbum[];
  placeholderMap: Map<string, Placeholder | null>;
  slug: string;
}) {
  return (
    <div className="subpage-grid">
      {albums.map((album, i) => {
        const ph = placeholderMap.get(album.id) ?? null;
        return (
          <Link
            key={album.id}
            href={`/${slug}/${album.slug}`}
            className="subpage-grid__item"
            style={ph?.dominantColor ? { backgroundColor: ph.dominantColor } : undefined}
            aria-label={`${album.albumName}, ${photoCount(album.assetCount)}`}
          >
            <span className="subpage-grid__item-media">
              {album.albumThumbnailAssetId ? (
                <Image
                  src={imageUrl(album.albumThumbnailAssetId, 'preview')}
                  alt=""
                  fill
                  sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw"
                  loading="lazy"
                  {...(album.coverPosition ? { style: { objectPosition: album.coverPosition } } : {})}
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
}: SubpageGridViewProps) {
  // Build lookup maps once
  const albumMap = new Map(albums.map((a) => [a.id, a]));
  const placeholderMap = new Map(albums.map((a, i) => [a.id, coverPlaceholders[i] ?? null]));

  const hasSections = sections && sections.length > 0;
  const totalPhotos = albums.reduce((sum, a) => sum + a.assetCount, 0);

  return (
    <div className="subpage-container">
      {(title || subtitle) && (
        <header className="subpage-header">
          <div className="subpage-header__main">
            {index !== undefined && (
              <p className="subpage-header__kicker" aria-hidden="true">
                {pad2(index)} — Collection
              </p>
            )}
            {title && <h1 className="subpage-title">{title}</h1>}
            {subtitle && <p className="subpage-subtitle">{subtitle}</p>}
          </div>
          <p className="subpage-header__meta" aria-hidden="true">
            {albums.length} {albums.length === 1 ? 'album' : 'albums'} · {photoCount(totalPhotos)}
          </p>
        </header>
      )}

      {/* Typographic Table of Contents */}
      {hasSections && (
        <nav className="subpage-toc" aria-label="Sections">
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
              <AlbumGrid albums={sectionAlbums} placeholderMap={placeholderMap} slug={slug} />
            </section>
          );
        })
      ) : (
        /* Flat layout (no sections) */
        <AlbumGrid albums={albums} placeholderMap={placeholderMap} slug={slug} />
      )}
    </div>
  );
}
