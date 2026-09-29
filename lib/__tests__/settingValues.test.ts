import { describe, it, expect } from 'vitest';
import { validateSettingValues } from '../config/settingValues';
import { resolveTheme } from '../config/theme';
import { normaliseSiteUrl } from '../siteUrl';

const fields = (input: unknown) => validateSettingValues(input).map((e) => e.field);

/**
 * The save route and the doctor refuse exactly what the site would ignore, no
 * more (QA A-14). Each case is paired with the resolver it mirrors, so the two
 * cannot drift apart unnoticed.
 */
describe('validateSettingValues', () => {
  it('passes an empty or partial file', () => {
    expect(fields({})).toEqual([]);
    expect(fields({ title: 'Folio' })).toEqual([]);
    expect(fields(null)).toEqual([]);
  });

  it('refuses an accent resolveTheme would replace, and only that', () => {
    for (const accent of ['rot', 'red', 'rgb(230 0 18)', '#12345']) {
      expect(fields({ theme: { accent } })).toEqual(['theme.accent']);
      expect(resolveTheme({ preset: 'minimal', accent }).accent).toBe(
        resolveTheme('minimal').accent,
      );
    }
    for (const accent of ['#e60012', '#FFF', ' #e60012 ', '#e60012cc', '']) {
      expect(fields({ theme: { accent } })).toEqual([]);
    }
    // A preset name alone carries no accent.
    expect(fields({ theme: 'minimal' })).toEqual([]);
  });

  it('refuses a site URL normaliseSiteUrl cannot use', () => {
    for (const url of ['folio.example', 'ftp://folio.example', 'javascript:alert(1)']) {
      expect(fields({ url })).toEqual(['url']);
      expect(normaliseSiteUrl(url)).toBeNull();
    }
    for (const url of ['https://folio.example', 'http://folio.example/sub/', '', '  ']) {
      expect(fields({ url })).toEqual([]);
    }
  });

  it('refuses grid values outside the bounds getConfig clamps to', () => {
    expect(fields({ grid: { columns: 9 } })).toEqual(['grid.columns']);
    expect(fields({ grid: { columns: 0 } })).toEqual(['grid.columns']);
    expect(fields({ grid: { columns: 2.5 } })).toEqual(['grid.columns']);
    expect(fields({ grid: { gap: 49 } })).toEqual(['grid.gap']);
    expect(fields({ grid: { gap: -1 } })).toEqual(['grid.gap']);
    expect(fields({ grid: { columns: 1, gap: 0 } })).toEqual([]);
    expect(fields({ grid: { columns: 6, gap: 48 } })).toEqual([]);
  });
});
