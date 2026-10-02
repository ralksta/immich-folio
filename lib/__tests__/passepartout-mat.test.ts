import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { THEME_PRESETS, contrastRatio } from '../config/theme';

/**
 * The passepartout frame prints the EXIF line on the mat, in --mat-text on
 * --mat-bg. Until v0.20.0 the mat never showed — the photo covered it, and the
 * line sat on the photo at 1.3–2.4:1 — so its colours had never been checked.
 *
 * Tokens are resolved the way the cascade does on <html>, where every block
 * of app/tokens.css matches at once: a preset's light block beats everything,
 * then the later of the one-attribute blocks wins — and every preset block
 * comes after the generic light block, so a preset that sets a mat token for
 * dark mode only would carry it into light mode too.
 */
const css = fs.readFileSync(path.join(process.cwd(), 'app', 'tokens.css'), 'utf8');

function block(selector: string): string | undefined {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1];
}

function declared(selector: string, name: string): string | undefined {
  const body = block(selector);
  if (!body) return undefined;
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(body)?.[1].trim();
}

function token(preset: string, mode: 'dark' | 'light', name: string): string | undefined {
  const chain =
    mode === 'dark'
      ? [`[data-preset='${preset}']`, ':root']
      : [
          `[data-preset='${preset}'][data-theme='light']`,
          `[data-preset='${preset}']`,
          "[data-theme='light']",
          ':root',
        ];
  for (const selector of chain) {
    const value = declared(selector, name);
    if (value === undefined) continue;
    const ref = /^var\(--([\w-]+)\)$/.exec(value);
    return ref ? token(preset, mode, ref[1]) : value;
  }
  return undefined;
}

// WCAG AA for text at the caption's size (0.6875–0.75rem).
const TEXT_MIN = 4.5;

describe('passepartout mat tokens', () => {
  it('are defined for both modes', () => {
    expect(declared(':root', 'mat-bg')).toBeDefined();
    expect(declared("[data-theme='light']", 'mat-bg')).toBeDefined();
  });

  it('are no longer hard-coded in the theme files', () => {
    const themes = path.join(process.cwd(), 'app', 'themes');
    const globals = fs.readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8');
    const sources = [
      globals,
      ...fs.readdirSync(themes).map((f) => fs.readFileSync(path.join(themes, f), 'utf8')),
    ];
    for (const source of sources) {
      for (const rule of source.matchAll(/\[data-photo-frame='passepartout'\][^{]*\{([^}]*)\}/g)) {
        expect(rule[1]).not.toMatch(/(background|border|color)[^;]*#[0-9a-f]{3,6}/i);
      }
    }
  });

  for (const preset of Object.keys(THEME_PRESETS)) {
    for (const mode of ['dark', 'light'] as const) {
      it(`${preset} (${mode}): the EXIF line is readable on the mat`, () => {
        const bg = token(preset, mode, 'mat-bg')!;
        const fg = token(preset, mode, 'mat-text')!;
        expect(bg).toMatch(/^#[0-9a-f]{6}$/i);
        expect(fg).toMatch(/^#[0-9a-f]{6}$/i);
        expect(contrastRatio(fg, bg)!).toBeGreaterThanOrEqual(TEXT_MIN);
      });
    }
  }

  it('keeps the light mat light in a preset that tints it', () => {
    // classic sets a warm dark mat; without its own light value that dark
    // mat would win over the generic light one.
    expect(token('classic', 'light', 'mat-bg')).toBe('#fffdf5');
    expect(token('classic', 'dark', 'mat-bg')).toBe('#1a1816');
  });

  it('tones the mat to the wall in the gallery presets', () => {
    // kunsthalle hangs on grey, salon on oxblood and plaster rose; the default
    // black and white boards cut a hole in either wall.
    for (const preset of ['kunsthalle', 'salon']) {
      expect(token(preset, 'dark', 'mat-bg')).not.toBe(token('studio', 'dark', 'mat-bg'));
      expect(token(preset, 'light', 'mat-bg')).not.toBe(token('studio', 'light', 'mat-bg'));
      expect(token(preset, 'dark', 'mat-bg')).not.toBe(token(preset, 'light', 'mat-bg'));
    }
  });
});
