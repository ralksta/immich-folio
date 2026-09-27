/**
 * HeroCarousel — crossfade between hero images on a timer.
 *
 * If only one image is provided, renders a static image with no timer.
 * When multiple images are provided, crossfades between them every 6 seconds
 * — unless the visitor prefers reduced motion, or has paused it with the
 * pause control (WCAG 2.2.2: anything that moves on its own for more than
 * five seconds needs a way to stop it, #696).
 */

'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { useDictionary } from './I18nProvider';

interface HeroImage {
  src: string;
  blurDataURL?: string;
  /** Pre-formatted camera line, shown as a chip by presets that use it. */
  exif?: string;
}

interface HeroCarouselProps {
  images: HeroImage[];
  /**
   * `sizes` for next/image. Most heroes are full-width; only the split hero's
   * image panel is half the viewport, and only above the mobile breakpoint.
   */
  sizes?: string;
}

export const INTERVAL_MS = 6000;

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const mql = window.matchMedia(REDUCED_MOTION);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/** True when the visitor asked the OS for less motion. False during SSR. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

export function HeroCarousel({ images, sizes = '100vw' }: HeroCarouselProps) {
  const t = useDictionary();
  const [currentIndex, setCurrentIndex] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  // null = the visitor has not touched the control; the default then follows
  // the motion preference. An explicit play overrides reduced motion.
  const [pausedByUser, setPausedByUser] = useState<boolean | null>(null);
  const paused = pausedByUser ?? reducedMotion;

  const advance = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (images.length <= 1 || paused) return;

    const timer = setInterval(advance, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [images.length, advance, paused]);

  if (images.length === 0) {
    return <div className="hero__image-placeholder" />;
  }

  if (images.length === 1) {
    const img = images[0];
    return (
      <>
        <Image
          src={img.src}
          alt=""
          className="hero__image"
          fill
          sizes={sizes}
          priority
          {...(img.blurDataURL
            ? { placeholder: 'blur' as const, blurDataURL: img.blurDataURL }
            : {})}
        />
        <HeroExifChip text={img.exif} />
      </>
    );
  }

  return (
    <>
      {images.map((img, i) => (
        <Image
          key={i}
          src={img.src}
          alt=""
          className={`hero__carousel-image${i === currentIndex ? ' hero__carousel-image--active' : ''}`}
          fill
          sizes={sizes}
          priority={i === 0}
          {...(img.blurDataURL
            ? { placeholder: 'blur' as const, blurDataURL: img.blurDataURL }
            : {})}
        />
      ))}
      <HeroExifChip text={images[currentIndex]?.exif} />
      <button
        type="button"
        className="hero__carousel-toggle"
        aria-label={paused ? t.home.playSlideshow : t.home.pauseSlideshow}
        title={paused ? t.home.playSlideshow : t.home.pauseSlideshow}
        data-paused={paused}
        onClick={() => setPausedByUser(!paused)}
      >
        {paused ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" />
            <rect x="14" y="5" width="4" height="14" />
          </svg>
        )}
      </button>
    </>
  );
}

/** Camera line over the hero image. Hidden unless the preset shows it. */
function HeroExifChip({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <span className="hero__exif-chip" aria-hidden="true">
      {text}
    </span>
  );
}
