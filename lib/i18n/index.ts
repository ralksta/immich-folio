/**
 * Visitor-facing internationalisation.
 *
 * Deliberately not a framework: `settings.yaml: lang` picks one of the
 * dictionaries in `lib/i18n/locales/`, and every visitor-facing string is read
 * off that object. No message extraction, no runtime loader, no route prefixes
 * — a self-hosted portfolio is served in exactly one language.
 *
 * This module is **client-safe** (no `fs`). Server components read the language
 * from the config via `lib/i18n/server.ts`; client components take the resolved
 * locale from `components/I18nProvider.tsx` and look the dictionary up here.
 * Both dictionaries are small enough that shipping them together beats a
 * dynamic import.
 */

import { en } from './locales/en';
import { de } from './locales/de';

/** Locales with a dictionary. Anything else falls back to English. */
export const SUPPORTED_LOCALES = ['en', 'de'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** The shape every dictionary must implement — English is the reference. */
export type Dictionary = typeof en;

const DICTIONARIES: Record<Locale, Dictionary> = { en, de };

/**
 * Map a `settings.yaml: lang` value onto a locale we have strings for.
 *
 * Region subtags are accepted (`de-AT` → `de`), unknown languages fall back to
 * English. The raw value still reaches `<html lang>` — a French deployment gets
 * `lang="fr"` for screen readers and an English UI, which beats claiming to be
 * English.
 */
export function resolveLocale(lang?: string | null): Locale {
  if (!lang) return DEFAULT_LOCALE;
  const base = lang.trim().toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_LOCALES as readonly string[]).includes(base)
    ? (base as Locale)
    : DEFAULT_LOCALE;
}

/** Dictionary for a locale (already resolved). */
export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/** Convenience: resolve a raw `lang` string and return its dictionary. */
export function dictionaryFor(lang?: string | null): Dictionary {
  return getDictionary(resolveLocale(lang));
}
