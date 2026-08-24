import { describe, it, expect } from 'vitest';
import { LIGHTBOX_SHORTCUTS, shortcutKeyLabel } from '@/lib/lightboxShortcuts';
import { en } from '@/lib/i18n/locales/en';
import { de } from '@/lib/i18n/locales/de';

describe('LIGHTBOX_SHORTCUTS', () => {
  it('is not empty', () => {
    expect(LIGHTBOX_SHORTCUTS.length).toBeGreaterThan(0);
  });

  /**
   * The whole point of the shared catalogue: the `?` overlay and the admin
   * help render this list, so a label that does not resolve would leave one of
   * them blank.
   */
  it.each(['en', 'de'])('every label resolves in %s', (locale) => {
    const dictionary = locale === 'en' ? en.lightbox : de.lightbox;
    for (const shortcut of LIGHTBOX_SHORTCUTS) {
      const label = dictionary[shortcut.labelKey];
      expect(typeof label, shortcut.labelKey).toBe('string');
      expect((label as string).length).toBeGreaterThan(0);
    }
  });

  it('gives every shortcut at least one key', () => {
    for (const shortcut of LIGHTBOX_SHORTCUTS) {
      expect(shortcut.keys.length, shortcut.labelKey).toBeGreaterThan(0);
    }
  });

  it('binds no key twice, which would make the list contradict itself', () => {
    const keys = LIGHTBOX_SHORTCUTS.flatMap((shortcut) => shortcut.keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('lists each label once', () => {
    const labels = LIGHTBOX_SHORTCUTS.map((shortcut) => shortcut.labelKey);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('documents the conditional shortcuts, since the reader cannot see them fail', () => {
    for (const shortcut of LIGHTBOX_SHORTCUTS) {
      if (shortcut.availability !== 'always') {
        expect(shortcut.note, shortcut.labelKey).toBeTruthy();
      }
    }
  });
});

describe('shortcutKeyLabel', () => {
  it('renders the arrow names as arrows', () => {
    expect(shortcutKeyLabel('ARROW_LEFT')).toBe(String.fromCharCode(0x2190));
    expect(shortcutKeyLabel('ARROW_RIGHT')).toBe(String.fromCharCode(0x2192));
  });

  it('passes ordinary keys through', () => {
    expect(shortcutKeyLabel('S')).toBe('S');
    expect(shortcutKeyLabel('Esc')).toBe('Esc');
    expect(shortcutKeyLabel('?')).toBe('?');
  });

  it('leaves no placeholder name unrendered', () => {
    for (const shortcut of LIGHTBOX_SHORTCUTS) {
      for (const key of shortcut.keys) {
        expect(shortcutKeyLabel(key)).not.toMatch(/^ARROW_/);
      }
    }
  });
});
