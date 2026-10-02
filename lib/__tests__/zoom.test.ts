import { describe, it, expect } from 'vitest';
import {
  CLICK_ZOOM_SCALE,
  FIT_VIEW,
  canZoom,
  clampView,
  isZoomed,
  maxZoomScale,
  oneToOneScale,
  onFitBox,
  panBy,
  pinchView,
  stepView,
  toggleView,
  TOUCH_ZOOM_MAX_PIXELS,
  zoomFitsDevice,
  zoomAround,
  type FitBox,
  type ZoomView,
} from '../zoom';

/**
 * The lightbox zoom geometry (#467). A 1000×600 fit box centred in a
 * 1200×800 viewport, showing a 6000×3600 photo: 1:1 is six times the fit size
 * on a 1× screen, three times on a 2× one.
 */
const viewport = { width: 1200, height: 800 };
const fit: FitBox = { cx: 600, cy: 400, width: 1000, height: 600 };
const NATURAL = 6000;

/** Where a photo point (offset from the box centre at fit) lands on screen. */
const screenOf = (view: ZoomView, u: number, v: number) => ({
  x: fit.cx + view.x + u * view.scale,
  y: fit.cy + view.y + v * view.scale,
});

describe('1:1 scale', () => {
  it('is one image pixel per device pixel', () => {
    expect(oneToOneScale(NATURAL, 1000, 1)).toBe(6);
    expect(oneToOneScale(NATURAL, 1000, 2)).toBe(3);
    expect(oneToOneScale(NATURAL, 1000, 3)).toBe(2);
  });

  it('accounts for a fractional ratio', () => {
    expect(oneToOneScale(NATURAL, 1000, 1.5)).toBeCloseTo(4);
  });

  it('treats a missing or nonsense ratio as 1', () => {
    expect(oneToOneScale(NATURAL, 1000, 0)).toBe(6);
    expect(oneToOneScale(NATURAL, 1000, NaN)).toBe(6);
  });

  it('never goes below fit', () => {
    // A 1500px photo on a 3× screen is already shown beyond 1:1 at fit.
    expect(oneToOneScale(1500, 1000, 3)).toBe(0.5);
    expect(maxZoomScale(1500, 1000, 3)).toBe(1);
    expect(canZoom(maxZoomScale(1500, 1000, 3))).toBe(false);
    expect(canZoom(maxZoomScale(NATURAL, 1000, 2))).toBe(true);
  });

  it('is 1 when a size is unknown', () => {
    expect(oneToOneScale(0, 1000, 1)).toBe(1);
    expect(oneToOneScale(NATURAL, 0, 1)).toBe(1);
  });
});

describe('clamping', () => {
  const max = 6;

  it('keeps the scale between fit and 1:1', () => {
    expect(clampView({ scale: 10, x: 0, y: 0 }, fit, viewport, max).scale).toBe(6);
    expect(clampView({ scale: 0.5, x: 30, y: 30 }, fit, viewport, max)).toEqual(FIT_VIEW);
  });

  it('never shows an empty band beside a photo larger than the viewport', () => {
    // At 6× the box is 6000×3600: its left edge may go no further right than
    // the viewport's left edge, and so on.
    const v = clampView({ scale: 6, x: 99999, y: -99999 }, fit, viewport, max);
    expect(fit.cx + v.x - (fit.width * 6) / 2).toBeCloseTo(0);
    expect(fit.cy + v.y + (fit.height * 6) / 2).toBeCloseTo(viewport.height);
  });

  it('keeps a photo smaller than the viewport on screen, where it was', () => {
    // 1.1× is 1100 wide in a 1200 viewport: it may move 50px either way.
    const centred = clampView({ scale: 1.1, x: 0, y: 0 }, fit, viewport, max);
    expect(centred.x).toBe(0);
    const pushed = clampView({ scale: 1.1, x: 500, y: 0 }, fit, viewport, max);
    expect(pushed.x).toBeCloseTo(50);
  });

  it('pans by a delta, within the same bounds', () => {
    const start = { scale: 3, x: 0, y: 0 };
    expect(panBy(start, 100, -50, fit, viewport, max)).toEqual({ scale: 3, x: 100, y: -50 });
    // 3000 wide in 1200: at most 900 either side of centre.
    expect(panBy(start, 5000, 0, fit, viewport, max).x).toBeCloseTo(900);
  });
});

describe('zooming around a point', () => {
  const max = 6;

  it('keeps the photo point under the cursor where it was', () => {
    const point = { x: 700, y: 450 };
    // Photo point under the cursor at fit:
    const u = point.x - fit.cx;
    const v = point.y - fit.cy;
    const next = zoomAround(FIT_VIEW, 3, point, fit, viewport, max);
    expect(next.scale).toBe(3);
    const after = screenOf(next, u, v);
    expect(after.x).toBeCloseTo(point.x);
    expect(after.y).toBeCloseTo(point.y);
  });

  it('keeps it fixed from an already zoomed, panned view too', () => {
    const start = { scale: 2, x: -150, y: 80 };
    const point = { x: 400, y: 300 };
    const u = (point.x - fit.cx - start.x) / start.scale;
    const v = (point.y - fit.cy - start.y) / start.scale;
    const next = zoomAround(start, 4, point, fit, viewport, max);
    const after = screenOf(next, u, v);
    expect(after.x).toBeCloseTo(point.x);
    expect(after.y).toBeCloseTo(point.y);
  });

  it('gives way to the clamp at the photo edge', () => {
    // A point at the very corner cannot stay put without exposing the
    // background, so the photo edge wins.
    const next = zoomAround(FIT_VIEW, 6, { x: 100, y: 100 }, fit, viewport, max);
    expect(fit.cx + next.x - (fit.width * 6) / 2).toBeCloseTo(0);
  });

  it('toggles to a given scale at the point, clamped to 1:1', () => {
    const point = { x: 650, y: 420 };
    const closer = toggleView(FIT_VIEW, point, fit, viewport, max, CLICK_ZOOM_SCALE);
    expect(closer.scale).toBe(1.5);
    const after = screenOf(closer, point.x - fit.cx, point.y - fit.cy);
    expect(after.x).toBeCloseTo(point.x);
    expect(after.y).toBeCloseTo(point.y);
    expect(toggleView(closer, point, fit, viewport, max, CLICK_ZOOM_SCALE)).toEqual(FIT_VIEW);
    // A photo with less to give than the click asks for stops at 1:1.
    expect(toggleView(FIT_VIEW, point, fit, viewport, 1.2, CLICK_ZOOM_SCALE).scale).toBe(1.2);
  });

  it('knows the photo from the band beside it', () => {
    expect(onFitBox({ x: fit.cx, y: fit.cy }, fit)).toBe(true);
    expect(onFitBox({ x: fit.cx + fit.width / 2, y: fit.cy }, fit)).toBe(true);
    expect(onFitBox({ x: fit.cx + fit.width / 2 + 1, y: fit.cy }, fit)).toBe(false);
    expect(onFitBox({ x: fit.cx, y: fit.cy - fit.height / 2 - 1 }, fit)).toBe(false);
  });

  it('double-tap and the button go to 1:1 at the point, and back to fit', () => {
    const point = { x: 650, y: 420 };
    const zoomed = toggleView(FIT_VIEW, point, fit, viewport, max);
    expect(zoomed.scale).toBe(max);
    expect(isZoomed(zoomed)).toBe(true);
    const after = screenOf(zoomed, point.x - fit.cx, point.y - fit.cy);
    expect(after.x).toBeCloseTo(point.x);
    expect(toggleView(zoomed, point, fit, viewport, max)).toEqual(FIT_VIEW);
  });

  it('steps by a factor around the viewport centre, and snaps back to fit', () => {
    const once = stepView(FIT_VIEW, 2, fit, viewport, max);
    expect(once.scale).toBe(2);
    expect(stepView(stepView(once, 2, fit, viewport, max), 2, fit, viewport, max).scale).toBe(6);
    expect(stepView(once, 0.5, fit, viewport, max)).toEqual(FIT_VIEW);
    expect(stepView(once, 0.51, fit, viewport, max)).toEqual(FIT_VIEW);
  });
});

describe('pinch', () => {
  const max = 6;

  it('scales by how far the fingers spread, around their midpoint', () => {
    const mid = { x: 640, y: 380 };
    const next = pinchView(FIT_VIEW, mid, 100, mid, 250, fit, viewport, max);
    expect(next.scale).toBeCloseTo(2.5);
    const after = screenOf(next, mid.x - fit.cx, mid.y - fit.cy);
    expect(after.x).toBeCloseTo(mid.x);
    expect(after.y).toBeCloseTo(mid.y);
  });

  it('follows the midpoint as the fingers move', () => {
    const startMid = { x: 600, y: 400 };
    const mid = { x: 660, y: 430 };
    const next = pinchView({ scale: 3, x: 0, y: 0 }, startMid, 100, mid, 100, fit, viewport, max);
    expect(next).toEqual({ scale: 3, x: 60, y: 30 });
  });

  it('pinching back past fit lands on fit', () => {
    const mid = { x: 600, y: 400 };
    expect(pinchView({ scale: 2, x: 40, y: 0 }, mid, 200, mid, 50, fit, viewport, max)).toEqual(
      FIT_VIEW,
    );
  });

  it('cannot pinch beyond 1:1', () => {
    const mid = { x: 600, y: 400 };
    expect(pinchView(FIT_VIEW, mid, 10, mid, 1000, fit, viewport, max).scale).toBe(max);
  });
});

describe('zoomFitsDevice (review of #830)', () => {
  it('limits touch devices to 50 MP', () => {
    expect(TOUCH_ZOOM_MAX_PIXELS).toBe(50_000_000);
    // Leica Q3, 60 MP: not on a phone, fine with a mouse.
    expect(zoomFitsDevice(9520, 6336, true)).toBe(false);
    expect(zoomFitsDevice(9520, 6336, false)).toBe(true);
    // iPhone, 12 MP; and exactly at the limit.
    expect(zoomFitsDevice(4032, 3024, true)).toBe(true);
    expect(zoomFitsDevice(10000, 5000, true)).toBe(true);
  });

  it('needs a size', () => {
    expect(zoomFitsDevice(undefined, 100, false)).toBe(false);
  });
});

describe('isZoomed', () => {
  it('counts a hair above fit as fit', () => {
    expect(isZoomed(FIT_VIEW)).toBe(false);
    expect(isZoomed({ scale: 1.01, x: 0, y: 0 })).toBe(false);
    expect(isZoomed({ scale: 1.5, x: 0, y: 0 })).toBe(true);
  });
});
