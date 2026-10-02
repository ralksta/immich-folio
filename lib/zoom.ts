/**
 * Zoom geometry for the lightbox (#467). Pure, so it can be tested without a
 * DOM; the gesture wiring lives in hooks/useZoom.ts.
 *
 * The model: the photo is laid out at its "fit" size, as the lightbox always
 * shows it, and zooming applies `translate(x, y) scale(scale)` to that box
 * with the transform origin at its centre. `scale: 1` is fit. Every
 * coordinate is in CSS pixels relative to the viewport.
 *
 * The top of the range is 1:1 — one image pixel per *device* pixel, so the
 * CSS size at 1:1 is the image width divided by devicePixelRatio. That is the
 * view a sharpness check needs. Going further only interpolates pixels: it
 * shows nothing the file does not hold and makes good focus look soft, so the
 * range is clamped to [fit, 1:1] rather than [fit, 2 × 1:1].
 */

/** The current transform of the fit box. */
export interface ZoomView {
  scale: number;
  /** Translation of the box centre, CSS px. */
  x: number;
  y: number;
}

/** Where the photo sits at fit: the centre of its box and its size, CSS px. */
export interface FitBox {
  cx: number;
  cy: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * The largest image offered for zoom on a touch device (coarse pointer), in
 * pixels. Showing a photo at 1:1 means decoding all of it: 50 MP is 200 MB of
 * RGBA, about what phones and tablets cope with alongside the page. Larger
 * files (a 60 MP Leica Q3 frame, 240 MB decoded) get no zoom control there,
 * rather than one that crashes the tab. Mouse and trackpad devices are not
 * limited.
 */
export const TOUCH_ZOOM_MAX_PIXELS = 50_000_000;

/** Whether a photo of this pixel size may be zoomed on this kind of device. */
export function zoomFitsDevice(
  width: number | undefined,
  height: number | undefined,
  coarsePointer: boolean,
): boolean {
  if (!width || !height) return false;
  return !coarsePointer || width * height <= TOUCH_ZOOM_MAX_PIXELS;
}

/** The untouched view. */
export const FIT_VIEW: ZoomView = Object.freeze({ scale: 1, x: 0, y: 0 });

/**
 * Below this the view counts as fit. Pinching back almost to fit should land
 * on fit, not leave the photo a pixel off and swipe navigation switched off.
 */
const FIT_EPSILON = 0.02;

export function isZoomed(view: ZoomView): boolean {
  return view.scale > 1 + FIT_EPSILON;
}

/**
 * The scale (relative to fit) at which one image pixel covers one device
 * pixel. Below 1 when the photo is already shown at more than 1:1 — a small
 * file on a large screen — which leaves nothing to zoom into.
 */
export function oneToOneScale(naturalWidth: number, fitWidth: number, dpr: number): number {
  if (!(naturalWidth > 0) || !(fitWidth > 0)) return 1;
  const ratio = dpr > 0 && Number.isFinite(dpr) ? dpr : 1;
  return naturalWidth / ratio / fitWidth;
}

/** The top of the zoom range: 1:1, and never below fit. */
export function maxZoomScale(naturalWidth: number, fitWidth: number, dpr: number): number {
  return Math.max(1, oneToOneScale(naturalWidth, fitWidth, dpr));
}

/** Whether zooming would show anything the fit view does not. */
export function canZoom(maxScale: number): boolean {
  return maxScale > 1 + FIT_EPSILON;
}

export function clampScale(scale: number, maxScale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(Math.max(scale, 1), Math.max(1, maxScale));
}

/**
 * The allowed range for one axis of the translation.
 *
 * A box larger than the viewport may move until its edge meets the viewport
 * edge, never further — no empty band appears beside the photo. A box smaller
 * than the viewport may move anywhere that keeps it fully on screen; that
 * range always contains 0, so a photo that is barely zoomed stays where it was
 * instead of jumping to the centre.
 */
function axisRange(centre: number, half: number, extent: number): [number, number] {
  const a = half - centre;
  const b = extent - centre - half;
  return [Math.min(a, b), Math.max(a, b)];
}

/** Keep the photo covering the viewport (or fully on it), at a clamped scale. */
export function clampView(
  view: ZoomView,
  fit: FitBox,
  viewport: Viewport,
  maxScale: number,
): ZoomView {
  const scale = clampScale(view.scale, maxScale);
  if (scale <= 1) return { ...FIT_VIEW };
  const [minX, maxX] = axisRange(fit.cx, (fit.width * scale) / 2, viewport.width);
  const [minY, maxY] = axisRange(fit.cy, (fit.height * scale) / 2, viewport.height);
  return {
    scale,
    x: Math.min(Math.max(view.x, minX), maxX),
    y: Math.min(Math.max(view.y, minY), maxY),
  };
}

/**
 * Change the scale while the photo point under `point` stays under it — the
 * cursor for a wheel or a double-click, the midpoint of two fingers for a
 * pinch. Clamping can still move it at the edges, which is the price of never
 * showing an empty band.
 */
export function zoomAround(
  view: ZoomView,
  nextScale: number,
  point: Point,
  fit: FitBox,
  viewport: Viewport,
  maxScale: number,
): ZoomView {
  const scale = clampScale(nextScale, maxScale);
  // The photo point under `point`, as an offset from the box centre at scale 1.
  const u = (point.x - fit.cx - view.x) / view.scale;
  const v = (point.y - fit.cy - view.y) / view.scale;
  return clampView(
    { scale, x: point.x - fit.cx - u * scale, y: point.y - fit.cy - v * scale },
    fit,
    viewport,
    maxScale,
  );
}

/**
 * The pinch step: the photo point that was under the fingers' midpoint when
 * the pinch began follows the midpoint, at the start scale times how far the
 * fingers spread. Computed from the start of the gesture rather than
 * incrementally, so rounding cannot drift the photo away under the fingers.
 */
export function pinchView(
  start: ZoomView,
  startMid: Point,
  startDistance: number,
  mid: Point,
  distance: number,
  fit: FitBox,
  viewport: Viewport,
  maxScale: number,
): ZoomView {
  const factor = startDistance > 0 ? distance / startDistance : 1;
  const scale = clampScale(start.scale * factor, maxScale);
  const u = (startMid.x - fit.cx - start.x) / start.scale;
  const v = (startMid.y - fit.cy - start.y) / start.scale;
  return clampView(
    { scale, x: mid.x - fit.cx - u * scale, y: mid.y - fit.cy - v * scale },
    fit,
    viewport,
    maxScale,
  );
}

/** Move the photo by a pointer delta, clamped. */
export function panBy(
  view: ZoomView,
  dx: number,
  dy: number,
  fit: FitBox,
  viewport: Viewport,
  maxScale: number,
): ZoomView {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy }, fit, viewport, maxScale);
}

/** Double-click / double-tap: fit ↔ 1:1, around the point. */
export function toggleView(
  view: ZoomView,
  point: Point,
  fit: FitBox,
  viewport: Viewport,
  maxScale: number,
): ZoomView {
  if (isZoomed(view)) return { ...FIT_VIEW };
  return zoomAround(view, maxScale, point, fit, viewport, maxScale);
}

/**
 * The `+` / `-` keys and the wheel: multiply the scale, around the centre of
 * the viewport unless a point is given. A step that lands within reach of fit
 * snaps to it.
 */
export function stepView(
  view: ZoomView,
  factor: number,
  fit: FitBox,
  viewport: Viewport,
  maxScale: number,
  point?: Point,
): ZoomView {
  const at = point ?? { x: viewport.width / 2, y: viewport.height / 2 };
  const next = zoomAround(view, view.scale * factor, at, fit, viewport, maxScale);
  return isZoomed(next) ? next : { ...FIT_VIEW };
}

/** The CSS transform for a view. */
export function viewTransform(view: ZoomView): string {
  return `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`;
}
