/**
 * Homepage — renders different hero layouts based on theme config.
 *
 * Styles: split, fullbleed, minimal, stacked, typographic, mosaic.
 */

import Link from 'next/link';
import Image from 'next/image';
import { immich, type ImmichAsset } from '@/lib/immich';
import { getConfig } from '@/lib/config';
import { imageUrl, assetPlaceholder } from '@/lib/urls';
import { HeroCarousel } from '@/components/HeroCarousel';
import { FadeIn } from '@/components/FadeIn';

// Render at request time — requires live Immich connection
export const dynamic = 'force-dynamic';

type HeroSubpage = { slug: string; name: string; albumCount: number };
type HeroAlbum = { id: string; slug: string; albumName: string; assetCount: number };

const pad2 = (n: number) => String(n).padStart(2, '0');
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Flatten subpages + standalone albums into one indexed nav list.
 * Every entry carries an index and a count; presets decide what to show.
 */
function heroNavEntries(subpages: HeroSubpage[], albums: HeroAlbum[]) {
  return [
    ...subpages.map((sp) => ({
      key: `sp-${sp.slug}`,
      href: `/${sp.slug}`,
      label: sp.name,
      count: plural(sp.albumCount, 'album'),
    })),
    ...albums.map((a) => ({
      key: `al-${a.id}`,
      href: `/${a.slug}`,
      label: a.albumName,
      count: plural(a.assetCount, 'photo'),
    })),
  ];
}

/**
 * Camera line for the hero chip: "Q3 · 28MM · ƒ/5.6 · 1/250 · ISO 200".
 * Returns undefined when the asset carries no usable EXIF.
 */
function heroExifLine(asset: ImmichAsset): string | undefined {
  const e = asset.exifInfo;
  if (!e) return undefined;
  const parts = [
    e.city || e.model || undefined,
    e.focalLength ? `${Math.round(e.focalLength)}mm` : undefined,
    e.fNumber ? `ƒ/${e.fNumber}` : undefined,
    e.exposureTime ? `${e.exposureTime}s` : undefined,
    e.iso ? `ISO ${e.iso}` : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/** Shared nav links for hero sections. */
function HeroNavLinks({ subpages, albums }: { subpages: HeroSubpage[]; albums: HeroAlbum[] }) {
  return (
    <>
      {heroNavEntries(subpages, albums).map((entry, i) => (
        <Link key={entry.key} href={entry.href} className="hero__nav-link">
          <span className="hero__nav-index" aria-hidden="true">
            {pad2(i + 1)}
          </span>
          <span className="hero__nav-label">{entry.label}</span>
          <span className="hero__nav-count" aria-hidden="true">
            {entry.count}
          </span>
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
  subpages: HeroSubpage[];
  albums: HeroAlbum[];
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

  // Fetch ThumbHash + camera line for all hero images
  const heroData = await Promise.all(
    config.heroImages.map(async (id) => {
      const asset = await immich.getAssetInfo(id);
      const ph = asset ? assetPlaceholder(asset) : null;
      const exif = asset ? heroExifLine(asset) : undefined;
      return {
        src: imageUrl(id, 'preview'),
        ...(ph ? { blurDataURL: ph.blurDataURL } : {}),
        ...(exif ? { exif } : {}),
      };
    }),
  );

  const heroStyle = config.theme.heroStyle;

  // ── Cover (EXPERIMENTAL): fullscreen splash + single "Enter" link ─
  // Adobe-Portfolio-style welcome page: one fullbleed image, the site
  // title, and one link into the portfolio (the first nav entry).
  if (heroStyle === 'cover') {
    const entries = heroNavEntries(subpages, albums);
    const enterHref = entries[0]?.href ?? '/about';

    return (
      <div className="hero hero--cover">
        <HeroCarousel images={heroData} />
        <div className="hero__cover-overlay">
          <FadeIn delay={0}>
            <h1 className="hero__title">{config.siteTitle}</h1>
          </FadeIn>
          {config.siteSubtitle && (
            <FadeIn delay={100}>
              <p className="hero__subtitle">{config.siteSubtitle}</p>
            </FadeIn>
          )}
          <FadeIn delay={250}>
            <Link href={enterHref} className="hero__cover-enter">
              Enter
              <span className="hero__cover-enter-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </FadeIn>
        </div>
      </div>
    );
  }

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
              <HeroNavLinks subpages={subpages} albums={albums} />
            </nav>
          </FadeIn>
        </div>
      </div>
    );
  }

  // ── Stacked: fullbleed image + text at bottom + thumbnail strip ─
  if (heroStyle === 'stacked') {
    const allEntries = heroNavEntries(subpages, albums);

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
            {allEntries.map((entry, i) => (
              <Link key={entry.key} href={entry.href} className="hero__thumbnail-item">
                <span className="hero__thumbnail-index" aria-hidden="true">
                  {pad2(i + 1)}
                </span>
                <span className="hero__thumbnail-label">{entry.label}</span>
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
