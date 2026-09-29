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
  [
    'it',
    itIT,
    ['nav.home', 'common.home', 'lightbox.info', 'lightbox.copyLinkShort', 'privacy.navLabel'],
  ],
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
      'privacy.navLabel',
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

/**
 * Count strings at the CLDR boundaries. French puts 0 in the singular ("0 photo"),
 * the other five use the singular for exactly 1 — so a shared `n === 1` helper
 * was wrong for French, and a hard-coded plural noun ("(1 items)") was wrong for
 * everyone at 1. Italian "foto"/"album" and the Dutch/German participles are
 * invariable, which the table spells out rather than skips.
 */
type Counted = (d: Dictionary, n: number) => string;
const COUNTED = {
  photos: (d, n) => d.common.photos(n),
  albums: (d, n) => d.common.albums(n),
  collections: (d, n) => d.common.collections(n),
  selected: (d, n) => d.proofing.selected(n),
  mailSubject: (d, n) => d.proofing.mailSubject(n),
  downloadsLeft: (d, n) => d.proofSession.downloadsLeft(n),
} satisfies Record<string, Counted>;
type CountedKey = keyof typeof COUNTED;

const PLURAL_TABLE: [string, Dictionary, Record<CountedKey, [string, string, string]>][] = [
  [
    'en',
    en,
    {
      photos: ['0 photos', '1 photo', '2 photos'],
      albums: ['0 albums', '1 album', '2 albums'],
      collections: ['0 collections', '1 collection', '2 collections'],
      selected: ['❤️ 0 Selected', '❤️ 1 Selected', '❤️ 2 Selected'],
      mailSubject: [
        'Photo Selection (0 items)',
        'Photo Selection (1 item)',
        'Photo Selection (2 items)',
      ],
      downloadsLeft: ['0 downloads left', '1 download left', '2 downloads left'],
    },
  ],
  [
    'de',
    de,
    {
      photos: ['0 Fotos', '1 Foto', '2 Fotos'],
      albums: ['0 Alben', '1 Album', '2 Alben'],
      collections: ['0 Sammlungen', '1 Sammlung', '2 Sammlungen'],
      selected: ['❤️ 0 ausgewählt', '❤️ 1 ausgewählt', '❤️ 2 ausgewählt'],
      mailSubject: ['Fotoauswahl (0 Fotos)', 'Fotoauswahl (1 Foto)', 'Fotoauswahl (2 Fotos)'],
      downloadsLeft: ['Noch 0 Downloads', 'Noch 1 Download', 'Noch 2 Downloads'],
    },
  ],
  [
    'fr',
    fr,
    {
      photos: ['0 photo', '1 photo', '2 photos'],
      albums: ['0 album', '1 album', '2 albums'],
      collections: ['0 collection', '1 collection', '2 collections'],
      selected: ['❤️ 0 sélectionnée', '❤️ 1 sélectionnée', '❤️ 2 sélectionnées'],
      mailSubject: [
        'Sélection de photos (0)',
        'Sélection de photos (1)',
        'Sélection de photos (2)',
      ],
      downloadsLeft: [
        '0 téléchargement restant',
        '1 téléchargement restant',
        '2 téléchargements restants',
      ],
    },
  ],
  [
    'es',
    es,
    {
      photos: ['0 fotos', '1 foto', '2 fotos'],
      albums: ['0 álbumes', '1 álbum', '2 álbumes'],
      collections: ['0 colecciones', '1 colección', '2 colecciones'],
      selected: ['❤️ 0 seleccionadas', '❤️ 1 seleccionada', '❤️ 2 seleccionadas'],
      mailSubject: ['Selección de fotos (0)', 'Selección de fotos (1)', 'Selección de fotos (2)'],
      downloadsLeft: ['0 descargas restantes', '1 descarga restante', '2 descargas restantes'],
    },
  ],
  [
    'it',
    itIT,
    {
      photos: ['0 foto', '1 foto', '2 foto'],
      albums: ['0 album', '1 album', '2 album'],
      collections: ['0 collezioni', '1 collezione', '2 collezioni'],
      selected: ['❤️ 0 selezionate', '❤️ 1 selezionata', '❤️ 2 selezionate'],
      mailSubject: ['Selezione di foto (0)', 'Selezione di foto (1)', 'Selezione di foto (2)'],
      downloadsLeft: ['0 download rimasti', '1 download rimasto', '2 download rimasti'],
    },
  ],
  [
    'nl',
    nl,
    {
      photos: ['0 foto’s', '1 foto', '2 foto’s'],
      albums: ['0 albums', '1 album', '2 albums'],
      collections: ['0 collecties', '1 collectie', '2 collecties'],
      selected: ['❤️ 0 geselecteerd', '❤️ 1 geselecteerd', '❤️ 2 geselecteerd'],
      mailSubject: ['Fotoselectie (0)', 'Fotoselectie (1)', 'Fotoselectie (2)'],
      downloadsLeft: ['Nog 0 downloads', 'Nog 1 download', 'Nog 2 downloads'],
    },
  ],
];

describe('plural forms at 0, 1 and 2', () => {
  it('cover every supported locale', () => {
    expect(PLURAL_TABLE.map(([code]) => code).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  describe.each(PLURAL_TABLE)('%s', (_code, dict, expected) => {
    it.each(Object.keys(COUNTED) as CountedKey[])('%s', (key) => {
      expect([0, 1, 2].map((n) => COUNTED[key](dict, n))).toEqual(expected[key]);
    });
  });

  it.each([
    ['en', en, ['0 days.', '1 day.', '2 days.']],
    ['de', de, ['0 Tagen gelöscht.', '1 Tag gelöscht.', '2 Tagen gelöscht.']],
    ['fr', fr, ['0 jour.', '1 jour.', '2 jours.']],
    ['es', es, ['0 días.', '1 día.', '2 días.']],
    ['it', itIT, ['0 giorni.', '1 giorno.', '2 giorni.']],
    ['nl', nl, ['0 dagen verwijderd.', '1 dag verwijderd.', '2 dagen verwijderd.']],
  ] as const)('contact retention days in %s', (_code, dict, endings) => {
    const got = [0, 1, 2].map((n) => dict.contact.privacy(n));
    got.forEach((text, i) => expect(text.endsWith(` ${endings[i]}`), text).toBe(true));
  });
});

describe('German terminology', () => {
  // The carousel said "Diashow", the lightbox's shortcut panel and live
  // region "Diaschau" for the same feature.
  it('calls the slideshow "Diashow" everywhere', () => {
    const strings = [
      de.home.pauseSlideshow,
      de.home.playSlideshow,
      de.lightbox.shortcutSlideshow,
      de.lightbox.shortcutSlideshowRunning(5),
      de.lightbox.slideshowStopped,
      de.lightbox.slideshowRunning(5),
    ];
    for (const s of strings) expect(s).toContain('Diashow');
  });

  it('leaves no "Diaschau" in any string', () => {
    const walk = (value: unknown): string[] =>
      typeof value === 'string'
        ? [value]
        : typeof value === 'function'
          ? [String((value as (n: number) => string)(2))]
          : value && typeof value === 'object'
            ? Object.values(value).flatMap(walk)
            : [];
    expect(walk(de).filter((s) => s.includes('Diaschau'))).toEqual([]);
  });
});
