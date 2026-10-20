/**
 * Admin panel internationalisation (#604).
 *
 * The same approach as the visitor dictionaries in `lib/i18n/` — plain objects,
 * English as the reference type, no framework — kept in dictionaries of their
 * own so a visitor never downloads the panel's strings. The panel's language is
 * `settings.yaml: adminLang`, falling back to the site's `lang`, so an operator
 * can run an English panel over a German site or the other way round.
 *
 * Each locale is split by area of the panel (`shell`, `settings`, …), one file
 * per area, so the pull requests that translate the rest of the panel each add
 * a file instead of editing one shared dictionary.
 *
 * This module is **client-safe** (no `fs`). The admin layout resolves the
 * locale on the server and hands only the locale string to
 * `app/admin/components/AdminI18n.tsx`, which looks the dictionary up here.
 */

import { resolveLocale, DEFAULT_LOCALE, type Locale } from '../index';
import { adminEn } from './en';
import { adminDe } from './de';
import { adminFr } from './fr';
import { adminEs } from './es';
import { adminIt } from './it';
import { adminNl } from './nl';

/** The shape every admin dictionary must implement — English is the reference. */
export type AdminDictionary = typeof adminEn;

const ADMIN_DICTIONARIES: Record<Locale, AdminDictionary> = {
  en: adminEn,
  de: adminDe,
  fr: adminFr,
  es: adminEs,
  it: adminIt,
  nl: adminNl,
};

/**
 * The admin panel's locale: `adminLang` when it is set, the site's `lang`
 * otherwise. Either goes through `resolveLocale`, so a region subtag is dropped
 * and a language without a dictionary falls back to English.
 */
export function resolveAdminLocale(adminLang?: string | null, siteLang?: string | null): Locale {
  return resolveLocale(adminLang?.trim() ? adminLang : siteLang);
}

/** Admin dictionary for a locale (already resolved). */
export function getAdminDictionary(locale: Locale): AdminDictionary {
  return ADMIN_DICTIONARIES[locale] ?? adminEn;
}

export { DEFAULT_LOCALE };
