import { describe, it, expect } from 'vitest';
import {
  resolveTheme,
  accentForMode,
  onAccent,
  THEME_PRESETS,
  DEFAULT_PRESET,
} from '@/lib/config/theme';

/**
 * `radius` reaches CSS as `${radius}px` and `${radius * 1.5}px` (app/layout.tsx),
 * so a value that is not actually a number does not fail loudly — it becomes
 * `8pxpx` and `NaNpx` (#633). Hand-edited YAML can hand resolveTheme anything;
 * only the panel-save boundary (settingsSchema.ts) already caught the type
 * half of this, and only for a save from the panel.
 */
describe('resolveTheme scalar coercion (#633)', () => {
  const base = THEME_PRESETS[DEFAULT_PRESET];

  it('falls back to the preset radius when the value is a string', () => {
    // as unknown as number: simulating hand-edited YAML, which yaml.load()
    // hands back with no runtime guarantee it matches SettingsYaml's types.
    const theme = resolveTheme({ radius: '8px' as unknown as number });
    expect(theme.radius).toBe(base.radius);
    expect(Number.isFinite(theme.radius)).toBe(true);
  });

  it('falls back to the preset radius when the value is NaN', () => {
    expect(resolveTheme({ radius: NaN }).radius).toBe(base.radius);
  });

  it('clamps an out-of-range radius rather than passing it through', () => {
    expect(resolveTheme({ radius: 999 }).radius).toBeLessThanOrEqual(64);
    expect(resolveTheme({ radius: -5 }).radius).toBe(0);
  });

  it('keeps a legitimate radius override', () => {
    expect(resolveTheme({ radius: 24 }).radius).toBe(24);
  });

  it('falls back to the preset accent when the value is not a string', () => {
    const theme = resolveTheme({ accent: 42 as unknown as string });
    expect(theme.accent).toBe(base.accent);
  });

  it('falls back to the preset accent for an empty string', () => {
    expect(resolveTheme({ accent: '' }).accent).toBe(base.accent);
  });

  it('keeps a legitimate accent override', () => {
    expect(resolveTheme({ accent: '#123456' }).accent).toBe('#123456');
  });

  it('normalises a 3-digit accent to the #rrggbb every consumer survives', () => {
    expect(resolveTheme({ accent: '#f00' }).accent).toBe('#ff0000');
    expect(resolveTheme({ accent: '#FFF' }).accent).toBe('#ffffff');
  });

  it('normalises an 8-digit accent by dropping the alpha', () => {
    expect(resolveTheme({ accent: '#e6001280' }).accent).toBe('#e60012');
  });

  it('trims surrounding whitespace from an accent', () => {
    expect(resolveTheme({ accent: '  #e60012  ' }).accent).toBe('#e60012');
  });

  it('falls back to the preset accent for a hex literal without the #', () => {
    // The nastiest input: defined, so var() substitutes it and any accent-
    // backed background becomes transparent instead of taking its fallback.
    expect(resolveTheme({ accent: 'e60012' }).accent).toBe(base.accent);
  });

  it('falls back to the preset accent for a 5-digit hex', () => {
    expect(resolveTheme({ accent: '#12345' }).accent).toBe(base.accent);
  });

  it('falls back to the preset accent for named and functional colours', () => {
    // They would render, but onAccent() reads only hex and would answer white.
    expect(resolveTheme({ accent: 'red' }).accent).toBe(base.accent);
    expect(resolveTheme({ accent: 'rgb(230 0 18)' }).accent).toBe(base.accent);
  });

  it('gives a white accent dark button text, the proofing ZIP button included', () => {
    // #ffffff on the light theme rendered Download selected white-on-white.
    const theme = resolveTheme({ accent: '#FFF' });
    expect(onAccent(accentForMode(theme, 'light'))).toBe('#000000');
  });

  it('falls back to the preset grain/headerDot when not a boolean', () => {
    const theme = resolveTheme({
      grain: 'yes' as unknown as boolean,
      headerDot: 1 as unknown as boolean,
    });
    expect(theme.grain).toBe(base.grain);
    expect(theme.headerDot).toBe(base.headerDot);
  });

  it('keeps legitimate grain/headerDot overrides', () => {
    const theme = resolveTheme({ grain: !base.grain, headerDot: !base.headerDot });
    expect(theme.grain).toBe(!base.grain);
    expect(theme.headerDot).toBe(!base.headerDot);
  });
});
