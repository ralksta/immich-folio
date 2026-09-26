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
import { fr } from '../i18n/locales/fr';
import { es } from '../i18n/locales/es';
import { it as itIT } from '../i18n/locales/it';
import { nl } from '../i18n/locales/nl';
import type { Dictionary } from '../i18n';

describe('resolveLocale', () => {
  it('accepts the supported locales', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(resolveLocale(locale)).toBe(locale);
    }
  });

  it('drops the region subtag', () => {
    expect(resolveLocale('de-DE')).toBe('de');
    expect(resolveLocale('de-AT')).toBe('de');
    expect(resolveLocale('en_GB')).toBe('en');
    expect(resolveLocale('fr-CA')).toBe('fr');
    expect(resolveLocale('es-MX')).toBe('es');
    expect(resolveLocale('it-CH')).toBe('it');
    expect(resolveLocale('nl-BE')).toBe('nl');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(resolveLocale('  DE  ')).toBe('de');
    expect(resolveLocale('De-Ch')).toBe('de');
  });

  it('falls back to English for languages without a dictionary', () => {
    expect(resolveLocale('ja-JP')).toBe('en');
    expect(resolveLocale('pt')).toBe('en');
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
    expect(dictionaryFor('fr-FR')).toBe(fr);
    expect(dictionaryFor('ja')).toBe(en);
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

/**
 * Keys a locale legitimately shares with English — proper nouns, loanwords,
 * units and cognates that read the same in both languages. Anything not listed
 * here and still identical to English is an untranslated string.
 */
const SHARED_EVERYWHERE = [
  'lightbox.iso',
  // Pure interpolation with no words of its own.
  'subpage.coverAria',
];

const TRANSLATIONS: [string, Dictionary, string[]][] = [
  [
    'de',
    de,
    [
      'nav.journal',
      'journal.title',
      'lightbox.copyLinkShort',
      'lightbox.downloadShort',
      'common.website',
      'contact.name',
    ],
  ],
  [
    'fr',
    fr,
    [
      'nav.journal',
      'journal.title',
      'about.portraitAlt',
      'legal.contact',
      'lightbox.downloadShort',
      'subpage.sectionsNav',
      'subpage.collectionKicker',
      // French shares the words "photo(s)", "album(s)" and "collection(s)".
      'common.photos',
      'common.albums',
      'common.collections',
      'contact.navLabel',
      'contact.title',
      'contact.message',
    ],
  ],
  ['es', es, ['lightbox.downloadShort', 'lightbox.info']],
  ['it', itIT, ['nav.home', 'common.home', 'lightbox.info', 'lightbox.copyLinkShort']],
  [
    'nl',
    nl,
    [
      'nav.journal',
      'journal.title',
      'common.website',
      'common.albums',
      'lightbox.camera',
      'lightbox.info',
      'lightbox.copyLinkShort',
      'legal.contact',
      'contact.navLabel',
      'contact.title',
    ],
  ],
];

describe('supported locales', () => {
  it('have a parity check below for every non-English dictionary', () => {
    expect(TRANSLATIONS.map(([code]) => code).sort()).toEqual(
      SUPPORTED_LOCALES.filter((l) => l !== 'en').sort(),
    );
  });

  it('each dictionary is the one getDictionary serves', () => {
    for (const [code, dict] of TRANSLATIONS) {
      expect(getDictionary(code as (typeof SUPPORTED_LOCALES)[number])).toBe(dict);
    }
  });
});

describe.each(TRANSLATIONS)('dictionary parity: %s', (code, dict, sharedKeys) => {
  const enLeaves = leaves(en);
  const otherLeaves = new Map(leaves(dict));

  it('covers every English key', () => {
    expect([...otherLeaves.keys()].sort()).toEqual(enLeaves.map(([k]) => k).sort());
  });

  it('matches value kinds — a string never stands in for an interpolator', () => {
    for (const [path, value] of enLeaves) {
      expect(typeof otherLeaves.get(path), path).toBe(typeof value);
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

  it('formats dates for its own language', () => {
    expect(dict.dateLocale.split('-')[0]).toBe(code);
  });
});

describe('plural helpers', () => {
  it.each([['en', en] as const, ...TRANSLATIONS.map(([c, d]) => [c, d] as const)])(
    'vary on their count in %s',
    (_code, dict) => {
      expect(dict.common.photos(1)).not.toBe(dict.common.photos(2));
      expect(dict.common.albums(1)).not.toBe(dict.common.albums(2));
      expect(dict.common.collections(1)).not.toBe(dict.common.collections(2));
    },
  );
});
