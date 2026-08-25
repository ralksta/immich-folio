/**
 * i18n — locale resolution and dictionary parity.
 *
 * The parity walk is the point: `de.ts` is typed as `Dictionary`, so a *missing*
 * key is already a compile error. What the type cannot catch is a key that was
 * copied over but never translated, or a plural function that ignores its
 * argument — both of which ship an English string on a German site.
 */

import { describe, it, expect } from 'vitest';
import { resolveLocale, getDictionary, dictionaryFor, SUPPORTED_LOCALES } from '../i18n';
import { en } from '../i18n/locales/en';
import { de } from '../i18n/locales/de';

describe('resolveLocale', () => {
  it('accepts the supported locales', () => {
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('de')).toBe('de');
  });

  it('drops the region subtag', () => {
    expect(resolveLocale('de-DE')).toBe('de');
    expect(resolveLocale('de-AT')).toBe('de');
    expect(resolveLocale('en_GB')).toBe('en');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(resolveLocale('  DE  ')).toBe('de');
    expect(resolveLocale('De-Ch')).toBe('de');
  });

  it('falls back to English for languages without a dictionary', () => {
    expect(resolveLocale('fr')).toBe('en');
    expect(resolveLocale('ja-JP')).toBe('en');
    expect(resolveLocale('')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
    expect(resolveLocale(null)).toBe('en');
  });
});

describe('getDictionary', () => {
  it('returns a dictionary for every supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(getDictionary(locale)).toBeDefined();
    }
  });

  it('dictionaryFor resolves and looks up in one step', () => {
    expect(dictionaryFor('de-DE')).toBe(de);
    expect(dictionaryFor('fr')).toBe(en);
  });
});

/** Every leaf of a dictionary, as `['nav.home', 'Home']` pairs. */
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

describe('dictionary parity', () => {
  const enLeaves = leaves(en);
  const deLeaves = new Map(leaves(de));

  it('German covers every English key', () => {
    expect([...deLeaves.keys()].sort()).toEqual(enLeaves.map(([k]) => k).sort());
  });

  it('matches value kinds — a string never stands in for an interpolator', () => {
    for (const [path, value] of enLeaves) {
      expect(typeof deLeaves.get(path), path).toBe(typeof value);
    }
  });

  it('leaves no English string untranslated', () => {
    // Proper nouns, loanwords and units read the same in both languages;
    // `coverAria` is pure interpolation with no words of its own.
    const shared = new Set([
      'nav.journal',
      'journal.title',
      'lightbox.iso',
      'lightbox.copyLinkShort',
      'lightbox.downloadShort',
      'subpage.coverAria',
    ]);

    const identical = enLeaves
      .filter(([path]) => !shared.has(path))
      .filter(([path, value]) => {
        const other = deLeaves.get(path);
        if (typeof value === 'function') {
          return invoke(other as (...a: never[]) => string) === invoke(value as never);
        }
        return other === value;
      })
      .map(([path]) => path);

    expect(identical).toEqual([]);
  });

  it('plural helpers actually vary on their count', () => {
    for (const dict of [en, de]) {
      expect(dict.common.photos(1)).not.toBe(dict.common.photos(2));
      expect(dict.common.albums(1)).not.toBe(dict.common.albums(2));
      expect(dict.common.collections(1)).not.toBe(dict.common.collections(2));
    }
  });
});
