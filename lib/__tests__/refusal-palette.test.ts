import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { THEME_PRESETS } from '../config/theme';

/**
 * The download refusal page cannot load the site's stylesheets, so it carries
 * each preset's surface and text colours itself. This keeps that copy honest:
 * it resolves the same custom properties from app/tokens.css the way the
 * cascade does, and fails when a preset changes a colour the copy still has.
 */

vi.mock('../immich', () => ({ immich: {} }));

import { REFUSAL_PALETTES } from '../zipArchive';

const css = fs
  .readFileSync(path.join(__dirname, '../../app/tokens.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Custom properties declared by the rule with exactly this selector. */
function block(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (m[1].trim() !== selector) continue;
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim();
  }
  return out;
}

/** What `<html data-preset=… data-theme=…>` resolves, in cascade order. */
function resolve(preset: string, mode: 'dark' | 'light') {
  const light = mode === 'light';
  const vars = {
    ...block(':root'),
    ...(light ? block("[data-theme='light']") : {}),
    ...block(`[data-preset='${preset}']`),
    ...(light ? block(`[data-preset='${preset}'][data-theme='light']`) : {}),
  };
  return {
    bg: vars['--bg-primary'],
    text: vars['--text-primary'],
    muted: vars['--text-secondary'],
  };
}

describe('refusal page palette', () => {
  const cases = Object.keys(THEME_PRESETS).flatMap((preset) =>
    (['dark', 'light'] as const).map((mode) => [preset, mode] as const),
  );

  it.each(cases)('%s in %s mode matches app/tokens.css', (preset, mode) => {
    const palette = REFUSAL_PALETTES[preset] ?? REFUSAL_PALETTES.default;
    expect(palette[mode]).toEqual(resolve(preset, mode));
  });

  it('no theme stylesheet redefines the colours the copy is taken from', () => {
    const dir = path.join(__dirname, '../../app/themes');
    for (const file of fs.readdirSync(dir)) {
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      expect(text, file).not.toMatch(/--(bg-primary|text-primary|text-secondary)\s*:/);
    }
  });
});
