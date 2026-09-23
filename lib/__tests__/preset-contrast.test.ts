import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  THEME_PRESETS,
  resolveTheme,
  accentForMode,
  onAccent,
  contrastRatio,
} from '../config/theme';

/**
 * Every preset's accent must stay visible on its own page background in both
 * colour modes, and text on an accent-filled button must stay readable. Minimal
 * shipped a black accent on its black dark mode: the password gate's button and
 * the error page's "Try again" were invisible.
 *
 * The backgrounds are read from app/tokens.css, so a palette change that breaks
 * an accent fails here too.
 */
const css = fs.readFileSync(path.join(process.cwd(), 'app', 'tokens.css'), 'utf8');

function bgPrimary(selector: string): string | undefined {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1];
  return block ? /--bg-primary:\s*(#[0-9a-fA-F]{3,6})/.exec(block)?.[1] : undefined;
}

const defaults = { dark: bgPrimary(':root')!, light: bgPrimary("[data-theme='light']")! };

function background(preset: string, mode: 'dark' | 'light'): string {
  const own =
    mode === 'dark'
      ? bgPrimary(`[data-preset='${preset}']`)
      : bgPrimary(`[data-preset='${preset}'][data-theme='light']`);
  return own ?? defaults[mode];
}

// 3:1 is WCAG's floor for UI components and large text (non-text contrast,
// 1.4.11); the accent draws dots, rules, active states and button fills.
const ACCENT_MIN = 3;
const BUTTON_TEXT_MIN = 4.5;

describe('preset accent contrast', () => {
  it('finds a background for every preset and mode', () => {
    expect(defaults.dark).toBeDefined();
    expect(defaults.light).toBeDefined();
  });

  for (const name of Object.keys(THEME_PRESETS)) {
    for (const mode of ['dark', 'light'] as const) {
      it(`${name} (${mode}): accent is visible on the page`, () => {
        const accent = accentForMode(resolveTheme(name), mode);
        const ratio = contrastRatio(accent, background(name, mode))!;
        expect(ratio).toBeGreaterThanOrEqual(ACCENT_MIN);
      });

      it(`${name} (${mode}): button text is readable on the accent`, () => {
        const accent = accentForMode(resolveTheme(name), mode);
        expect(contrastRatio(onAccent(accent), accent)!).toBeGreaterThanOrEqual(BUTTON_TEXT_MIN);
      });
    }
  }
});

describe('per-mode accents', () => {
  it('apply while the owner keeps the preset accent', () => {
    const theme = resolveTheme({ preset: 'minimal', accent: '#000000' });
    expect(accentForMode(theme, 'dark')).toBe('#ffffff');
    expect(accentForMode(theme, 'light')).toBe('#000000');
  });

  it('give way to an accent of the owner’s own, in both modes', () => {
    const theme = resolveTheme({ preset: 'minimal', accent: '#0055ff' });
    expect(accentForMode(theme, 'dark')).toBe('#0055ff');
    expect(accentForMode(theme, 'light')).toBe('#0055ff');
  });

  it('fall back to the single accent where a preset has none', () => {
    const theme = resolveTheme('studio-modern');
    expect(accentForMode(theme, 'dark')).toBe(theme.accent);
    expect(accentForMode(theme, 'light')).toBe(theme.accent);
  });
});

describe('onAccent', () => {
  it('picks the stronger of black and white', () => {
    expect(onAccent('#000000')).toBe('#ffffff');
    expect(onAccent('#ffffff')).toBe('#000000');
    expect(onAccent('#c49a3c')).toBe('#000000');
    expect(onAccent('#e60012')).toBe('#ffffff');
  });

  it('keeps white for a colour it cannot parse', () => {
    expect(onAccent('rebeccapurple')).toBe('#ffffff');
  });
});
