/**
 * Lightbox — fullscreen image viewer with navigation and EXIF info.
 *
 * Features:
 * - The 1440px preview, and — where zoom is on — the full-resolution file,
 *   fetched only when the visitor zooms (#467; gestures in hooks/useZoom.ts)
 * - Previous/Next navigation (arrows + swipe)
 * - Close (Esc, click outside, X button)
 * - EXIF metadata panel (fetched on demand)
 * - Keyboard shortcut list (`?` or `h`), deliberately unadvertised
 * - Real fullscreen (`f`), where the browser offers it
 * - Preloads adjacent previews (never the full-resolution files)
 */

'use client';

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { PhotoItem } from '@/app/[...path]/PhotoGrid';
import { useExif } from '@/hooks/useExif';
import { useSwipe } from '@/hooks/useSwipe';
import { useZoom } from '@/hooks/useZoom';
import { zoomFitsDevice } from '@/lib/zoom';
import styles from './Lightbox.module.css';
import { useProofing } from './useProofing';
import { IconHeart } from './Icons';
import { useDictionary } from './I18nProvider';
// From lib/config/schema directly: lib/config/index.ts pulls in `fs`, which a
// client component cannot import.
import { resolveWatermarkOpacity } from '@/lib/config/schema';
import { APERTURE_SIGN, formatCamera, formatLens } from '@/lib/exif';
import { buildPhotoPermalink } from '@/lib/photoHash';
import { trapTabKey } from '@/lib/focusTrap';
import { canonicalImageUrl } from '@/lib/imageSize';
import { nextSlideshowSpeed, type SlideshowSpeed } from '@/lib/slideshow';
import {
  LIGHTBOX_SHORTCUTS,
  lightboxActionFor,
  shortcutDisplayKeys,
} from '@/lib/lightboxShortcuts';

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

const COARSE_POINTER = '(pointer: coarse)';

function subscribeCoarsePointer(onChange: () => void): () => void {
  const query = window.matchMedia?.(COARSE_POINTER);
  query?.addEventListener?.('change', onChange);
  return () => query?.removeEventListener?.('change', onChange);
}

/** A touch device, where very large images are not offered for zoom. */
function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribeCoarsePointer,
    () => !!window.matchMedia?.(COARSE_POINTER)?.matches,
    () => false,
  );
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
  // State, not a ref: useZoom attaches its listeners when this element
  // appears, which is after the portal mounts.
  const [imageContainer, setImageContainer] = useState<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLImageElement>(null);

  const current = assets[currentIndex];
  const coarsePointer = useCoarsePointer();
  const zoomable =
    current.type === 'image' &&
    !!current.zoomUrl &&
    zoomFitsDevice(current.zoomWidth, current.zoomHeight, coarsePointer);
  const zoom = useZoom({
    photoKey: current.id,
    naturalWidth: zoomable ? current.zoomWidth : undefined,
    imageRef: previewRef,
    surface: imageContainer,
  });
  const { zoomed, reset: resetZoom, zoomIn, zoomOut } = zoom;
  /** The zoom control and keys are offered for this photo. */
  const canZoom = zoomable && zoom.enabled;
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

  /*
   * Focus stays inside the dialog while it is open, and goes back to the grid
   * when it closes (#696) — to the tile of the photo that was on screen last,
   * not necessarily the one that opened the viewer, so a keyboard visitor who
   * browsed ahead continues from where they are. Tiles mark themselves with
   * `data-lightbox-index` inside a `data-lightbox-group`; without them the
   * opener gets focus back.
   */
  const indexRef = useRef(currentIndex);
  useEffect(() => {
    indexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onTab = (e: KeyboardEvent) => {
      if (overlayRef.current) trapTabKey(overlayRef.current, e);
    };
    document.addEventListener('keydown', onTab);
    return () => {
      document.removeEventListener('keydown', onTab);
      const group = opener?.closest('[data-lightbox-group]');
      const tile = group?.querySelector<HTMLElement>(`[data-lightbox-index="${indexRef.current}"]`);
      const target = tile ?? opener;
      if (target?.isConnected) target.focus();
    };
  }, []);

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
   * Built from `current.id` — the asset's own stable token, the same one the
   * grid already carries on every `PhotoItem` — rather than read back from
   * `location.search`, so it does not depend on the grid's query-sync effect
   * having run yet. This only supplies the affordance to copy it (#478); the
   * `?photo=<assetId>` form itself is what the grid writes and restores.
   *
   * Addressed by the photo, not a position: reordering the album, or
   * deleting a different photo, no longer repoints an already-shared link
   * (#588).
   */
  const permalink = useCallback(() => {
    if (typeof window === 'undefined' || !current) return '';
    return buildPhotoPermalink(window.location, current.id);
  }, [current]);

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

  // Paused, not stopped, while zoomed: advancing would throw away the view
  // someone is inspecting. Back at fit, the slideshow carries on.
  useEffect(() => {
    if (slideshowSeconds === null || zoom.zoomed) return;
    const timer = setInterval(onNext, slideshowSeconds * 1000);
    return () => clearInterval(timer);
  }, [slideshowSeconds, onNext, zoom.zoomed]);

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
        img.src = canonicalImageUrl(assets[index].previewUrl);
      }
    };
    preload(currentIndex + 1);
    preload(currentIndex - 1);
  }, [currentIndex, assets]);

  // While zoomed one finger pans the photo, so it must not also navigate.
  const { handleTouchStart, handleTouchEnd } = useSwipe({
    onSwipeLeft: manualNext,
    onSwipeRight: manualPrev,
    enabled: !zoom.zoomed,
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

      /*
       * Which keys exist is the catalogue's business, not this handler's — see
       * lib/lightboxShortcuts.ts. A key it does not list never gets here, and
       * the switch below is exhaustive over LightboxAction, so an action added
       * there without a branch here fails to compile rather than silently
       * doing nothing.
       */
      const action = lightboxActionFor(e.key);
      if (action === null) return;

      switch (action) {
        case 'close':
          // Innermost layer first: Esc dismisses the shortcut list, then leaves
          // the zoom, then fullscreen, and only closes the viewer once nothing
          // is stacked on top of it. Most browsers swallow this Esc to exit
          // fullscreen themselves and never dispatch it — that branch is for
          // the ones that do dispatch it, which would otherwise close the
          // lightbox and leave the page behind it fullscreen.
          if (showShortcuts) setShowShortcuts(false);
          else if (zoomed) resetZoom();
          else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
          else onClose();
          break;
        case 'next':
          manualNext();
          break;
        case 'prev':
          manualPrev();
          break;
        case 'info':
          if (showExifToggle) handleExifToggle();
          break;
        case 'slideshow':
          e.preventDefault();
          cycleSlideshow();
          break;
        case 'download':
          if (current?.downloadUrl) {
            e.preventDefault();
            window.location.href = current.downloadUrl;
          }
          break;
        case 'copyLink':
          e.preventDefault();
          handleCopyLink();
          break;
        case 'zoomIn':
          if (canZoom) zoomIn();
          break;
        case 'zoomOut':
          if (canZoom) zoomOut();
          break;
        case 'zoomReset':
          if (zoomed) resetZoom();
          break;
        case 'shortcutList':
          toggleShortcuts();
          break;
        case 'fullscreen':
          if (canFullscreen) toggleFullscreen();
          break;
        default: {
          // Exhaustiveness guard: this only type-checks while every
          // LightboxAction has a branch above.
          const unhandled: never = action;
          void unhandled;
        }
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
    canZoom,
    zoomed,
    resetZoom,
    zoomIn,
    zoomOut,
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
    if (shortcut.availability === 'zoom') return canZoom;
    return true;
  }).map((shortcut) => {
    let label: string = t.lightbox[shortcut.labelKey];
    if (shortcut.labelKey === 'shortcutFullscreen' && isFullscreen) {
      label = t.lightbox.shortcutExitFullscreen;
    }
    if (shortcut.labelKey === 'shortcutSlideshow' && slideshowSeconds !== null) {
      label = t.lightbox.shortcutSlideshowRunning(slideshowSeconds);
    }
    return { keys: shortcutDisplayKeys(shortcut), label };
  });

  const lightboxJsx = (
    <div
      className={`${styles.overlay}${zoom.requested ? ` ${styles.overlayZoom}` : ''}`}
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
        ref={setImageContainer}
        className={[
          styles.imageContainer,
          canZoom ? styles.zoomable : '',
          zoom.zoomed ? styles.zoomed : '',
          zoom.requested ? styles.zoomEngaged : '',
        ]
          .filter(Boolean)
          .join(' ')}
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
            ref={previewRef}
            className={`${styles.image}${imageLoaded ? ` ${styles.imageLoaded}` : ''}`}
            src={canonicalImageUrl(current.previewUrl)}
            alt={current.caption ?? ''}
            draggable={false}
            style={zoom.imageStyle}
            onLoad={() => setImageLoaded(true)}
            onError={() => console.error(`[Lightbox] Failed to load image: ${current.previewUrl}`)}
          />
        )}

        {/*
          The full-resolution file, mounted on the first zoom and not before.
          It covers the preview's own box under the same transform, so when it
          arrives it replaces the scaled-up preview without moving. Keyed by
          the photo, so a new photo never shows the last one's file.
        */}
        {current.type === 'image' &&
          current.zoomUrl &&
          zoom.requested &&
          zoom.status !== 'failed' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={current.id}
              className={`${styles.zoomImage}${zoom.status === 'loaded' ? ` ${styles.zoomImageLoaded}` : ''}`}
              src={current.zoomUrl}
              alt=""
              aria-hidden="true"
              draggable={false}
              style={zoom.imageStyle}
              onLoad={(e) => zoom.onFullLoad(e.currentTarget)}
              onError={zoom.onFullError}
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

      {/* Zoom loading, for screen readers; sighted visitors see the spinner
          in the zoom button. */}
      <p className="sr-only" role="status">
        {zoom.zoomed && zoom.status === 'loading' ? t.lightbox.zoomLoading : ''}
      </p>

      {/* No full-resolution file: say so once, and stay on the preview. */}
      {zoom.status === 'failed' && (
        <div key={current.id} className={styles.zoomNotice} role="status">
          {t.lightbox.zoomUnavailable}
        </div>
      )}

      {/*
        One bottom bar rather than five separately anchored controls.
        They used to carry hard-coded offsets, which broke in two ways: the
        info button grows when its label becomes "Hide info" and walked into
        the favourite button, and the left-hand controls ran into the centred
        counter on a narrow viewport. A flex row cannot collide with itself.

        The bar itself ignores pointer events so it does not swallow clicks
        on the photograph behind it; each group takes them back.
      */}
      <div className={styles.bottomBar}>
        <div className={`${styles.bottomBarGroup} ${styles.bottomBarLeft}`}>
          {/* Copy link — bottom left, opposite the info toggle */}
          <button
            className={styles.infoToggle}
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
        </div>

        {/* Counter */}
        <div className={styles.counter} aria-live="polite" aria-atomic="true">
          <span className="sr-only">{t.lightbox.position(currentIndex + 1, assets.length)}</span>
          <span aria-hidden="true">
            {currentIndex + 1} / {assets.length}
          </span>
        </div>

        <div className={`${styles.bottomBarGroup} ${styles.bottomBarRight}`}>
          {/* Zoom to 1:1 and back (#467). Icon only: the bar is already full at
              phone width, and the magnifier says what it does. */}
          {canZoom && (
            <button
              className={`${styles.infoToggle} ${styles.zoomToggle}`}
              onClick={() => zoom.toggle()}
              aria-pressed={zoom.zoomed}
              aria-busy={zoom.zoomed && zoom.status === 'loading'}
              aria-label={zoom.zoomed ? t.lightbox.zoomOut : t.lightbox.zoomIn}
              title={zoom.zoomed ? t.lightbox.zoomOutTitle : t.lightbox.zoomInTitle}
            >
              {zoom.zoomed && zoom.status === 'loading' ? (
                <span className={styles.zoomSpinner} aria-hidden="true" />
              ) : (
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
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16" y2="16" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                  {!zoom.zoomed && <line x1="11" y1="8" x2="11" y2="14" />}
                </svg>
              )}
            </button>
          )}

          {/* Proofing favorite button */}
          {proofing && current && (
            <button
              className={`${styles.infoToggle}${isFav ? ` ${styles.favActive}` : ''}`}
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
        </div>
      </div>

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
              {formatLens(exifData.lensModel, exifData.model) && (
                <div className={styles.exifRow}>
                  <span className={styles.exifLabel}>{t.lightbox.lens}</span>
                  <span className={styles.exifValue}>
                    {formatLens(exifData.lensModel, exifData.model)}
                  </span>
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
                  <span className={styles.exifValue}>
                    <span className="exif-fsign">{APERTURE_SIGN}</span>/{exifData.fNumber}
                  </span>
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
