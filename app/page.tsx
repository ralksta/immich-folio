/**
 * Homepage — renders different hero layouts based on theme config.
 *
 * Styles: split, fullbleed, minimal, stacked, typographic, mosaic.
 */

import Link from 'next/link';
import Image from 'next/image';
import { immich } from '@/lib/immich';
import { getConfig } from '@/lib/config';
import { imageUrl, assetPlaceholder } from '@/lib/urls';
import { HeroCarousel } from '@/components/HeroCarousel';
import { FadeIn } from '@/components/FadeIn';

// Render at request time — requires live Immich connection
export const dynamic = 'force-dynamic';

/** Shared nav links for hero sections. */
function HeroNavLinks({
  subpages,
  albums,
}: {
  subpages: { slug: string; name: string }[];
  albums: { id: string; slug: string; albumName: string }[];
}) {
  return (
    <>
      {subpages.map((sp) => (
        <Link key={sp.slug} href={`/${sp.slug}`} className="hero__nav-link">
          {sp.name}
        </Link>
      ))}
      {albums.map((album) => (
        <Link key={album.id} href={`/${album.slug}`} className="hero__nav-link">
          {album.albumName}
        </Link>
      ))}
    </>
  );
}

/** Title + optional subtitle + nav — shared by mosaic, minimal, fullbleed, split. */
function HeroTextContent({
  title,
  subtitle,
  subpages,
  albums,
}: {
  title: string;
  subtitle?: string;
  subpages: { slug: string; name: string }[];
  albums: { id: string; slug: string; albumName: string }[];
}) {
  return (
    <>
      <FadeIn delay={0}>
        <h1 className="hero__title">{title}</h1>
      </FadeIn>
      {subtitle && (
        <FadeIn delay={100}>
          <p className="hero__subtitle">{subtitle}</p>
        </FadeIn>
      )}
      <FadeIn delay={200}>
        <nav className="hero__nav">
          <HeroNavLinks subpages={subpages} albums={albums} />
        </nav>
      </FadeIn>
    </>
  );
}

export default async function HomePage() {
  const config = getConfig();

  if (config.needsSetup) {
    return null;
  }

  const [subpages, albums] = await Promise.all([
    immich.getSubpages(),
    immich.getStandaloneAlbums(),
  ]);

  // Fetch ThumbHash for all hero images
  const heroData = await Promise.all(
    config.heroImages.map(async (id) => {
      const asset = await immich.getAssetInfo(id);
      const ph = asset ? assetPlaceholder(asset) : null;
      return {
        src: imageUrl(id, 'preview'),
        ...(ph ? { blurDataURL: ph.blurDataURL } : {}),
      };
    }),
  );

  const heroStyle = config.theme.heroStyle;

  // ── Typographic: no image, pure text ───────────────────────────
  if (heroStyle === 'typographic') {
    return (
      <div className="hero hero--typographic">
        <div className="hero__content">
          <FadeIn delay={0}>
            <h1 className="hero__title">{config.siteTitle}</h1>
          </FadeIn>
          {config.siteSubtitle && (
            <FadeIn delay={100}>
              <p className="hero__subtitle">{config.siteSubtitle}</p>
            </FadeIn>
          )}
          <FadeIn delay={200}>
            <div className="hero__divider" />
          </FadeIn>
          <FadeIn delay={300}>
            <nav className="hero__nav hero__nav--indexed">
              {subpages.map((sp, i) => (
                <Link key={sp.slug} href={`/${sp.slug}`} className="hero__nav-link">
                  <span className="hero__nav-index">{String(i + 1).padStart(2, '0')}</span>
                  {sp.name}
                </Link>
              ))}
              {albums.map((album, i) => (
                <Link key={album.id} href={`/${album.slug}`} className="hero__nav-link">
                  <span className="hero__nav-index">
                    {String(subpages.length + i + 1).padStart(2, '0')}
                  </span>
                  {album.albumName}
                </Link>
              ))}
            </nav>
          </FadeIn>
        </div>
      </div>
    );
  }

  // ── Stacked: fullbleed image + text at bottom + thumbnail strip ─
  if (heroStyle === 'stacked') {
    // Fetch album thumbnails for the strip
    const allEntries = [
      ...subpages.map((sp) => ({ slug: sp.slug, name: sp.name })),
      ...albums.map((a) => ({ slug: a.slug, name: a.albumName })),
    ];

    return (
      <div className="hero hero--stacked">
        <div className="hero__stacked-image">
          <HeroCarousel images={heroData} />
          <div className="hero__stacked-overlay">
            <FadeIn delay={0}>
              <h1 className="hero__title">{config.siteTitle}</h1>
            </FadeIn>
            {config.siteSubtitle && (
              <FadeIn delay={100}>
                <p className="hero__subtitle">{config.siteSubtitle}</p>
              </FadeIn>
            )}
          </div>
        </div>
        <FadeIn delay={200}>
          <nav className="hero__thumbnail-strip">
            {allEntries.map((entry) => (
              <Link key={entry.slug} href={`/${entry.slug}`} className="hero__thumbnail-item">
                <span className="hero__thumbnail-label">{entry.name}</span>
              </Link>
            ))}
          </nav>
        </FadeIn>
      </div>
    );
  }

  // ── Mosaic: multi-image grid with frosted title overlay ────────
  if (heroStyle === 'mosaic') {
    return (
      <div className="hero hero--mosaic">
        <div className="hero__mosaic-grid">
          {heroData.slice(0, 4).map((img, i) => (
            <div key={i} className={`hero__mosaic-cell hero__mosaic-cell--${i + 1}`}>
              <Image
                src={img.src}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                priority={i < 2}
                {...(img.blurDataURL
                  ? { placeholder: 'blur' as const, blurDataURL: img.blurDataURL }
                  : {})}
              />
            </div>
          ))}
        </div>
        <div className="hero__mosaic-overlay">
          <HeroTextContent
            title={config.siteTitle}
            subtitle={config.siteSubtitle}
            subpages={subpages}
            albums={albums}
          />
        </div>
      </div>
    );
  }

  // ── Minimal: pure text, no image, simple centered ──────────────
  if (heroStyle === 'minimal') {
    return (
      <div className="hero hero--minimal">
        <div className="hero__content">
          <HeroTextContent
            title={config.siteTitle}
            subtitle={config.siteSubtitle}
            subpages={subpages}
            albums={albums}
          />
        </div>
      </div>
    );
  }

  // ── Fullbleed: full-viewport image + centered overlay ───────────
  if (heroStyle === 'fullbleed') {
    return (
      <div className="hero hero--fullbleed">
        <HeroCarousel images={heroData} />
        <div className="hero__fullbleed-overlay">
          <HeroTextContent
            title={config.siteTitle}
            subtitle={config.siteSubtitle}
            subpages={subpages}
            albums={albums}
          />
        </div>
      </div>
    );
  }

  // ── Split: left text panel, right image (default) ───────────────
  return (
    <div className="hero hero--split">
      {/* ── Left Panel ──────────────────────────────── */}
      <div className="hero__left">
        <div className="hero__content">
          <HeroTextContent
            title={config.siteTitle}
            subtitle={config.siteSubtitle}
            subpages={subpages}
            albums={albums}
          />
        </div>
      </div>

      {/* ── Right Panel (Hero Carousel) ─────────────── */}
      <div className="hero__right">
        <HeroCarousel images={heroData} />
      </div>
    </div>
  );
}
