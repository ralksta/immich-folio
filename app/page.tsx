/**
 * Homepage — renders different hero layouts based on theme config.
 *
 * Styles: split, fullbleed, minimal, stacked, typographic, mosaic.
 */

import Link from 'next/link';
import Image from 'next/image';
import { immich, type ImmichAsset } from '@/lib/immich';
import { getConfig, type ExifDisplayConfig } from '@/lib/config';
import { assetLocationPrecision } from '@/lib/assetLocation';
import { placeLabel } from '@/lib/mapPrecision';
import { imageUrl, assetPlaceholder } from '@/lib/urls';
import { HeroCarousel } from '@/components/HeroCarousel';
import { FadeIn } from '@/components/FadeIn';
import { getServerDictionary } from '@/lib/i18n/server';
import { loadSiteNav } from '@/lib/siteNav.server';
import type { SiteNavLink } from '@/lib/siteNav';

// Render at request time — requires live Immich connection
export const dynamic = 'force-dynamic';

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Camera line for the hero chip: "Q3 · 28MM · ƒ/5.6 · 1/250 · ISO 200".
 * Returns undefined when the asset carries no usable EXIF.
 *
 * Honours the same `exif:` groups as the lightbox panel (`/api/exif`), and the
 * city passes the album's `location:` precision too — the chip is the most
 * visible EXIF on the site and must not publish what the owner switched off.
 */
async function heroExifLine(
  asset: ImmichAsset,
  show: ExifDisplayConfig,
): Promise<string | undefined> {
  const e = asset.exifInfo;
  if (!e) return undefined;
  const city = show.location
    ? placeLabel(await assetLocationPrecision(asset.id), { city: e.city ?? '', country: '' }).city
    : '';
  const parts = [
    city || (show.camera ? e.model : undefined) || undefined,
    show.camera && e.focalLength ? `${Math.round(e.focalLength)}mm` : undefined,
    show.settings && e.fNumber ? `ƒ/${e.fNumber}` : undefined,
    show.settings && e.exposureTime ? `${e.exposureTime}s` : undefined,
    show.settings && e.iso ? `ISO ${e.iso}` : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/** Shared nav links for hero sections — same entries and order as the header. */
function HeroNavLinks({ links }: { links: SiteNavLink[] }) {
  return (
    <>
      {links.map((entry, i) => (
        <Link key={entry.key} href={entry.href} className="hero__nav-link">
          <span className="hero__nav-index" aria-hidden="true">
            {pad2(i + 1)}
          </span>
          <span className="hero__nav-label">{entry.label}</span>
          {entry.count && (
            <span className="hero__nav-count" aria-hidden="true">
              {entry.count}
            </span>
          )}
        </Link>
      ))}
    </>
  );
}

/** Title + optional subtitle + nav — shared by mosaic, minimal, fullbleed, split. */
function HeroTextContent({
  title,
  subtitle,
  links,
  navLabel,
}: {
  title: string;
  subtitle?: string;
  links: SiteNavLink[];
  navLabel: string;
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
        <nav className="hero__nav" aria-label={navLabel}>
          <HeroNavLinks links={links} />
        </nav>
      </FadeIn>
    </>
  );
}

export default async function HomePage() {
  const config = getConfig();
  const t = getServerDictionary();

  if (config.needsSetup) {
    return null;
  }

  const links = await loadSiteNav();

  // Fetch ThumbHash + camera line for all hero images
  const heroData = await Promise.all(
    config.heroImages.map(async (id) => {
      const asset = await immich.getAssetInfo(id);
      const ph = asset ? assetPlaceholder(asset) : null;
      const exif = asset ? await heroExifLine(asset, config.exif) : undefined;
      return {
        src: imageUrl(id, 'preview'),
        ...(ph ? { blurDataURL: ph.blurDataURL } : {}),
        ...(exif ? { exif } : {}),
      };
    }),
  );

  const heroStyle = config.theme.heroStyle;

  // ── Cover (EXPERIMENTAL): fullscreen splash + single "Enter" link ─
  // Welcome-page splash: one fullbleed image, the site
  // title, and one link into the portfolio (the first nav entry).
  if (heroStyle === 'cover') {
    // No fallback: /about used to be hardcoded here and 404ed with About off.
    const enterHref = links[0]?.href;

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
          {enterHref && (
            <FadeIn delay={250}>
              <Link href={enterHref} className="hero__cover-enter">
                {t.home.enter}
                <span className="hero__cover-enter-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </FadeIn>
          )}
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
            <nav className="hero__nav hero__nav--indexed" aria-label={t.nav.heroNavAria}>
              <HeroNavLinks links={links} />
            </nav>
          </FadeIn>
        </div>
      </div>
    );
  }

  // ── Stacked: fullbleed image + text at bottom + thumbnail strip ─
  if (heroStyle === 'stacked') {
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
          <nav className="hero__thumbnail-strip" aria-label={t.nav.heroNavAria}>
            {links.map((entry, i) => (
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
            links={links}
            navLabel={t.nav.heroNavAria}
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
            links={links}
            navLabel={t.nav.heroNavAria}
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
            links={links}
            navLabel={t.nav.heroNavAria}
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
            links={links}
            navLabel={t.nav.heroNavAria}
          />
        </div>
      </div>

      {/* ── Right Panel (Hero Carousel) ─────────────── */}
      <div className="hero__right">
        <HeroCarousel images={heroData} sizes="(max-width: 640px) 100vw, 50vw" />
      </div>
    </div>
  );
}
