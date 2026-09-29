/**
 * Values in settings.yaml that the site would silently ignore (QA A-14).
 *
 * `validateSettings` (settingsSchema.ts) checks types and structure and
 * deliberately leaves values to the resolvers, which clamp or fall back so
 * hand-edited YAML never takes the site down. For the fields the panel offers
 * an input for, that meant a save of `accent: rot` or nine columns in a 1–6
 * field was reported as "Saved" while the site showed something else.
 *
 * This checks exactly those fields — the site URL, the accent, the grid
 * columns and gap — with the resolvers' own rules and bounds, so it can never
 * be stricter than what renders. Kept apart from settingsSchema.ts so the
 * settings form can run it as you type without bundling zod; the save route
 * runs it before writing, and the doctor over settings.yaml as it is.
 */

import { normaliseSiteUrl } from '../siteUrl';
import { isAccentHex } from './theme';
import { PHOTO_GRID_COLUMNS_MAX, PHOTO_GRID_COLUMNS_MIN, PHOTO_GRID_GAP_MAX } from './schema';
import type { SettingsFieldError } from './settingsSchema';

function inRange(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** One error per offending field; an empty string counts as unset, as in the resolvers. */
export function validateSettingValues(input: unknown): SettingsFieldError[] {
  if (!input || typeof input !== 'object') return [];
  const s = input as {
    url?: unknown;
    theme?: unknown;
    grid?: { columns?: unknown; gap?: unknown } | null;
  };
  const errors: SettingsFieldError[] = [];

  // resolveSiteUrl: an unusable value falls back to SITE_URL, or to nothing,
  // and the sitemap, feed and structured data go out without the address.
  if (typeof s.url === 'string' && s.url.trim() !== '' && !normaliseSiteUrl(s.url)) {
    errors.push({
      field: 'url',
      message: 'Must be a full http(s) address, e.g. https://photos.example.com.',
    });
  }

  // resolveTheme: anything but hex falls back to the preset's accent.
  const accent =
    s.theme && typeof s.theme === 'object' ? (s.theme as { accent?: unknown }).accent : undefined;
  if (typeof accent === 'string' && accent.trim() !== '' && !isAccentHex(accent)) {
    errors.push({ field: 'theme.accent', message: 'Must be a hex colour such as #e60012.' });
  }

  // getConfig clamps both into these bounds (lib/config/index.ts).
  const grid = s.grid && typeof s.grid === 'object' ? s.grid : null;
  if (
    grid?.columns != null &&
    !inRange(grid.columns, PHOTO_GRID_COLUMNS_MIN, PHOTO_GRID_COLUMNS_MAX)
  ) {
    errors.push({
      field: 'grid.columns',
      message: `Must be a whole number from ${PHOTO_GRID_COLUMNS_MIN} to ${PHOTO_GRID_COLUMNS_MAX}.`,
    });
  }
  if (grid?.gap != null && !inRange(grid.gap, 0, PHOTO_GRID_GAP_MAX)) {
    errors.push({
      field: 'grid.gap',
      message: `Must be a whole number from 0 to ${PHOTO_GRID_GAP_MAX}.`,
    });
  }

  return errors;
}
