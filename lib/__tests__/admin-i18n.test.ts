/**
 * Admin panel i18n (#604) — locale resolution and dictionary parity.
 *
 * The same walk as `i18n.test.ts` for the visitor dictionaries: a missing key
 * is already a type error, so what this catches is a key that was copied but
 * never translated, and an interpolator that ignores its argument.
 */

import { describe, it, expect } from 'vitest';
import { SUPPORTED_LOCALES } from '../i18n';
import { getAdminDictionary, resolveAdminLocale, type AdminDictionary } from '../i18n/admin';
import { adminEn } from '../i18n/admin/en';

describe('resolveAdminLocale', () => {
  it('uses adminLang when it is set', () => {
    expect(resolveAdminLocale('de', 'en')).toBe('de');
    expect(resolveAdminLocale('en', 'de')).toBe('en');
  });

  it('follows the site language when adminLang is unset or blank', () => {
    expect(resolveAdminLocale(undefined, 'fr')).toBe('fr');
    expect(resolveAdminLocale(null, 'nl-BE')).toBe('nl');
    expect(resolveAdminLocale('', 'it')).toBe('it');
    expect(resolveAdminLocale('   ', 'es')).toBe('es');
  });

  it('falls back to English for a language without a dictionary', () => {
    expect(resolveAdminLocale('ja', 'de')).toBe('en');
    expect(resolveAdminLocale(undefined, 'ja')).toBe('en');
    expect(resolveAdminLocale(undefined, undefined)).toBe('en');
  });

  it('drops the region subtag', () => {
    expect(resolveAdminLocale('de-AT', 'en')).toBe('de');
  });
});

/** Every leaf of a dictionary, as `['shell.nav.pages', 'Pages']` pairs. */
function leaves(obj: object, prefix = ''): [string, unknown][] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === 'object'
      ? leaves(value, path)
      : ([[path, value]] as [string, unknown][]);
  });
}

/** Call a dictionary function with plausible arguments for its arity. */
function invoke(fn: (...args: never[]) => string): string {
  const args = Array.from({ length: fn.length }, (_, i) => (i === 0 ? 2 : `arg${i}`));
  return (fn as (...a: unknown[]) => string)(...args);
}

/**
 * Keys a locale legitimately shares with English — proper nouns, loanwords and
 * cognates. Anything not listed and still identical to English is an
 * untranslated string.
 */
const SHARED_EVERYWHERE: string[] = [];

const TRANSLATIONS: [string, AdminDictionary, string[]][] = [];

describe('admin dictionaries', () => {
  it('have a parity check below for every non-English locale', () => {
    expect(TRANSLATIONS.map(([code]) => code).sort()).toEqual(
      SUPPORTED_LOCALES.filter((l) => l !== 'en').sort(),
    );
  });

  it('each dictionary is the one getAdminDictionary serves', () => {
    expect(getAdminDictionary('en')).toBe(adminEn);
    for (const [code, dict] of TRANSLATIONS) {
      expect(getAdminDictionary(code as (typeof SUPPORTED_LOCALES)[number])).toBe(dict);
    }
  });

  it('keeps every {placeholder} in an English template unique', () => {
    // rich() fills placeholders by name; a duplicate would render twice.
    for (const [path, value] of leaves(adminEn)) {
      if (typeof value !== 'string') continue;
      const names = [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      expect(new Set(names).size, path).toBe(names.length);
    }
  });
});

describe.each(TRANSLATIONS)('admin dictionary parity: %s', (_code, dict, sharedKeys) => {
  const enLeaves = leaves(adminEn);
  const otherLeaves = new Map(leaves(dict));

  it('covers every English key', () => {
    expect([...otherLeaves.keys()].sort()).toEqual(enLeaves.map(([k]) => k).sort());
  });

  it('matches value kinds — a string never stands in for an interpolator', () => {
    for (const [path, value] of enLeaves) {
      expect(typeof otherLeaves.get(path), path).toBe(typeof value);
    }
  });

  it('keeps the same {placeholders} as English', () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [path, value] of enLeaves) {
      if (typeof value !== 'string') continue;
      expect(names(otherLeaves.get(path) as string), path).toEqual(names(value));
    }
  });

  it('leaves no English string untranslated', () => {
    const shared = new Set([...SHARED_EVERYWHERE, ...sharedKeys]);
    const identical = enLeaves
      .filter(([path]) => !shared.has(path))
      .filter(([path, value]) => {
        const other = otherLeaves.get(path);
        if (typeof value === 'function') {
          return invoke(other as (...a: never[]) => string) === invoke(value as never);
        }
        return other === value;
      })
      .map(([path]) => path);
    expect(identical).toEqual([]);
  });

  it('lists only keys that really are identical, so the allowance cannot go stale', () => {
    const english = new Map(enLeaves);
    const stale = sharedKeys.filter((path) => {
      const value = english.get(path);
      const other = otherLeaves.get(path);
      return typeof value === 'function'
        ? invoke(other as (...a: never[]) => string) !== invoke(value as never)
        : other !== value;
    });
    expect(stale).toEqual([]);
  });
});
