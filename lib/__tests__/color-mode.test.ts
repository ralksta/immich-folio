import { describe, it, expect } from 'vitest';
import { resolveColorMode, COLOR_MODES } from '../config/schema';

/**
 * `mode:` decides what a first-time visitor lands on. The toggle used to
 * hardcode dark, so an operator who preferred light had no way to give their
 * visitors anything else (#512).
 */
describe('resolveColorMode', () => {
  it('defaults to dark, as the site always has', () => {
    expect(resolveColorMode(undefined)).toBe('dark');
  });

  it('accepts each supported mode', () => {
    for (const mode of COLOR_MODES) {
      expect(resolveColorMode(mode)).toBe(mode);
    }
  });

  /** A typo must not silently produce an invalid data-theme on <html>. */
  it('falls back to dark on anything else', () => {
    expect(resolveColorMode('Light')).toBe('dark');
    expect(resolveColorMode('system')).toBe('dark');
    expect(resolveColorMode('')).toBe('dark');
  });
});
