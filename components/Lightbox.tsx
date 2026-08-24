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
import { buildPhotoPermalink } from '@/lib/photoHash';
import { nextSlideshowSpeed, type SlideshowSpeed } from '@/lib/slideshow';
import { LIGHTBOX_SHORTCUTS, shortcutKeyLabel } from '@/lib/lightboxShortcuts';

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
  /**
   * 'manual' is the honest outcome when the clipboard is unavailable — which is
   * not a rarity here: `navigator.clipboard` is undefined outside a secure
   * context, and a self-hosted portfolio reached over plain http on a LAN is
   * exactly that. The link is then shown for the visitor to copy by hand
   * rather than the button appearing to do nothing.
   */
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  /**
   * Slideshow interval in seconds, or null for off. `s` cycles through the
   * three speeds and back to off, so the feature needs no configuration and no
   * control of its own — in keeping with how the viewer treats its other keys.
   */
  const [slideshowSeconds, setSlideshowSeconds] = useState<SlideshowSpeed>(null);
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

  /**
   * The deep link to the photo on screen.
   *
   * Built from the current index rather than read back from `location.hash`,
   * so it does not depend on the grid's hash-sync effect having run yet. The
   * `#photo-N` form is the permalink the grid already writes and restores;
   * this only supplies the affordance to copy it (#478).
   *
   * The link is positional, as `gallery.yaml.example` documents: reordering an
   * album moves where a shared link lands. That is a property of the existing
   * permalink, not of the button.
   */
  const permalink = useCallback(() => {
    if (typeof window === 'undefined') return '';
    return buildPhotoPermalink(window.location, currentIndex);
  }, [currentIndex]);

  const handleCopyLink = useCallback(() => {
    const url = permalink();
    if (!navigator.clipboard) {
      setCopyState('manual');
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => setCopyState('copied'),
      () => setCopyState('manual'),
    );
  }, [permalink]);

  /**
   * Auto-advance, so a gallery can run unattended at an exhibition, a fair
   * booth or on a second screen (#473).
   *
   * `onNext` already wraps at the end of the album, so the sequence loops on
   * its own with nothing further to arrange.
   */
  const cycleSlideshow = useCallback(() => {
    setSlideshowSeconds((current) => nextSlideshowSpeed(current));
  }, []);

  useEffect(() => {
    if (slideshowSeconds === null) return;
    const timer = setInterval(onNext, slideshowSeconds * 1000);
    return () => clearInterval(timer);
  }, [slideshowSeconds, onNext]);

  /*
   * Any deliberate move through the album stops the slideshow. Someone
   * reaching for an arrow has taken over; leaving the timer running would
   * yank the photo away from under them a second later.
   *
   * The timer above keeps calling the raw `onNext`, so it does not stop
   * itself.
   */
  const manualNext = useCallback(() => {
    setSlideshowSeconds(null);
    onNext();
  }, [onNext]);

  const manualPrev = useCallback(() => {
    setSlideshowSeconds(null);
    onPrev();
  }, [onPrev]);

  // A confirmation must not outlive the photo it was about.
  useEffect(() => {
    setCopyState('idle');
  }, [currentIndex]);

  useEffect(() => {
    if (copyState !== 'copied') return;
    const timer = setTimeout(() => setCopyState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [copyState]);

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
    onSwipeLeft: manualNext,
    onSwipeRight: manualPrev,
  });

  /*
   * Keyboard control and the scroll lock belong to the lightbox, not to whoever
   * opens it: PhotoGrid used to install the arrow keys itself, so every other
   * caller (EssayView, i.e. journal entries and photo essays) silently had no
   * keyboard navigation at all.
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      /*
       * Bare keys only. The manual copy fallback puts a real text field on
       * screen, and a visitor pressing Cmd/Ctrl+C in it means the browser's
       * copy, not this viewer's — swallowing it would break the one gesture
       * that field exists for. Esc stays available so the viewer can always
       * be left.
       */
      const target = e.target as HTMLElement | null;
      const inTextField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if (e.key !== 'Escape' && (e.metaKey || e.ctrlKey || e.altKey || inTextField)) return;

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
          manualNext();
          break;
        case 'ArrowLeft':
          manualPrev();
          break;
        case 'i':
        case 'I':
          if (showExifToggle) handleExifToggle();
          break;
        // `?` is matched on the produced character, not the physical key:
        // Shift+/ on a US layout, Shift+ß on a German one. `h` is the escape
        // hatch for layouts where `?` is awkward — and the one key someone
        // guesses without having been told.
        case 's':
        case 'S':
          e.preventDefault();
          cycleSlideshow();
          break;
        case 'd':
        case 'D':
          if (current?.downloadUrl) {
            e.preventDefault();
            window.location.href = current.downloadUrl;
          }
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          handleCopyLink();
          break;
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
    current,
    cycleSlideshow,
    handleCopyLink,
    handleExifToggle,
    onClose,
    manualNext,
    manualPrev,
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
   * The advertised shortcuts, resolved from the shared catalogue.
   *
   * The set of keys lives in lib/lightboxShortcuts.ts because the admin help
   * renders the same list; only the two labels that depend on current state
   * are decided here.
   */
  const shortcutRows = LIGHTBOX_SHORTCUTS.filter((shortcut) => {
    if (shortcut.availability === 'exifPanel') return showExifToggle;
    if (shortcut.availability === 'fullscreen') return canFullscreen;
    if (shortcut.availability === 'download') return Boolean(current?.downloadUrl);
    return true;
  }).map((shortcut) => {
    let label: string = t.lightbox[shortcut.labelKey];
    if (shortcut.labelKey === 'shortcutFullscreen' && isFullscreen) {
      label = t.lightbox.shortcutExitFullscreen;
    }
    if (shortcut.labelKey === 'shortcutSlideshow' && slideshowSeconds !== null) {
      label = t.lightbox.shortcutSlideshowRunning(slideshowSeconds);
    }
    return { keys: shortcut.keys.map(shortcutKeyLabel), label };
  });

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
        onClick={manualPrev}
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
            alt=""
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
        onClick={manualNext}
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

      {/*
        Slideshow state, announced but not drawn: a badge over a photograph
        would be paid for by every visitor, and the shortcut list already
        carries the speed for anyone who wants to see it.
      */}
      <p className="sr-only" role="status">
        {slideshowSeconds === null
          ? t.lightbox.slideshowStopped
          : t.lightbox.slideshowRunning(slideshowSeconds)}
      </p>

      {/* Copy link — bottom left, opposite the info toggle */}
      <button
        className={`${styles.infoToggle} ${styles.copyToggle}`}
        onClick={handleCopyLink}
        aria-label={t.lightbox.copyLink}
        title={t.lightbox.copyLinkTitle}
      >
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        {copyState === 'copied' ? t.lightbox.copied : t.lightbox.copyLinkShort}
      </button>

      {/* Download the original — only when the album offers it (#475) */}
      {current?.downloadUrl && (
        <a
          className={`${styles.infoToggle} ${styles.downloadToggle}`}
          href={current.downloadUrl}
          download
          aria-label={t.lightbox.download}
          title={t.lightbox.downloadTitle}
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {t.lightbox.downloadShort}
        </a>
      )}

      {/* Clipboard unavailable — show the link rather than fail quietly */}
      {copyState === 'manual' && (
        <div className={styles.copyManual} role="status">
          <label className={styles.copyManualLabel} htmlFor="lightbox-permalink">
            {t.lightbox.copyManual}
          </label>
          <input
            id="lightbox-permalink"
            className={styles.copyManualInput}
            type="text"
            readOnly
            autoFocus
            value={permalink()}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
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
