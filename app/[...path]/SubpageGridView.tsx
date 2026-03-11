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
}

function AlbumGrid({
  albums,
  albumMap,
  placeholderMap,
  slug,
}: {
  albums: SubpageAlbum[];
  albumMap: Map<string, SubpageAlbum>;
  placeholderMap: Map<string, Placeholder | null>;
  slug: string;
}) {
  return (
    <div className="subpage-grid">
      {albums.map((album) => {
        const ph = placeholderMap.get(album.id) ?? null;
        return (
          <Link
            key={album.id}
            href={`/${slug}/${album.slug}`}
            className="subpage-grid__item"
            style={ph?.dominantColor ? { backgroundColor: ph.dominantColor } : undefined}
          >
            {album.albumThumbnailAssetId ? (
              <Image
                src={imageUrl(album.albumThumbnailAssetId, 'preview')}
                alt={album.albumName}
                fill
                sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw"
                loading="lazy"
                {...(ph ? { placeholder: 'blur' as const, blurDataURL: ph.blurDataURL } : {})}
              />
            ) : (
              <div className="skeleton" style={{ width: '100%', height: '100%' }} />
            )}
            <span className="subpage-grid__item-badge">
              {album.assetCount} {album.assetCount === 1 ? 'photo' : 'photos'}
            </span>
            <div className="subpage-grid__item-overlay">
              <span className="subpage-grid__item-title">{album.albumName}</span>
              <span className="subpage-grid__item-count">
                {album.assetCount} {album.assetCount === 1 ? 'photo' : 'photos'}
              </span>
            </div>
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
}: SubpageGridViewProps) {
  // Build lookup maps once
  const albumMap = new Map(albums.map((a) => [a.id, a]));
  const placeholderMap = new Map(albums.map((a, i) => [a.id, coverPlaceholders[i] ?? null]));

  const hasSections = sections && sections.length > 0;

  return (
    <div className="subpage-container">
      {(title || subtitle) && (
        <header className="subpage-header">
          {title && <h1 className="subpage-title">{title}</h1>}
          {subtitle && <p className="subpage-subtitle">{subtitle}</p>}
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
              <AlbumGrid
                albums={sectionAlbums}
                albumMap={albumMap}
                placeholderMap={placeholderMap}
                slug={slug}
              />
            </section>
          );
        })
      ) : (
        /* Flat layout (no sections) */
        <AlbumGrid
          albums={albums}
          albumMap={albumMap}
          placeholderMap={placeholderMap}
          slug={slug}
        />
      )}
    </div>
  );
}
