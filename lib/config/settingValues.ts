/**
 * Values in settings.yaml that the site would silently ignore (QA A-14).
 *
 * `validateSettings` (settingsSchema.ts) checks types and structure and
 * deliberately leaves values to the resolvers, which clamp or fall back so
 * hand-edited YAML never takes the site down. For the fields the panel offers
 * an input for, that meant a save of `accent: rot` or nine columns in a 1–6
 * field was reported as "Saved" while the site showed something else.
 *
 * This checks the values a resolver bends — the site URL, the accent, the
 * corner radius, the grid columns and gap, the message retention and the
 * header links — with the resolvers' own rules and bounds, so it can never be
 * stricter than what renders. Kept apart from settingsSchema.ts so the
 * settings form can run it as you type without bundling zod; the save route
 * runs it before writing, and both doctors over settings.yaml as it is.
 *
 * `npm run doctor` imports this file under Node's own type stripping
 * (scripts/doctor.mts), which resolves no extensionless paths: every relative
 * import here carries its `.ts`, and the modules it pulls in may only
 * `import type` from elsewhere. scripts/__tests__/doctor-cli.test.ts loads the
 * graph in a real Node process and fails when that breaks.
 */

import { normaliseSiteUrl } from '../siteUrl.ts';
import { isAccentHex, THEME_RADIUS_MAX } from './theme.ts';
import {
  CONTACT_RETENTION_MAX,
  PHOTO_GRID_COLUMNS_MAX,
  PHOTO_GRID_COLUMNS_MIN,
  PHOTO_GRID_GAP_MAX,
} from './schema.ts';
import type { SettingsFieldError } from './settingsSchema';

function inRange(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** What sanitizeNavLinks (lib/config/index.ts) keeps as a link target. */
const NAV_LINK_URL = /^https?:\/\//i;

/** One error per offending field; an empty string counts as unset, as in the resolvers. */
export function validateSettingValues(input: unknown): SettingsFieldError[] {
  if (!input || typeof input !== 'object') return [];
  const s = input as {
    url?: unknown;
    theme?: unknown;
    grid?: { columns?: unknown; gap?: unknown } | null;
    contact?: { retentionDays?: unknown } | null;
    navLinks?: unknown;
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

  const theme =
    s.theme && typeof s.theme === 'object'
      ? (s.theme as { accent?: unknown; radius?: unknown })
      : null;

  // resolveTheme: anything but hex falls back to the preset's accent.
  const accent = theme?.accent;
  if (typeof accent === 'string' && accent.trim() !== '' && !isAccentHex(accent)) {
    errors.push({ field: 'theme.accent', message: 'Must be a hex colour such as #e60012.' });
  }

  // resolveRadius clamps into 0–THEME_RADIUS_MAX. The panel has no input for
  // it, so the message says where the value lives.
  const radius = theme?.radius;
  if (
    radius != null &&
    (typeof radius !== 'number' ||
      !Number.isFinite(radius) ||
      radius < 0 ||
      radius > THEME_RADIUS_MAX)
  ) {
    errors.push({
      field: 'theme.radius',
      message: `Must be a number from 0 to ${THEME_RADIUS_MAX} (theme.radius in settings.yaml).`,
    });
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

  // resolveContact rounds and clamps into 1–CONTACT_RETENTION_MAX.
  const contact = s.contact && typeof s.contact === 'object' ? s.contact : null;
  if (contact?.retentionDays != null && !inRange(contact.retentionDays, 1, CONTACT_RETENTION_MAX)) {
    errors.push({
      field: 'contact.retentionDays',
      message: `Must be a whole number of days from 1 to ${CONTACT_RETENTION_MAX}.`,
    });
  }

  // sanitizeNavLinks drops an entry without a label or without an http(s)
  // URL, whole — so each half is reported against its own input.
  if (Array.isArray(s.navLinks)) {
    s.navLinks.forEach((entry: unknown, i) => {
      const link = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
      const label = typeof link.label === 'string' ? link.label.trim() : '';
      const url = typeof link.url === 'string' ? link.url.trim() : '';
      if (!label) {
        errors.push({
          field: `navLinks.${i}.label`,
          message: 'Needs a label, or the link is left out.',
        });
      }
      if (!NAV_LINK_URL.test(url)) {
        errors.push({
          field: `navLinks.${i}.url`,
          message: 'Must be a full http(s) address, or the link is left out.',
        });
      }
    });
  }

  return errors;
}
