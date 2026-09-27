/**
 * Selection state of the asset picker's multi-select mode (#602), as plain
 * functions so it can be tested without rendering the picker.
 *
 * The selection is an ordered list: the order you click in is the order the
 * photos land in (hero list, photo grid), so a Set would lose information.
 */

export interface SelectionRules {
  /** Assets the caller already uses; they cannot be picked again. */
  disabled?: ReadonlySet<string>;
  /** Most assets the caller can take; undefined means no limit. */
  max?: number;
}

/**
 * The selection after toggling `id`: removed when present, appended when not,
 * unchanged when it is disabled or the limit is reached. With `max: 1` a new
 * pick replaces the old one, which is how a single slot should feel.
 */
export function toggleSelection(
  selected: readonly string[],
  id: string,
  rules: SelectionRules = {},
): string[] {
  if (selected.includes(id)) return selected.filter((s) => s !== id);
  if (rules.disabled?.has(id)) return [...selected];
  if (rules.max === 1) return [id];
  if (rules.max !== undefined && selected.length >= rules.max) return [...selected];
  return [...selected, id];
}

/** Whether another asset can still be added without deselecting one first. */
export function canSelectMore(selected: readonly string[], max?: number): boolean {
  return max === undefined || max === 1 || selected.length < max;
}

/** Client-side filter for lists the server returns whole (an album's assets). */
export function matchesQuery(asset: { originalFileName: string }, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === '' || asset.originalFileName.toLowerCase().includes(q);
}
