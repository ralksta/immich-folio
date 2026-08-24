/**
 * How precisely an album's photographs may be placed on the map (#469).
 *
 * The map is the only public GPS surface: the EXIF route does not expose
 * coordinates at all, and password-protected albums are dropped before
 * aggregation. What was left was public albums, whose marker sits at the mean
 * of the actual coordinates — and for an album shot in one place (a garden, a
 * studio, a client's home, a fragile site) that mean *is* that place. The
 * marker is named after the city and stands on the property. Nobody chose
 * that; it follows from the camera writing GPS.
 *
 * Coordinates are quantised rather than snapped to city centres, so the
 * project takes on no geodata dependency.
 */

export const LOCATION_PRECISIONS = ['exact', 'city', 'country', 'hidden'] as const;

export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number];

export function isLocationPrecision(value: string): value is LocationPrecision {
  return (LOCATION_PRECISIONS as readonly string[]).includes(value);
}

/**
 * Grid each level snaps to. `decimals` trims the floating-point tail that
 * dividing and re-multiplying leaves behind — without it 0.05° rounding emits
 * values like 52.900000000000006, which would be a needlessly precise-looking
 * number for a deliberately imprecise position.
 */
const GRID: Record<Exclude<LocationPrecision, 'hidden'>, { step: number; decimals: number }> = {
  exact: { step: 0, decimals: 6 },
  city: { step: 0.05, decimals: 2 }, // ≈ 5 km
  country: { step: 1, decimals: 0 }, // ≈ 100 km
};

/** Strictness order — later wins when albums disagree. */
const RANK: Record<LocationPrecision, number> = {
  exact: 0,
  city: 1,
  country: 2,
  hidden: 3,
};

/**
 * The strictest level among the albums contributing to one marker.
 *
 * One marker merges several albums, so the cautious setting has to govern the
 * whole marker. Splitting the marker instead would itself reveal that one of
 * its albums is set more cautiously — which is the thing being hidden.
 *
 * An empty list is `hidden`: nothing contributed, so there is nothing to show.
 */
export function strictestPrecision(levels: readonly LocationPrecision[]): LocationPrecision {
  if (levels.length === 0) return 'hidden';
  return levels.reduce((worst, level) => (RANK[level] > RANK[worst] ? level : worst), 'exact');
}

/**
 * Snap a coordinate to the level's grid.
 *
 * A fixed global grid, not a random offset per request: jitter could be
 * averaged away by asking repeatedly, which would hand back the true position
 * to anyone patient enough to ask twice.
 */
export function quantiseCoordinate(value: number, level: LocationPrecision): number {
  if (level === 'hidden') return 0;
  const { step, decimals } = GRID[level];
  if (step === 0) return value;
  return Number((Math.round(value / step) * step).toFixed(decimals));
}

/**
 * Apply a precision level to a position. Returns null for `hidden`, which the
 * caller must treat as "this marker does not exist" rather than "this marker
 * is at 0,0".
 */
export function applyPrecision(
  position: { lat: number; lng: number },
  level: LocationPrecision,
): { lat: number; lng: number } | null {
  if (level === 'hidden') return null;
  return {
    lat: quantiseCoordinate(position.lat, level),
    lng: quantiseCoordinate(position.lng, level),
  };
}
