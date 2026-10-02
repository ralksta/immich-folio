'use client';

/**
 * Gesture wiring for the lightbox zoom (#467). The geometry is in lib/zoom.ts;
 * this hook measures the page, listens to the pointer, wheel and Safari
 * gesture events on the photo, and keeps the view.
 *
 * Pointer events throughout, never native drag: AssetProtection cancels
 * `dragstart` on every image when image dragging is disabled, which would
 * leave a drag-based pan dead on exactly the sites that care most about their
 * photos.
 *
 * The full-resolution file is asked for the first time the view leaves fit —
 * never before, and never for a neighbour. Until it arrives the preview is
 * shown scaled up, so a gesture answers at once; the file then takes its
 * place in the same box under the same transform, so nothing moves.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  FIT_VIEW,
  canZoom,
  clampView,
  isZoomed,
  maxZoomScale,
  panBy,
  pinchView,
  stepView,
  toggleView,
  viewTransform,
  zoomAround,
  type FitBox,
  type Point,
  type Viewport,
  type ZoomView,
} from '@/lib/zoom';

export type ZoomStatus = 'idle' | 'loading' | 'loaded' | 'failed';

interface UseZoomOptions {
  /** Identifies the photo on screen; a new one resets the zoom. */
  photoKey: string;
  /**
   * Width in pixels of the full-resolution image, upright. Undefined when the
   * photo cannot be zoomed, which switches every gesture off.
   */
  naturalWidth?: number;
  /** The photo at fit size: measured for the geometry, and where gestures land. */
  imageRef: RefObject<HTMLImageElement | null>;
  /**
   * The element that receives the gestures (the photo's container). An
   * element rather than a ref: the lightbox renders nothing until it has
   * mounted, so the listeners have to be attached when the element appears,
   * not when the hook first runs.
   */
  surface: HTMLElement | null;
}

/** Two taps closer than this in time and space are a double-tap. */
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 30;
/** A pointer that moved further than this was a drag, not a tap. */
const TAP_SLOP_PX = 10;
/** The `+` / `-` step. */
const KEY_STEP = 2;
/** Wheel delta per e-fold of zoom; see onWheel. */
const WHEEL_DIVISOR = 300;

type Gesture =
  | { kind: 'none' }
  | { kind: 'pan'; pointerId: number; start: Point; startView: ZoomView }
  | { kind: 'pinch'; startView: ZoomView; startMid: Point; startDistance: number };

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

export function useZoom({ photoKey, naturalWidth, imageRef, surface }: UseZoomOptions) {
  const enabled = !!naturalWidth && naturalWidth > 0;

  const [view, setViewState] = useState<ZoomView>(FIT_VIEW);
  const [animate, setAnimate] = useState(false);
  const [status, setStatus] = useState<ZoomStatus>('idle');

  // A new photo starts at fit, with nothing requested. Adjusted while
  // rendering rather than in an effect, so the new photo never renders once
  // with the old one's transform.
  const [shownKey, setShownKey] = useState(photoKey);
  if (shownKey !== photoKey) {
    setShownKey(photoKey);
    setViewState(FIT_VIEW);
    setAnimate(false);
    setStatus('idle');
  }

  // The handlers below are attached once per photo and read the latest values
  // from refs, so a pan does not re-subscribe on every frame.
  const viewRef = useRef<ZoomView>(FIT_VIEW);
  const naturalRef = useRef(naturalWidth ?? 0);
  const statusRef = useRef<ZoomStatus>('idle');
  useEffect(() => {
    viewRef.current = view;
    statusRef.current = status;
  });
  useEffect(() => {
    naturalRef.current = naturalWidth ?? 0;
  }, [photoKey, naturalWidth]);

  /** The fit box, the viewport and the 1:1 scale, measured now. */
  const measure = useCallback((): {
    fit: FitBox;
    viewport: Viewport;
    maxScale: number;
  } | null => {
    const img = imageRef.current;
    const parent = img?.parentElement;
    if (!img || !parent || !img.offsetWidth || !img.offsetHeight) return null;
    // Layout sizes, not getBoundingClientRect() of the image: that includes
    // the zoom transform. The container is never transformed.
    const rect = parent.getBoundingClientRect();
    const fit = {
      width: img.offsetWidth,
      height: img.offsetHeight,
      cx: rect.left + img.offsetLeft + img.offsetWidth / 2,
      cy: rect.top + img.offsetTop + img.offsetHeight / 2,
    };
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const maxScale = maxZoomScale(naturalRef.current, fit.width, window.devicePixelRatio || 1);
    return { fit, viewport, maxScale };
  }, [imageRef]);

  /** Show a view. `animated` for discrete steps; gestures follow the finger. */
  const apply = useCallback((next: ZoomView, animated: boolean) => {
    viewRef.current = next;
    setAnimate(animated && !prefersReducedMotion());
    setViewState(next);
    if (isZoomed(next) && statusRef.current === 'idle') {
      statusRef.current = 'loading';
      setStatus('loading');
    }
  }, []);

  const usable = useCallback(() => {
    if (!enabled || statusRef.current === 'failed') return null;
    const m = measure();
    return m && canZoom(m.maxScale) ? m : null;
  }, [enabled, measure]);

  /** Fit ↔ 1:1 around a point; around the photo's centre without one. */
  const toggle = useCallback(
    (point?: Point) => {
      const m = usable();
      if (!m) {
        if (isZoomed(viewRef.current)) apply(FIT_VIEW, true);
        return;
      }
      const at = point ?? { x: m.fit.cx, y: m.fit.cy };
      apply(toggleView(viewRef.current, at, m.fit, m.viewport, m.maxScale), true);
    },
    [apply, usable],
  );

  const step = useCallback(
    (factor: number) => {
      const m = usable();
      if (!m) return;
      apply(stepView(viewRef.current, factor, m.fit, m.viewport, m.maxScale), true);
    },
    [apply, usable],
  );

  const zoomIn = useCallback(() => step(KEY_STEP), [step]);
  const zoomOut = useCallback(() => step(1 / KEY_STEP), [step]);
  const reset = useCallback(() => apply(FIT_VIEW, true), [apply]);

  /** The full-resolution file arrived: correct 1:1 if the estimate was off. */
  const onFullLoad = useCallback(
    (img: HTMLImageElement) => {
      const before = measure();
      if (img.naturalWidth > 0) naturalRef.current = img.naturalWidth;
      statusRef.current = 'loaded';
      setStatus('loaded');
      const after = measure();
      if (!before || !after || before.maxScale === after.maxScale) return;
      const current = viewRef.current;
      // Someone who asked for 1:1 still gets 1:1 against the real size.
      const atMax = Math.abs(current.scale - before.maxScale) < 1e-3;
      const next = atMax
        ? zoomAround(
            current,
            after.maxScale,
            { x: after.viewport.width / 2, y: after.viewport.height / 2 },
            after.fit,
            after.viewport,
            after.maxScale,
          )
        : clampView(current, after.fit, after.viewport, after.maxScale);
      apply(next, false);
    },
    [apply, measure],
  );

  /** No full-resolution file (Immich has none, or the request failed). */
  const onFullError = useCallback(() => {
    statusRef.current = 'failed';
    setStatus('failed');
    apply(FIT_VIEW, false);
  }, [apply]);

  // A resized window changes the fit box under the view; starting over at fit
  // is simpler and less surprising than re-deriving the pan.
  useEffect(() => {
    if (!enabled) return;
    const onResize = () => {
      if (isZoomed(viewRef.current)) apply(FIT_VIEW, false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [enabled, apply]);

  // ── Gestures ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !surface) return;

    const pointers = new Map<number, Point>();
    const downs = new Map<number, { t: number; x: number; y: number; moved: boolean }>();
    let gesture: Gesture = { kind: 'none' };
    /** Two fingers were down at some point of the current touch sequence. */
    let multi = false;
    let lastTap: { t: number; x: number; y: number } | null = null;
    let lastPointerType = '';

    const midAndDistance = () => {
      const [a, b] = [...pointers.values()];
      return {
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        distance: Math.hypot(a.x - b.x, a.y - b.y),
      };
    };

    const startPan = (pointerId: number, at: Point) => {
      gesture = { kind: 'pan', pointerId, start: at, startView: viewRef.current };
    };

    const onPointerDown = (e: PointerEvent) => {
      lastPointerType = e.pointerType;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (statusRef.current === 'failed') return;
      const at = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, at);
      downs.set(e.pointerId, { t: e.timeStamp, ...at, moved: false });
      try {
        surface.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic events (tests) have no active pointer to capture.
      }

      if (pointers.size === 2) {
        multi = true;
        const { mid, distance } = midAndDistance();
        gesture = {
          kind: 'pinch',
          startView: viewRef.current,
          startMid: mid,
          startDistance: distance,
        };
      } else if (pointers.size === 1 && isZoomed(viewRef.current)) {
        startPan(e.pointerId, at);
        // No text selection or image drag behind a mouse pan.
        if (e.pointerType === 'mouse') e.preventDefault();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      const at = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, at);
      const down = downs.get(e.pointerId);
      if (down && Math.hypot(at.x - down.x, at.y - down.y) > TAP_SLOP_PX) down.moved = true;

      if (gesture.kind === 'pinch' && pointers.size >= 2) {
        const m = measure();
        if (!m || !canZoom(m.maxScale)) return;
        const { mid, distance } = midAndDistance();
        const g = gesture;
        apply(
          pinchView(
            g.startView,
            g.startMid,
            g.startDistance,
            mid,
            distance,
            m.fit,
            m.viewport,
            m.maxScale,
          ),
          false,
        );
      } else if (gesture.kind === 'pan' && gesture.pointerId === e.pointerId) {
        const m = measure();
        if (!m) return;
        const g = gesture;
        apply(
          panBy(g.startView, at.x - g.start.x, at.y - g.start.y, m.fit, m.viewport, m.maxScale),
          false,
        );
      }
    };

    const onPointerEnd = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      const down = downs.get(e.pointerId);
      pointers.delete(e.pointerId);
      downs.delete(e.pointerId);

      if (gesture.kind === 'pinch') {
        if (pointers.size === 1 && isZoomed(viewRef.current)) {
          const [[id, at]] = [...pointers.entries()];
          startPan(id, at);
        } else if (pointers.size < 2) {
          gesture = { kind: 'none' };
        }
        // A pinch let go just above fit lands on fit.
        if (pointers.size === 0 && !isZoomed(viewRef.current)) apply(FIT_VIEW, false);
      } else if (gesture.kind === 'pan' && pointers.size === 0) {
        gesture = { kind: 'none' };
      }

      const wasTap =
        e.type === 'pointerup' &&
        e.pointerType !== 'mouse' &&
        !multi &&
        down &&
        !down.moved &&
        e.timeStamp - down.t < DOUBLE_TAP_MS;
      if (pointers.size === 0) multi = false;
      if (!wasTap) return;

      // Double-tap: a second tap close to the first, soon after it.
      if (
        lastTap &&
        e.timeStamp - lastTap.t < DOUBLE_TAP_MS &&
        Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_TAP_PX
      ) {
        lastTap = null;
        toggle({ x: e.clientX, y: e.clientY });
      } else {
        lastTap = { t: e.timeStamp, x: e.clientX, y: e.clientY };
      }
    };

    // Mouse only: touch has its own double-tap above, and some browsers also
    // synthesise a dblclick from it, which would toggle straight back.
    const onDoubleClick = (e: MouseEvent) => {
      if (lastPointerType && lastPointerType !== 'mouse') return;
      e.preventDefault();
      toggle({ x: e.clientX, y: e.clientY });
    };

    // Ctrl+wheel is how Chrome, Firefox and Edge report a trackpad pinch (and
    // what a mouse user presses to zoom); a plain wheel pans once zoomed.
    const onWheel = (e: WheelEvent) => {
      if (statusRef.current === 'failed') return;
      const perLine = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      if (e.ctrlKey) {
        const m = measure();
        if (!m || !canZoom(m.maxScale)) return;
        e.preventDefault();
        // A trackpad pinch sends many small deltas, a mouse wheel one large
        // one per notch (100 or more): about 1.4× a notch, never more than
        // 2× per event, so a single notch cannot jump straight to 1:1.
        const factor = Math.min(2, Math.max(0.5, Math.exp((-e.deltaY * perLine) / WHEEL_DIVISOR)));
        const current = viewRef.current;
        const next = zoomAround(
          current,
          current.scale * factor,
          { x: e.clientX, y: e.clientY },
          m.fit,
          m.viewport,
          m.maxScale,
        );
        apply(isZoomed(next) ? next : FIT_VIEW, false);
      } else if (isZoomed(viewRef.current)) {
        const m = measure();
        if (!m) return;
        e.preventDefault();
        apply(
          panBy(
            viewRef.current,
            -e.deltaX * perLine,
            -e.deltaY * perLine,
            m.fit,
            m.viewport,
            m.maxScale,
          ),
          false,
        );
      }
    };

    // Safari reports a trackpad pinch as gesture events, not as ctrl+wheel.
    // On iOS the same events accompany a two-finger touch, which the pointer
    // handlers already follow — so they are only used with no pointer down.
    let gestureStart: ZoomView | null = null;
    type SafariGesture = Event & { scale: number; clientX: number; clientY: number };
    const onGestureStart = (e: Event) => {
      if (pointers.size > 0 || statusRef.current === 'failed') return;
      e.preventDefault();
      gestureStart = viewRef.current;
    };
    const onGestureChange = (e: Event) => {
      if (!gestureStart || pointers.size > 0) return;
      e.preventDefault();
      const g = e as SafariGesture;
      const m = measure();
      if (!m || !canZoom(m.maxScale)) return;
      const next = zoomAround(
        viewRef.current,
        gestureStart.scale * g.scale,
        { x: g.clientX, y: g.clientY },
        m.fit,
        m.viewport,
        m.maxScale,
      );
      apply(isZoomed(next) ? next : FIT_VIEW, false);
    };
    const onGestureEnd = () => {
      gestureStart = null;
    };

    surface.addEventListener('pointerdown', onPointerDown);
    surface.addEventListener('pointermove', onPointerMove);
    surface.addEventListener('pointerup', onPointerEnd);
    surface.addEventListener('pointercancel', onPointerEnd);
    surface.addEventListener('dblclick', onDoubleClick);
    surface.addEventListener('wheel', onWheel, { passive: false });
    surface.addEventListener('gesturestart', onGestureStart);
    surface.addEventListener('gesturechange', onGestureChange);
    surface.addEventListener('gestureend', onGestureEnd);
    return () => {
      surface.removeEventListener('pointerdown', onPointerDown);
      surface.removeEventListener('pointermove', onPointerMove);
      surface.removeEventListener('pointerup', onPointerEnd);
      surface.removeEventListener('pointercancel', onPointerEnd);
      surface.removeEventListener('dblclick', onDoubleClick);
      surface.removeEventListener('wheel', onWheel);
      surface.removeEventListener('gesturestart', onGestureStart);
      surface.removeEventListener('gesturechange', onGestureChange);
      surface.removeEventListener('gestureend', onGestureEnd);
    };
  }, [enabled, photoKey, surface, measure, apply, toggle]);

  const zoomed = isZoomed(view);
  /** The full-resolution image is in the page (requested, loading or shown). */
  const requested = status !== 'idle';

  return {
    /** Gestures do something for this photo. */
    enabled: enabled && status !== 'failed',
    zoomed,
    status,
    requested,
    /**
     * Inline style for both images. Absent until zoom has been used on this
     * photo, so the stylesheet's own entry animation is left alone.
     */
    imageStyle:
      zoomed || requested
        ? {
            transform: viewTransform(view),
            transition: animate ? 'transform 220ms cubic-bezier(0.2, 0.7, 0.3, 1)' : 'none',
          }
        : undefined,
    toggle,
    zoomIn,
    zoomOut,
    reset,
    onFullLoad,
    onFullError,
  };
}
