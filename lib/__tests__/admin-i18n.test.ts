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
import { adminDe } from '../i18n/admin/de';
import { adminFr } from '../i18n/admin/fr';
import { adminEs } from '../i18n/admin/es';
import { adminIt } from '../i18n/admin/it';
import { adminNl } from '../i18n/admin/nl';
import { LIGHTBOX_SHORTCUTS } from '../lightboxShortcuts';

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

/**
 * Call a dictionary function with plausible arguments for its arity. A
 * function that takes a list (`names: string[]`) throws on a string, so the
 * call is retried with one-element lists, which interpolate the same way.
 */
function invoke(fn: (...args: never[]) => string): string {
  const call = fn as (...a: unknown[]) => string;
  const args = Array.from({ length: fn.length }, (_, i) => (i === 0 ? 2 : `arg${i}`));
  try {
    return call(...args);
  } catch {
    return call(...args.map((arg, i) => (i === 0 ? arg : [arg])));
  }
}

/**
 * Keys a locale legitimately shares with English — proper nouns, loanwords and
 * cognates. Anything not listed and still identical to English is an
 * untranslated string.
 */
const SHARED_EVERYWHERE: string[] = [
  // Immich's own English setting name, quoted as the operator sees it there.
  'diagnostics.altText.externalDomain',
  'diagnostics.vitals.immich',
  'settings.editor.sections.seo',
  'settings.general.favicon',
  'system.backups.files.gallery',
  'system.backups.files.settings',
  'system.backups.files.about',
  'system.backups.files.privacy',
  'system.backups.tabLabel',
];

const TRANSLATIONS: [string, AdminDictionary, string[]][] = [
  [
    'de',
    adminDe,
    [
      'shell.nav.groups.system',
      'shell.nav.journal',
      'shell.sidebar.landmark',
      'shell.sidebar.brandSub',
      'shell.sidebar.backups',
      'shell.status.backupCount',
      'shell.status.version',
      'shell.health.ok',
      'shell.draft.ok',
      'shell.overview.journal',
      'settings.general.details',
      'settings.theme.photoFrames.passepartout.label',
      'settings.theme.heroStyles.minimal.label',
      'settings.grid.layouts.masonry.label',
      'settings.grid.layouts.showcase.label',
      'settings.grid.layouts.editorial-flow.label',
      'settings.footer.linkLabelPlaceholder',
      'settings.footer.linkUrl',
      'settings.security.position',
      'settings.about.name',
      'diagnostics.levels.ok',
      'diagnostics.levels.error',
      'diagnostics.header.kicker',
      'diagnostics.report.version',
      'diagnostics.vitals.backups',
      'diagnostics.vitals.version',
      'doctor.passwords.labelAlbum',
      'visitors.proofing.create.clientPlaceholder',
      'visitors.proofing.create.album',
      'visitors.proofing.create.downloads',
      'system.help.kicker',
      'system.backups.tabs.journal',
    ],
  ],
  [
    'fr',
    adminFr,
    [
      'shell.nav.groups.site',
      'shell.nav.pages',
      'shell.nav.journal',
      'shell.nav.messages',
      'shell.nav.diagnostics',
      'shell.sidebar.brandSub',
      'shell.status.version',
      'shell.draft.ok',
      'shell.overview.pages',
      'shell.overview.journal',
      'shell.overview.messages',
      'shell.overview.diagnostics',
      'settings.editor.kicker',
      'settings.general.modules',
      'settings.general.metadataSummary.description',
      'settings.theme.swatches.violet',
      'settings.grid.aspectRatios.2/3.label',
      'settings.footer.linkUrl',
      'settings.security.position',
      'diagnostics.levels.ok',
      'diagnostics.report.version',
      'diagnostics.vitals.version',
      'doctor.passwords.labelAlbum',
      'visitors.messages.title',
      'visitors.proofing.create.client',
      'visitors.proofing.create.album',
      'system.help.diagnostics',
      'system.help.diagnosticsTab',
      'system.backups.tabs.journal',
    ],
  ],
  [
    'es',
    adminEs,
    ['common.errorWith', 'settings.editor.sections.general', 'settings.footer.linkUrl'],
  ],
  [
    'it',
    adminIt,
    [
      'shell.login.password',
      'shell.sidebar.brandSub',
      'shell.draft.ok',
      'settings.theme.preset',
      'settings.grid.layouts.masonry.label',
      'settings.grid.aspectRatios.16/9.label',
      'diagnostics.levels.ok',
      'doctor.passwords.labelAlbum',
      'visitors.proofing.create.album',
      'system.backups.tabs.privacy',
    ],
  ],
  [
    'nl',
    adminNl,
    [
      'shell.nav.journal',
      'shell.nav.help',
      'shell.status.cacheItems',
      'shell.draft.ok',
      'shell.overview.journal',
      'settings.general.modules',
      'settings.general.details',
      'settings.grid.layouts.masonry.label',
      'settings.footer.linkUrl',
      'diagnostics.levels.ok',
      'doctor.passwords.labelAlbum',
      'visitors.proofing.states.open',
      'visitors.proofing.create.album',
      'visitors.proofing.create.downloads',
      'system.help.title',
      'system.backups.tabs.privacy',
      'system.backups.tabs.journal',
    ],
  ],
];

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

describe('admin plural forms', () => {
  const counted = (d: AdminDictionary) => [
    d.shell.overview.drafts,
    d.shell.overview.unreadMessages,
    d.shell.overview.needsLook,
  ];

  it.each(TRANSLATIONS.map(([code, dict]) => [code, dict] as const))(
    'vary between 1 and 2 in %s',
    (_code, dict) => {
      for (const fn of counted(dict)) expect(fn(1)).not.toBe(fn(2));
    },
  );

  it('put 0 in the singular in French, as the visitor dictionary does', () => {
    for (const fn of counted(adminFr)) {
      expect(fn(0).replace('0', '1')).toBe(fn(1));
    }
  });
});

describe('help page shortcut notes', () => {
  // The catalogue in lib/lightboxShortcuts.ts documents when a key is absent;
  // the help page shows that note in the panel's language. The English copy
  // must not drift from the catalogue, and no conditional key may lose its note.
  it('cover every shortcut that has a note, in the catalogue’s English', () => {
    const notes = adminEn.system.help.notes as Record<string, string>;
    const withNote = LIGHTBOX_SHORTCUTS.filter((s) => s.note);
    expect(Object.keys(notes).sort()).toEqual(withNote.map((s) => s.labelKey).sort());
    for (const shortcut of withNote) expect(notes[shortcut.labelKey]).toBe(shortcut.note);
  });
});
