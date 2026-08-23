/**
 * Lightbox — fullscreen image viewer with navigation and EXIF info.
 *
 * Features:
 * - Full-resolution image display
 * - Previous/Next navigation (arrows + swipe)
 * - Close (Esc, click outside, X button)
 * - EXIF metadata panel (fetched on demand)
 * - Keyboard shortcut list (`?` or `h`), deliberately unadvertised
 * - Real fullscreen (`f`), where the browser offers it
 * - Preloads adjacent images
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { PhotoItem } from '@/app/[...path]/PhotoGrid';
import { useExif } from '@/hooks/useExif';
import { useSwipe } from '@/hooks/useSwipe';
import styles from './Lightbox.module.css';
import { useProofing } from './ProofingContext';
import { IconHeart } from './Icons';
import { useDictionary } from './I18nProvider';
// From lib/config/schema directly: lib/config/index.ts pulls in `fs`, which a
// client component cannot import.
import { resolveWatermarkOpacity } from '@/lib/config/schema';
import { formatCamera } from '@/lib/exif';

export interface LightboxWatermark {
  enabled?: boolean;
  text?: string;
  opacity?: number;
  position?: 'bottom-right' | 'bottom-left' | 'center' | string;
}

interface LightboxProps {
  assets: PhotoItem[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  watermark?: LightboxWatermark;
  /**
   * Show the EXIF ("Info") toggle. Off for editorial contexts such as journal
   * entries, where a technical data panel interrupts the story.
   */
  showExifToggle?: boolean;
}

export function Lightbox({
  assets,
  currentIndex,
  onClose,
  onNext,
  onPrev,
  watermark,
  showExifToggle = true,
}: LightboxProps) {
  const t = useDictionary();
  const [showExif, setShowExif] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const { exifData, exifLoading, fetchExif, clearExif } = useExif();
  const [imageLoaded, setImageLoaded] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const current = assets[currentIndex];
  const proofing = useProofing();
  const isFav = proofing && current ? proofing.isFavorite(current.id) : false;
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

  const toggleShortcuts = useCallback(() => {
    setShowShortcuts((open) => !open);
  }, []);

  /*
   * Real fullscreen. The overlay already covers the viewport, but the browser's
   * own chrome sits above it — tab strip, URL bar, bookmarks — which is exactly
   * the frame a photograph should not be shown in.
   *
   * `fullscreenEnabled` is the honest gate: iPhone Safari implements the API on
   * `<video>` only, so the key and its shortcut row are simply absent there
   * rather than failing silently.
   */
  useEffect(() => {
    setCanFullscreen(typeof document !== 'undefined' && !!document.fullscreenEnabled);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    // Every rejection here is a decision the browser is entitled to make
    // (denied permission, gesture requirement, already exiting) — the state
    // then simply stays where it was.
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void overlay.requestFullscreen().catch(() => {});
    }
  }, []);

  /*
   * The state is derived from the event, never from the click: F11, the browser
   * Esc and the window manager all leave fullscreen without asking us.
   */
  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  /*
   * Leaving the lightbox by any route — X, backdrop click, Esc, a navigation —
   * unmounts this component while the document is still fullscreen. Without
   * this the visitor is left in a fullscreen *gallery page* with no obvious way
   * back. Only ever exits a fullscreen this component asked for.
   */
  useEffect(() => {
    const overlay = overlayRef.current;
    return () => {
      if (overlay && document.fullscreenElement === overlay) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

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

  /*
   * Keyboard control and the scroll lock belong to the lightbox, not to whoever
   * opens it: PhotoGrid used to install the arrow keys itself, so every other
   * caller (EssayView, i.e. journal entries and photo essays) silently had no
   * keyboard navigation at all.
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          // Innermost layer first: Esc dismisses the shortcut list, then leaves
          // fullscreen, and only closes the viewer once nothing is stacked on
          // top of it. Most browsers swallow this Esc to exit fullscreen
          // themselves and never dispatch it — the middle branch is for the
          // ones that do dispatch it, which would otherwise close the lightbox
          // and leave the page behind it fullscreen.
          if (showShortcuts) setShowShortcuts(false);
          else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
          else onClose();
          break;
        case 'ArrowRight':
          onNext();
          break;
        case 'ArrowLeft':
          onPrev();
          break;
        case 'i':
        case 'I':
          if (showExifToggle) handleExifToggle();
          break;
        // `?` is matched on the produced character, not the physical key:
        // Shift+/ on a US layout, Shift+ß on a German one. `h` is the escape
        // hatch for layouts where `?` is awkward — and the one key someone
        // guesses without having been told.
        case '?':
        case 'h':
        case 'H':
          toggleShortcuts();
          break;
        case 'f':
        case 'F':
          if (canFullscreen) toggleFullscreen();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [
    canFullscreen,
    handleExifToggle,
    onClose,
    onNext,
    onPrev,
    showExifToggle,
    showShortcuts,
    toggleFullscreen,
    toggleShortcuts,
  ]);

  // Click on overlay background → close
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  /*
   * The advertised shortcuts, in the order they are worth learning. This is the
   * list the `?` panel renders — a key added to the handler above belongs here
   * too, or it stays as undiscoverable as the whole set was before.
   */
  const shortcutRows = [
    { keys: ['←', '→'], label: t.lightbox.shortcutNavigate },
    // Journal entries hide the EXIF toggle, so `i` does nothing there.
    ...(showExifToggle ? [{ keys: ['I'], label: t.lightbox.shortcutInfo }] : []),
    // Absent where the browser has no element fullscreen to give (iPhone).
    ...(canFullscreen
      ? [
          {
            keys: ['F'],
            label: isFullscreen ? t.lightbox.shortcutExitFullscreen : t.lightbox.shortcutFullscreen,
          },
        ]
      : []),
    { keys: ['?', 'H'], label: t.lightbox.shortcutList },
    { keys: ['Esc'], label: t.lightbox.shortcutClose },
  ];

  const lightboxJsx = (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={handleOverlayClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label={t.lightbox.viewer}
    >
      {/* Close button */}
      <button
        ref={closeBtnRef}
        className={styles.close}
        onClick={onClose}
        aria-label={t.lightbox.close}
        title={t.lightbox.closeTitle}
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
        aria-label={t.lightbox.previous}
        title={t.lightbox.previousTitle}
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
            alt={current.caption ?? ''}
            draggable={false}
            onLoad={() => setImageLoaded(true)}
            onError={() => console.error(`[Lightbox] Failed to load image: ${current.previewUrl}`)}
          />
        )}

        {watermark?.enabled && watermark.text && (
          <div
            className={`${styles.watermark} ${
              watermark.position === 'bottom-left'
                ? styles.watermark_bottom_left
                : watermark.position === 'center'
                  ? styles.watermark_center
                  : styles.watermark_bottom_right
            }`}
            style={{ opacity: resolveWatermarkOpacity(watermark.opacity) }}
          >
            {watermark.text}
          </div>
        )}
      </div>

      {/* Next button */}
      <button
        className={`${styles.nav} ${styles.navNext}`}
        onClick={onNext}
        aria-label={t.lightbox.next}
        title={t.lightbox.nextTitle}
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

      {/* Proofing favorite button */}
      {proofing && current && (
        <button
          className={`${styles.infoToggle} ${styles.favToggle}`}
          style={{
            color: isFav ? '#ff4d4f' : 'inherit',
            fontWeight: isFav ? 600 : 400,
          }}
          onClick={() => proofing.toggleFavorite(current.id)}
          aria-label={isFav ? t.proofing.removeFromFavorites : t.proofing.addToFavorites}
          title={isFav ? t.proofing.removeFromFavorites : t.proofing.addToFavorites}
        >
          <IconHeart size={14} fill={isFav ? 'currentColor' : 'none'} aria-hidden="true" />
          {isFav ? t.proofing.saved : t.proofing.favorite}
        </button>
      )}

      {/* EXIF toggle */}
      {showExifToggle && (
        <button
          className={styles.infoToggle}
          onClick={handleExifToggle}
          aria-expanded={showExif}
          aria-controls="exif-panel"
          aria-label={t.lightbox.toggleInfo}
          title={t.lightbox.toggleInfoTitle}
        >
          {showExif ? t.lightbox.hideInfo : t.lightbox.info}
        </button>
      )}

      {/* EXIF panel */}
      {showExif && (
        <div id="exif-panel" className={styles.exifPanel}>
          {exifLoading ? (
            <div className={styles.exifRow}>
              <span className={styles.exifLabel}>{t.lightbox.loading}</span>
            </div>
          ) : exifData ? (
            <>
              {exifData.description && <p className={styles.exifCaption}>{exifData.description}</p>}
              {exifData.model && (
                <div className={styles.exifRow}>
                  <span className={styles.exifLabel}>{t.lightbox.camera}</span>
                  <span className={styles.exifValue}>
                    {formatCamera(exifData.make, exifData.model)}
                  </span>
                </div>
              )}
              {exifData.lensModel && (
                <div className={styles.exifRow}>
                  <span className={styles.exifLabel}>{t.lightbox.lens}</span>
                  <span className={styles.exifValue}>{exifData.lensModel}</span>
                </div>
              )}
              {exifData.focalLength && (
                <div className={styles.exifRow}>
                  <span className={styles.exifLabel}>{t.lightbox.focalLength}</span>
                  <span className={styles.exifValue}>{exifData.focalLength}mm</span>
                </div>
              )}
              {exifData.fNumber && (
                <div className={styles.exifRow}>
                  <span className={styles.exifLabel}>{t.lightbox.aperture}</span>
                  <span className={styles.exifValue}>ƒ/{exifData.fNumber}</span>
                </div>
              )}
              {exifData.exposureTime && (
                <div className={styles.exifRow}>
                  <span className={styles.exifLabel}>{t.lightbox.shutter}</span>
                  <span className={styles.exifValue}>{exifData.exposureTime}s</span>
                </div>
              )}
              {exifData.iso && (
                <div className={`${styles.exifRow} ${styles.exifRowIso}`}>
                  <span className={styles.exifLabel}>{t.lightbox.iso}</span>
                  <span className={styles.exifValue}>{exifData.iso}</span>
                </div>
              )}
              {(exifData.city || exifData.country) && (
                <div className={styles.exifRow}>
                  <span className={styles.exifLabel}>{t.lightbox.location}</span>
                  <span className={styles.exifValue}>
                    {[exifData.city, exifData.country].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className={styles.exifRow}>
              <span className={styles.exifLabel}>{t.lightbox.noExif}</span>
            </div>
          )}
        </div>
      )}

      {/*
        The shortcuts have no control of their own and are not advertised: a
        permanent button in the corner of a photograph costs every visitor
        something, and the keys are worth nothing to the ones who would never
        press them anyway. Whoever tries `?` or `h` finds them.
      */}
      {showShortcuts && (
        <div id="lightbox-shortcuts" className={styles.shortcutsPanel}>
          <p className={styles.shortcutsTitle}>{t.lightbox.shortcuts}</p>
          <dl className={styles.shortcutsList}>
            {shortcutRows.map((row) => (
              <div key={row.label} className={styles.shortcutsRow}>
                <dt className={styles.shortcutsKeys}>
                  {row.keys.map((key) => (
                    <kbd key={key} className={styles.kbd}>
                      {key}
                    </kbd>
                  ))}
                </dt>
                <dd className={styles.shortcutsLabel}>{row.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );

  if (!mounted) return null;
  return createPortal(lightboxJsx, document.body);
}
