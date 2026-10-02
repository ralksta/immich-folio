import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PRESET_REGISTRY, PRESET_IDS } from '../config/presets';
import {
  THEME_PRESETS,
  DEFAULT_PRESET,
  resolveTheme,
  contrastRatio,
  accentForMode,
} from '../config/theme';
import { parseFamilies, MAX_FAMILIES } from '../fonts';

/**
 * A preset is declared once, in PRESET_REGISTRY. The places that cannot import
 * the registry — the stylesheets, the docs, a plain-node script — are held to
 * it here, so adding a preset fails loudly where a step was missed instead of
 * shipping a preset with no palette or no stylesheet.
 */
const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

const tokensCss = read('app/tokens.css').replace(/\/\*[\s\S]*?\*\//g, '');
const globalsCss = read('app/globals.css');

/** Custom properties declared by the rule with exactly this selector. */
function block(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tokensCss.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (m[1].trim() !== selector) continue;
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim();
  }
  return out;
}

/** The surface and text tokens a preset palette has to define in each mode. */
const PALETTE_TOKENS = [
  '--bg-primary',
  '--bg-secondary',
  '--bg-card',
  '--bg-card-hover',
  '--bg-overlay',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--border-subtle',
  '--border-hover',
];

/**
 * Surfaces the text tokens are held to 4.5:1 on. Light mode includes
 * --bg-card-hover: studio-modern's light --text-muted (#73736e) measured 4.17:1
 * on --bg-secondary and 4.36:1 on --bg-card-hover before it was darkened.
 * Dark mode leaves --bg-card-hover out, where muted text sits at 4.1–4.3:1 in
 * several presets.
 */
const TEXT_SURFACES = {
  dark: ['--bg-primary', '--bg-secondary', '--bg-card'],
  light: ['--bg-primary', '--bg-secondary', '--bg-card', '--bg-card-hover'],
} as const;

/**
 * The first seven presets use their accent for dots, rules and fills, held to
 * 3:1 by preset-contrast.test.ts. Presets added since also set links and
 * labels in it, so their accent has to read as text: 4.5:1 on every surface.
 */
const ACCENT_AS_DECORATION_ONLY = new Set([
  'studio-modern',
  'studio',
  'minimal',
  'editorial',
  'classic',
  'noir',
  'monograph',
]);

describe('preset registry', () => {
  it('has unique ids and contains the default preset', () => {
    expect(new Set(PRESET_IDS).size).toBe(PRESET_IDS.length);
    expect(PRESET_IDS).toContain(DEFAULT_PRESET);
  });

  it('is what THEME_PRESETS and resolveTheme serve', () => {
    expect(Object.keys(THEME_PRESETS)).toEqual([...PRESET_IDS]);
    for (const id of PRESET_IDS) expect(resolveTheme(id).preset).toBe(id);
  });

  it('leaves only studio without its own styles', () => {
    expect(PRESET_REGISTRY.filter((p) => !p.ownStyles).map((p) => p.id)).toEqual(['studio']);
  });

  it('keeps scripts/contrast-audit.mjs in step', () => {
    const list = /const PRESETS = \[([^\]]*)\]/.exec(read('scripts/contrast-audit.mjs'))?.[1];
    expect(list).toBeDefined();
    const ids = [...list!.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(ids).toEqual([...PRESET_IDS]);
  });

  for (const preset of PRESET_REGISTRY) {
    describe(preset.id, () => {
      it('has a label, an install tagline and an admin card description', () => {
        expect(preset.label.trim()).not.toBe('');
        expect(preset.tagline.trim()).not.toBe('');
        expect(preset.description.trim()).not.toBe('');
        for (const c of [preset.card.bg, preset.card.tile, preset.card.accent]) {
          expect(c).toMatch(/^#[0-9a-f]{6}$/i);
        }
      });

      it('names fonts lib/fonts.ts can serve', () => {
        const { heading, body, caption } = preset.theme.fonts;
        const families = parseFamilies([heading, body, caption]);
        expect(families).not.toBeNull();
        expect(families!.length).toBeLessThanOrEqual(MAX_FAMILIES);
      });

      it('is documented', () => {
        expect(read('docs/theming.md')).toContain(`| **${preset.id}**`);
        expect(read('content/settings.yaml.example')).toContain(preset.id);
      });

      if (!preset.ownStyles) return;

      it('has a stylesheet that globals.css imports', () => {
        expect(fs.existsSync(path.join(root, 'app/themes', `${preset.id}.css`))).toBe(true);
        expect(globalsCss).toContain(`@import url('./themes/${preset.id}.css');`);
      });

      it('defines its palette in app/tokens.css for both colour modes', () => {
        const dark = block(`[data-preset='${preset.id}']`);
        const light = block(`[data-preset='${preset.id}'][data-theme='light']`);
        for (const token of PALETTE_TOKENS) {
          expect(dark[token], `${token} (dark)`).toBeDefined();
          expect(light[token], `${token} (light)`).toBeDefined();
        }
      });

      it('keeps its text tokens at 4.5:1 on every surface, in both modes', () => {
        for (const mode of ['dark', 'light'] as const) {
          const vars = {
            ...block(`[data-preset='${preset.id}']`),
            ...(mode === 'light' ? block(`[data-preset='${preset.id}'][data-theme='light']`) : {}),
          };
          for (const text of ['--text-primary', '--text-secondary', '--text-muted']) {
            for (const surface of TEXT_SURFACES[mode]) {
              const ratio = contrastRatio(vars[text], vars[surface]);
              // Palettes written as rgba() are measured by the browser audit
              // (npm run audit:contrast), not here.
              if (ratio === null) continue;
              expect(ratio, `${mode} ${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
            }
          }
        }
      });

      if (ACCENT_AS_DECORATION_ONLY.has(preset.id)) return;

      it('keeps its accent readable as text on every surface, in both modes', () => {
        for (const mode of ['dark', 'light'] as const) {
          const vars = {
            ...block(`[data-preset='${preset.id}']`),
            ...(mode === 'light' ? block(`[data-preset='${preset.id}'][data-theme='light']`) : {}),
          };
          const accent = accentForMode(resolveTheme(preset.id), mode);
          for (const surface of ['--bg-primary', '--bg-secondary', '--bg-card']) {
            const ratio = contrastRatio(accent, vars[surface]);
            expect(ratio, `${mode} accent on ${surface}`).toBeGreaterThanOrEqual(4.5);
          }
        }
      });
    });
  }
});
