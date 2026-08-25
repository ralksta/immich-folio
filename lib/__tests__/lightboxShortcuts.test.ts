import { describe, it, expect } from 'vitest';
import {
  LIGHTBOX_SHORTCUTS,
  lightboxActionFor,
  shortcutDisplayKeys,
  shortcutKeyLabel,
} from '@/lib/lightboxShortcuts';
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
      expect(shortcut.bindings.length, shortcut.labelKey).toBeGreaterThan(0);
      for (const binding of shortcut.bindings) {
        expect(binding.eventKeys.length, binding.display).toBeGreaterThan(0);
      }
    }
  });

  it('binds no key twice, which would make the list contradict itself', () => {
    const keys = LIGHTBOX_SHORTCUTS.flatMap((shortcut) =>
      shortcut.bindings.map((binding) => binding.display),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  /**
   * Two rows claiming the same physical key would make the viewer's behaviour
   * depend on the order of this list, and the help would describe one of them
   * wrongly.
   */
  it('binds no KeyboardEvent.key to two actions', () => {
    const eventKeys = LIGHTBOX_SHORTCUTS.flatMap((shortcut) =>
      shortcut.bindings.flatMap((binding) => [...binding.eventKeys]),
    );
    expect(new Set(eventKeys).size).toBe(eventKeys.length);
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

/**
 * The catalogue is the only route from a keypress to an action (#473), so
 * these cover the join the viewer relies on.
 */
describe('lightboxActionFor', () => {
  it('resolves every declared key to its action', () => {
    for (const shortcut of LIGHTBOX_SHORTCUTS) {
      for (const binding of shortcut.bindings) {
        for (const key of binding.eventKeys) {
          expect(lightboxActionFor(key), key).toBe(binding.action);
        }
      }
    }
  });

  it('resolves the keys a visitor actually presses', () => {
    expect(lightboxActionFor('ArrowLeft')).toBe('prev');
    expect(lightboxActionFor('ArrowRight')).toBe('next');
    expect(lightboxActionFor('Escape')).toBe('close');
    expect(lightboxActionFor('?')).toBe('shortcutList');
    expect(lightboxActionFor('h')).toBe('shortcutList');
    expect(lightboxActionFor('H')).toBe('shortcutList');
  });

  it('takes both cases of every letter key, since Shift must not matter', () => {
    for (const [lower, upper] of [
      ['i', 'I'],
      ['f', 'F'],
      ['s', 'S'],
      ['c', 'C'],
      ['d', 'D'],
    ]) {
      expect(lightboxActionFor(lower), lower).not.toBeNull();
      expect(lightboxActionFor(upper), upper).toBe(lightboxActionFor(lower));
    }
  });

  it('returns null for a key the viewer does not bind', () => {
    for (const key of ['a', 'Enter', 'Tab', ' ', 'ArrowUp', 'F5']) {
      expect(lightboxActionFor(key), key).toBeNull();
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
      for (const key of shortcutDisplayKeys(shortcut)) {
        expect(key).not.toMatch(/^ARROW_/);
      }
    }
  });
});
