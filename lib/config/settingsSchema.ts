/**
 * Runtime shape check for settings.yaml, used before the admin panel writes it.
 *
 * `PUT /api/admin/settings` used to cast the request body and write it. The
 * gallery route has had a net since a save there "used to report Saved
 * successfully and then take the public site down"; this is the same net for
 * settings (#599).
 *
 * ── What it checks, and what it deliberately does not ──────────────
 *
 * **Types and structure, not values.** A string where an object belongs, an
 * array where a record belongs, a number where a switch belongs — those are the
 * shapes that make a resolver throw, and they are what this rejects.
 *
 * Value narrowing belongs in the resolvers, because they are the only place
 * that also sees hand-edited YAML — this check only ever sees what the panel
 * sends. Several already do it: `resolveColorMode` falls back to `dark` for
 * anything it does not know, `resolveWatermarkOpacity` accepts both a fraction
 * and a percentage because a documented workaround produced the latter (#508),
 * and the album sort and location resolvers throw with a message naming the
 * offending value. Repeating those rules here would mean two places to keep in
 * step, and a stricter one would reject configurations that work today.
 *
 * `grid.columns` and `theme.radius` got the same treatment in #633: the
 * site-wide and per-subpage/album grid derivation (`lib/config/index.ts`)
 * clamps `columns` and `gap` to the bounds the admin inputs already share,
 * and `resolveTheme` (`lib/config/theme.ts`) coerces `radius`, `accent`,
 * `grain` and `headerDot` the same way `resolveColorMode` does — falling back
 * to the preset's own value for anything that is not the right type, which
 * covers hand-edited YAML as well as a save from this panel.
 *
 * **Unknown keys pass through.** There is no `schemaVersion` and no migration
 * code, so configurations older and newer than this build are both in the wild.
 * A key this version has never heard of is not evidence of a mistake, and
 * rejecting it would lock an operator out of their own settings through the
 * very panel that writes the file. Hence `looseObject` throughout.
 */

import { z } from 'zod';

const str = z.string().optional();
const bool = z.boolean().optional();
const num = z.number().optional();

const gridLike = z.looseObject({
  columns: num,
  gap: num,
  aspectRatio: str,
  layout: str,
});

export const settingsSchema = z.looseObject({
  title: str,
  subtitle: str,
  url: str,
  lang: str,

  seo: z
    .looseObject({
      title: str,
      description: str,
      titleTemplate: str,
      noIndex: bool,
      noFollow: bool,
      license: str,
    })
    .optional(),

  // Narrowed by resolveColorMode, which falls back to 'dark'.
  mode: str,

  exifOnHover: bool,
  exif: z
    .looseObject({
      camera: bool,
      settings: bool,
      location: bool,
      caption: bool,
    })
    .optional(),

  map: bool,
  transitions: bool,
  scrollToTop: bool,
  analytics: bool,

  proofing: z.looseObject({ enabled: bool, allowMailto: bool }).optional(),

  // Checked separately in validateSettings — see themeObjectSchema.
  theme: z.unknown().optional(),

  grid: gridLike.optional(),

  footer: z.looseObject({ name: str, instagram: str, email: str, website: str }).optional(),

  legal: z
    .looseObject({
      enabled: bool,
      heading: str,
      name: str,
      address: str,
      zipCity: str,
      country: str,
      email: str,
      phone: str,
      contactUrl: str,
      contactLabel: str,
      taxId: str,
      vatId: str,
      extraInfo: str,
    })
    .optional(),

  navLinks: z.array(z.looseObject({ label: str, url: str })).optional(),

  protection: z.looseObject({ disableRightClick: bool, disableImageDrag: bool }).optional(),

  sitePassword: str,

  watermark: z
    .looseObject({
      enabled: bool,
      text: str,
      // Not bounded here: resolveWatermarkOpacity reads anything above 1 as a
      // percentage, which is what keeps the #508 workaround working.
      opacity: num,
      position: str,
    })
    .optional(),

  about: z.looseObject({ enabled: bool }).optional(),
});

/**
 * The object form of `theme`, checked on its own rather than as a union branch.
 *
 * `theme` accepts either a preset name or an object overriding fields on top of
 * one. Expressed as `z.union([z.string(), …])`, a mistake deep inside the
 * object reports at `theme` — zod cannot say which branch was meant, so it
 * blames the field. Dispatching on the type first is what turns that back into
 * `theme.fonts.heading`, which is the difference between the panel marking the
 * offending input and shrugging at the whole section.
 */
const themeObjectSchema = z.looseObject({
  preset: str,
  accent: str,
  fonts: z.looseObject({ heading: str, body: str, caption: str }).optional(),
  radius: num,
  photoFrame: str,
  grain: bool,
  headerDot: bool,
  heroStyle: str,
});

export interface SettingsFieldError {
  /** Dotted path to the offending field, e.g. `theme.radius`. */
  field: string;
  message: string;
}

export type SettingsValidation = { ok: true } | { ok: false; errors: SettingsFieldError[] };

/**
 * Validate a settings payload before it is written.
 *
 * Errors carry the field path so the panel can put the message next to the
 * input that caused it, rather than showing one opaque failure for a file with
 * forty fields in it.
 */
export function validateSettings(input: unknown): SettingsValidation {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      errors: [{ field: '', message: 'Settings must be an object.' }],
    };
  }

  const errors: SettingsFieldError[] = [];

  const result = settingsSchema.safeParse(input);
  if (!result.success) {
    errors.push(
      ...result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }

  const theme = (input as { theme?: unknown }).theme;
  if (theme !== undefined && typeof theme !== 'string') {
    const themeResult = themeObjectSchema.safeParse(theme);
    if (!themeResult.success) {
      errors.push(
        ...themeResult.error.issues.map((issue) => ({
          field: ['theme', ...issue.path].join('.'),
          message: issue.message,
        })),
      );
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
