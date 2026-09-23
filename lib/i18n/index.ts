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
 * The dictionaries are small enough that shipping them together beats a
 * dynamic import.
 */

import { en } from './locales/en';
import { de } from './locales/de';
import { fr } from './locales/fr';
import { es } from './locales/es';
import { it } from './locales/it';
import { nl } from './locales/nl';

/** Locales with a dictionary. Anything else falls back to English. */
export const SUPPORTED_LOCALES = ['en', 'de', 'fr', 'es', 'it', 'nl'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** The shape every dictionary must implement — English is the reference. */
export type Dictionary = typeof en;

const DICTIONARIES: Record<Locale, Dictionary> = { en, de, fr, es, it, nl };

/**
 * Map a `settings.yaml: lang` value onto a locale we have strings for.
 *
 * Region subtags are accepted (`de-AT` → `de`), unknown languages fall back to
 * English. The raw value still reaches `<html lang>` — a Japanese deployment gets
 * `lang="ja"` for screen readers and an English UI, which beats claiming to be
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
