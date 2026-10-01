import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  THEME_PRESETS,
  resolveTheme,
  accentForMode,
  accentText,
  contrastRatio,
} from '../config/theme';

/**
 * Accent-coloured text (`--accent-text`), input borders and the draft badge
 * are checked against every hex surface token of each preset and mode, read
 * from app/tokens.css — the studio-modern red measured 3.66:1 as text on its
 * own dark page, and the input hairlines 1.15–1.29:1.
 */
const root = process.cwd();
const tokens = fs.readFileSync(path.join(root, 'app', 'tokens.css'), 'utf8');

function block(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(tokens)?.[1] ?? '';
}

function tokenIn(css: string, name: string): string | undefined {
  return new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,6})\\b`).exec(css)?.[1];
}

type Mode = 'dark' | 'light';
const SURFACES = ['--bg-primary', '--bg-secondary', '--bg-card', '--bg-card-hover'];

/** A preset's own value for a token, falling back to the mode's defaults. */
function token(preset: string, mode: Mode, name: string): string {
  const own =
    mode === 'dark'
      ? tokenIn(block(`[data-preset='${preset}']`), name)
      : tokenIn(block(`[data-preset='${preset}'][data-theme='light']`), name);
  const fallback = tokenIn(block(mode === 'dark' ? ':root' : "[data-theme='light']"), name);
  const value = own ?? fallback;
  if (!value) throw new Error(`${name} missing for ${preset}/${mode}`);
  return value;
}

const MODES: Mode[] = ['dark', 'light'];

describe('accentText', () => {
  for (const name of Object.keys(THEME_PRESETS)) {
    for (const mode of MODES) {
      it(`${name} (${mode}): accent text reaches 4.5:1 on every surface`, () => {
        const text = accentText(accentForMode(resolveTheme(name), mode), mode);
        for (const surface of SURFACES) {
          expect(contrastRatio(text, token(name, mode, surface))!).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  }

  it('lifts the studio-modern red on dark and darkens it on light', () => {
    // #e60012 is 3.66:1 on #121212 — the reported failure.
    expect(contrastRatio('#e60012', '#121212')!).toBeLessThan(4.5);
    const dark = accentText('#e60012', 'dark');
    const light = accentText('#e60012', 'light');
    expect(dark).not.toBe('#e60012');
    expect(light).not.toBe('#e60012');
    expect(contrastRatio(dark, '#121212')!).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(light, '#fafaf8')!).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps an accent that already passes', () => {
    expect(accentText('#ffffff', 'dark')).toBe('#ffffff');
    expect(accentText('#000000', 'light')).toBe('#000000');
    expect(accentText('#c8c8c8', 'dark')).toBe('#c8c8c8');
  });

  it('reaches AA for any owner accent, including ones near the page colour', () => {
    const samples = ['#000000', '#0a1f44', '#1d4ed8', '#ffea00', '#ffffff', '#808080', '#6366f1'];
    for (const accent of samples) {
      expect(contrastRatio(accentText(accent, 'dark'), '#262626')!).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(accentText(accent, 'light'), '#e8e8e3')!).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('widens short hex and passes non-hex through', () => {
    expect(accentText('#fff', 'dark')).toBe('#ffffff');
    expect(accentText('red', 'dark')).toBe('red');
  });

  it('matches the fallbacks written into tokens.css', () => {
    expect(tokens).toContain(
      `--accent-text: var(--accent-text-dark, ${accentText('#e60012', 'dark')})`,
    );
    expect(tokens).toContain(
      `--accent-text: var(--accent-text-light, ${accentText('#c8000f', 'light')})`,
    );
  });
});

describe('public styles use the text token for accent-coloured text', () => {
  const files = [
    'app/globals.css',
    'app/leaflet.css',
    'app/journal/journal.css',
    'app/contact/contact.css',
    ...fs.readdirSync(path.join(root, 'app', 'themes')).map((f) => `app/themes/${f}`),
    ...fs
      .readdirSync(path.join(root, 'components'))
      .filter((f) => f.endsWith('.module.css'))
      .map((f) => `components/${f}`),
  ];

  for (const file of files) {
    it(`${file} has no text coloured with the raw accent`, () => {
      const css = fs.readFileSync(path.join(root, file), 'utf8');
      expect(css).not.toMatch(/(^|[^-])color:\s*var\(--(sm-)?accent[,)]/m);
    });
  }
});

describe('mode tokens', () => {
  it('declares a color-scheme per mode', () => {
    expect(block(':root')).toMatch(/color-scheme:\s*dark/);
    expect(block("[data-theme='light']")).toMatch(/color-scheme:\s*light/);
  });

  it('input borders reach 3:1 on the page surfaces (WCAG 1.4.11)', () => {
    expect(block(':root')).toMatch(/--input-border:\s*var\(--text-muted\)/);
    for (const name of Object.keys(THEME_PRESETS)) {
      for (const mode of MODES) {
        const border = token(name, mode, '--text-muted');
        for (const surface of ['--bg-primary', '--bg-secondary']) {
          expect(contrastRatio(border, token(name, mode, surface))!).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it('the warning colour reads at 4.5:1 on every surface', () => {
    for (const name of Object.keys(THEME_PRESETS)) {
      for (const mode of MODES) {
        const warning = token(name, mode, '--warning');
        for (const surface of SURFACES) {
          expect(contrastRatio(warning, token(name, mode, surface))!).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});
