/**
 * PhotoGrid — client component wrapping the masonry grid and lightbox.
 * Handles image click → lightbox open, keyboard nav, and EXIF fetching.
 *
 * Deep-link support: syncs lightbox index with the URL hash (#photo-N).
 * Sharing a link with a hash opens the lightbox to that photo directly.
 */

'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Lightbox } from '@/components/Lightbox';
import { FadeIn } from '@/components/FadeIn';

export interface PhotoItem {
  id: string;
  thumbUrl: string;
  previewUrl: string;
  originalUrl: string;
  exifUrl: string;
  blurDataURL?: string;
  dominantColor?: string;
  /** Compact EXIF summary for hover overlay */
  camera?: string;
  lens?: string;
  focalLength?: string;
  /** Natural image aspect ratio (width/height) for masonry layout */
  aspectRatio?: number;
}

interface PhotoGridProps {
  assets: PhotoItem[];
  layout?: 'masonry' | 'uniform' | 'showcase' | 'filmstrip' | 'editorial-flow';
  gridStyle?: React.CSSProperties;
}

/** Parse `#photo-N` from a hash string. Returns index or null. */
function parsePhotoHash(hash: string): number | null {
  const match = hash.match(/^#photo-(\d+)$/);
  if (!match) return null;
  const idx = parseInt(match[1], 10) - 1; // 1-indexed in URL, 0-indexed internally
  return idx >= 0 ? idx : null;
}

/** Build the hash string for a given 0-based index. */
function buildPhotoHash(index: number): string {
  return `#photo-${index + 1}`; // 1-indexed for user-friendliness
}

export function PhotoGrid({ assets, layout = 'masonry', gridStyle }: PhotoGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // ── Initial hash check (Client-only to avoid hydration mismatch) ──
  useEffect(() => {
    const idx = parsePhotoHash(window.location.hash);
    if (idx !== null && idx < assets.length) {
      // state from URL hash on mount only (equivalent to useState lazy initializer for
      // client-only browser APIs).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLightboxIndex(idx);
    }
  }, [assets.length]);

  // ── Sync URL hash when lightbox state changes ─────────────────
  useEffect(() => {
    if (lightboxIndex !== null && lightboxIndex < assets.length) {
      const hash = buildPhotoHash(lightboxIndex);
      // Use replaceState to avoid flooding history with every prev/next tap
      if (window.location.hash !== hash) {
        window.history.replaceState(null, '', hash);
      }
    }
  }, [lightboxIndex, assets.length]);

  // ── Listen for browser back/forward (hash change) ─────────────
  useEffect(() => {
    const handleHashChange = () => {
      const idx = parsePhotoHash(window.location.hash);
      if (idx !== null && idx < assets.length) {
        setLightboxIndex(idx);
      } else {
        setLightboxIndex(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [assets.length]);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    // Push state (not replace) so the user can press Back to close
    window.history.pushState(null, '', buildPhotoHash(index));
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
    // Remove hash from URL cleanly
    window.history.pushState(null, '', window.location.pathname + window.location.search);
  }, []);

  const goNext = useCallback(() => {
    setLightboxIndex((prev) => (prev !== null ? (prev + 1) % assets.length : null));
  }, [assets.length]);

  const goPrev = useCallback(() => {
    setLightboxIndex((prev) => (prev !== null ? (prev - 1 + assets.length) % assets.length : null));
  }, [assets.length]);

  // Keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          closeLightbox();
          break;
        case 'ArrowRight':
          goNext();
          break;
        case 'ArrowLeft':
          goPrev();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [lightboxIndex, closeLightbox, goNext, goPrev]);

  // Memoize grid items to prevent re-renders of the entire grid (which includes
  // Image and FadeIn components) when navigating the lightbox.
  const gridItems = useMemo(() => {
    return assets.map((asset, index) => (
      <FadeIn key={asset.id} delay={index < 12 ? index * 50 : 0}>
        <div
          className={`photo-grid__item${
            layout === 'showcase' && index === 0 ? ' photo-grid__featured' : ''
          }`}
          onClick={() => openLightbox(index)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openLightbox(index);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`View photo ${index + 1}`}
          aria-haspopup="dialog"
          style={{
            ...(asset.dominantColor ? { backgroundColor: asset.dominantColor } : {}),
            ...((layout === 'masonry' || layout === 'showcase') && asset.aspectRatio
              ? { aspectRatio: `${asset.aspectRatio}` }
              : {}),
          }}
        >
          <Image
            src={asset.thumbUrl}
            alt=""
            fill
            sizes="(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 25vw"
            loading={index < 6 ? 'eager' : 'lazy'}
            {...(asset.blurDataURL
              ? { placeholder: 'blur' as const, blurDataURL: asset.blurDataURL }
              : {})}
          />
          {(asset.camera || asset.lens) && (
            <div className="photo-grid__item-exif" aria-hidden="true">
              {[asset.camera, asset.lens, asset.focalLength].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      </FadeIn>
    ));
  }, [assets, layout, openLightbox]);

  return (
    <>
      <div className={`photo-grid photo-grid--${layout}`} style={gridStyle}>
        {gridItems}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          assets={assets}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onNext={goNext}
          onPrev={goPrev}
        />
      )}
    </>
  );
}
