/**
 * HeroCarousel — crossfade between hero images on a timer.
 *
 * If only one image is provided, renders a static image with no timer.
 * When multiple images are provided, crossfades between them every 6 seconds.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface HeroImage {
  src: string;
  blurDataURL?: string;
  /** Pre-formatted camera line, shown as a chip by presets that use it. */
  exif?: string;
}

interface HeroCarouselProps {
  images: HeroImage[];
}

const INTERVAL_MS = 6000;

export function HeroCarousel({ images }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const advance = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (images.length <= 1) return;

    const timer = setInterval(advance, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [images.length, advance]);

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
          sizes="50vw"
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
          sizes="50vw"
          priority={i === 0}
          {...(img.blurDataURL
            ? { placeholder: 'blur' as const, blurDataURL: img.blurDataURL }
            : {})}
        />
      ))}
      <HeroExifChip text={images[currentIndex]?.exif} />
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
