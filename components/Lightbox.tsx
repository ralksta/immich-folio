/**
 * Lightbox — fullscreen image viewer with navigation and EXIF info.
 *
 * Features:
 * - Full-resolution image display
 * - Previous/Next navigation (arrows + swipe)
 * - Close (Esc, click outside, X button)
 * - EXIF metadata panel (fetched on demand)
 * - Preloads adjacent images
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { PhotoItem } from '@/app/[...path]/PhotoGrid';
import { useExif } from '@/hooks/useExif';
import { useSwipe } from '@/hooks/useSwipe';
import styles from './Lightbox.module.css';

interface LightboxProps {
  assets: PhotoItem[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export function Lightbox({ assets, currentIndex, onClose, onNext, onPrev }: LightboxProps) {
  const [showExif, setShowExif] = useState(false);
  const { exifData, exifLoading, fetchExif, clearExif } = useExif();
  const [imageLoaded, setImageLoaded] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const current = assets[currentIndex];
  const [mounted, setMounted] = useState(false);

  // Mount guard — createPortal needs document.body (client-only)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-focus the close button when the modal mounts
  useEffect(() => {
    if (mounted) {
      closeBtnRef.current?.focus();
    }
  }, [mounted]);

  // Reset EXIF data when switching images; refetch if panel is open
  useEffect(() => {
    clearExif();
    setImageLoaded(false);
    if (showExif && current) {
      fetchExif(current.exifUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // When the toggle is turned on or the image changes while open, fetch
  const handleExifToggle = useCallback(() => {
    const next = !showExif;
    setShowExif(next);
    if (next && current) {
      fetchExif(current.exifUrl);
    }
  }, [showExif, current, fetchExif]);

  // Preload adjacent images (skip videos — they stream on demand)
  useEffect(() => {
    const preload = (index: number) => {
      if (index >= 0 && index < assets.length && assets[index].type !== 'video') {
        const img = new Image();
        img.src = assets[index].previewUrl;
      }
    };
    preload(currentIndex + 1);
    preload(currentIndex - 1);
  }, [currentIndex, assets]);

  const { handleTouchStart, handleTouchEnd } = useSwipe({
    onSwipeLeft: onNext,
    onSwipeRight: onPrev,
  });

  // Listen for 'i' key to toggle EXIF
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'i' || e.key === 'I') {
        handleExifToggle();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleExifToggle]);

  // Click on overlay background → close
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  const lightboxJsx = (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={handleOverlayClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {/* Close button */}
      <button
        ref={closeBtnRef}
        className={styles.close}
        onClick={onClose}
        aria-label="Close"
        title="Close (Esc)"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Previous button */}
      <button
        className={`${styles.nav} ${styles.navPrev}`}
        onClick={onPrev}
        aria-label="Previous photo"
        title="Previous photo (Left arrow)"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Image or Video */}
      <div
        className={styles.imageContainer}
        style={{
          backgroundColor: current.dominantColor || '#000',
          backgroundImage:
            current.type !== 'video' && current.blurDataURL
              ? `url(${current.blurDataURL})`
              : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {current.type === 'video' && current.videoUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            className={`${styles.image}${imageLoaded ? ` ${styles.imageLoaded}` : ''}`}
            src={current.videoUrl}
            controls
            autoPlay={false}
            playsInline
            onCanPlay={() => setImageLoaded(true)}
            onError={() => console.error(`[Lightbox] Failed to load video: ${current.videoUrl}`)}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={`${styles.image}${imageLoaded ? ` ${styles.imageLoaded}` : ''}`}
            src={current.previewUrl}
            alt=""
            draggable={false}
            onLoad={() => setImageLoaded(true)}
            onError={() => console.error(`[Lightbox] Failed to load image: ${current.previewUrl}`)}
          />
        )}
      </div>

      {/* Next button */}
      <button
        className={`${styles.nav} ${styles.navNext}`}
        onClick={onNext}
        aria-label="Next photo"
        title="Next photo (Right arrow)"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>

      {/* Counter */}
      <div className={styles.counter} aria-live="polite" aria-atomic="true">
        <span className="sr-only">
          Photo {currentIndex + 1} of {assets.length}
        </span>
        <span aria-hidden="true">
          {currentIndex + 1} / {assets.length}
        </span>
      </div>

      {/* EXIF toggle */}
      <button
        className={styles.infoToggle}
        onClick={handleExifToggle}
        aria-expanded={showExif}
        aria-controls="exif-panel"
        aria-label="Toggle photo info"
        title="Toggle photo info (i)"
      >
        {showExif ? 'Hide Info' : 'Info'}
      </button>

      {/* EXIF panel */}
      {showExif && (
        <div id="exif-panel" className={styles.exifPanel}>
          {exifLoading ? (
            <div className={styles.exifRow}>
              <span className={styles.exifLabel}>Loading...</span>
            </div>
          ) : exifData ? (
            <>
              {exifData.model && (
                <div className={styles.exifRow}>
                  <span className={styles.exifLabel}>Camera</span>
                  <span className={styles.exifValue}>
                    {[exifData.make, exifData.model].filter(Boolean).join(' ')}
                  </span>
                </div>
              )}
              {exifData.lensModel && (
                <div className={styles.exifRow}>
                  <span className={styles.exifLabel}>Lens</span>
                  <span className={styles.exifValue}>{exifData.lensModel}</span>
                </div>
              )}
              {exifData.focalLength && (
                <div className={styles.exifRow}>
                  <span className={styles.exifLabel}>Focal Length</span>
                  <span className={styles.exifValue}>{exifData.focalLength}mm</span>
                </div>
              )}
              {exifData.fNumber && (
                <div className={styles.exifRow}>
                  <span className={styles.exifLabel}>Aperture</span>
                  <span className={styles.exifValue}>ƒ/{exifData.fNumber}</span>
                </div>
              )}
              {exifData.exposureTime && (
                <div className={styles.exifRow}>
                  <span className={styles.exifLabel}>Shutter</span>
                  <span className={styles.exifValue}>{exifData.exposureTime}s</span>
                </div>
              )}
              {exifData.iso && (
                <div className={styles.exifRow}>
                  <span className={styles.exifLabel}>ISO</span>
                  <span className={styles.exifValue}>{exifData.iso}</span>
                </div>
              )}
              {(exifData.city || exifData.country) && (
                <div className={styles.exifRow}>
                  <span className={styles.exifLabel}>Location</span>
                  <span className={styles.exifValue}>
                    {[exifData.city, exifData.country].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className={styles.exifRow}>
              <span className={styles.exifLabel}>No EXIF data available</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (!mounted) return null;
  return createPortal(lightboxJsx, document.body);
}
