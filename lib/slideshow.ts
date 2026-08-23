/**
 * Slideshow speeds for the lightbox (#473).
 *
 * Three speeds and off, cycled by one key, so a gallery can be left running at
 * an exhibition, a fair booth or on a second screen without the viewer growing
 * a control of its own.
 */

/** Seconds between advances, slowest last. `null` is off. */
export const SLIDESHOW_SPEEDS = [null, 3, 5, 10] as const;

export type SlideshowSpeed = (typeof SLIDESHOW_SPEEDS)[number];

/**
 * The next speed in the cycle: off → 3s → 5s → 10s → off.
 *
 * An unrecognised value returns the first speed, so the cycle can always be
 * re-entered rather than sticking.
 */
export function nextSlideshowSpeed(current: SlideshowSpeed): SlideshowSpeed {
  const position = SLIDESHOW_SPEEDS.indexOf(current);
  if (position === -1) return SLIDESHOW_SPEEDS[1];
  return SLIDESHOW_SPEEDS[(position + 1) % SLIDESHOW_SPEEDS.length];
}
