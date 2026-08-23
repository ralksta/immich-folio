/**
 * Photo of the Day — pick one hero image per calendar day (#476).
 *
 * `gallery.yaml: hero` already holds a list, which the homepage crossfades
 * through on a six-second timer. That serves a visitor who is looking right
 * now; it does nothing for one who comes back next week. Choosing a single
 * image per day gives a returning visitor something new without the
 * photographer touching the config.
 *
 * The choice is a cycle through the list by day number rather than a hash of
 * the date. A hash would look more arbitrary, but it can land on the same
 * image two days running — which is precisely the thing this is meant to
 * avoid — and it leaves some images rare. Walking the list guarantees the
 * photo changes every day and that every hero image gets its turn.
 *
 * Which day it is follows the server's own clock, since the page is rendered
 * there. In Docker that is the container's `TZ`.
 */

/**
 * Today as `YYYY-MM-DD` in the runtime's local zone.
 *
 * Built from the local calendar fields rather than `toISOString()`, which
 * would answer in UTC and roll the day over at the wrong moment for anyone
 * not on it.
 */
export function localDateKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * A `YYYY-MM-DD` key as a count of days from the epoch.
 *
 * Parsed as UTC midnight on purpose: the key already names a local calendar
 * day, so re-applying a zone here would shift it. Returns null for anything
 * that is not a well-formed date, so a caller can fall back rather than
 * compute an index from NaN.
 */
export function dayNumber(dateKey: string): number | null {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(timestamp)) return null;
  // Date.UTC rolls impossible dates over (month 13 → next January), so reject
  // anything that did not survive the round trip.
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(month) - 1 ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return Math.floor(timestamp / 86_400_000);
}

/**
 * The index of the hero image to show on `dateKey`.
 *
 * Returns 0 for an empty or unparseable input — the caller then shows the
 * first hero image, which is what it would have shown anyway.
 */
export function photoOfTheDayIndex(count: number, dateKey: string): number {
  if (count <= 1) return 0;
  const day = dayNumber(dateKey);
  if (day === null) return 0;
  // Days before the epoch are negative; JS `%` keeps the sign.
  return ((day % count) + count) % count;
}

/**
 * The hero image for `dateKey`, or undefined when there are none.
 */
export function photoOfTheDay<T>(images: readonly T[], dateKey: string): T | undefined {
  if (images.length === 0) return undefined;
  return images[photoOfTheDayIndex(images.length, dateKey)];
}
