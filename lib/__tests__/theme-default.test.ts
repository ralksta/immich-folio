import { describe, it, expect } from 'vitest';
import { resolveTheme, DEFAULT_PRESET, THEME_PRESETS } from '@/lib/config/theme';

/**
 * The preset a site gets when it never picked one. Three separate code paths
 * fall back to it — no settings.yaml at all, a settings.yaml with no `theme`
 * key, and a `theme` object that overrides properties without naming a preset
 * — and each used to carry its own hard-coded literal. These lock the three to
 * one constant so a future change cannot move some of them and leave the rest.
 */
describe('default theme preset', () => {
  it('names a preset that exists', () => {
    expect(THEME_PRESETS[DEFAULT_PRESET]).toBeDefined();
    expect(THEME_PRESETS[DEFAULT_PRESET].preset).toBe(DEFAULT_PRESET);
  });

  it('applies when no theme is configured at all', () => {
    expect(resolveTheme(undefined).preset).toBe(DEFAULT_PRESET);
  });

  it('applies when a theme object omits the preset', () => {
    // Overriding a property must not silently switch the base preset.
    const theme = resolveTheme({ accent: '#123456' });
    expect(theme.preset).toBe(DEFAULT_PRESET);
    expect(theme.accent).toBe('#123456');
    expect(theme.fonts.heading).toBe(THEME_PRESETS[DEFAULT_PRESET].fonts.heading);
  });

  it('is still overridable by an explicit preset', () => {
    expect(resolveTheme('noir').preset).toBe('noir');
    expect(resolveTheme({ preset: 'studio' }).preset).toBe('studio');
  });

  it('keeps every documented preset resolvable', () => {
    for (const name of [
      'studio-modern',
      'studio',
      'minimal',
      'editorial',
      'classic',
      'noir',
      'monograph',
    ]) {
      expect(resolveTheme(name).preset).toBe(name);
    }
  });
});
