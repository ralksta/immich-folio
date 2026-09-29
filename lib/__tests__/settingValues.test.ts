import { describe, it, expect, vi } from 'vitest';
import { validateSettingValues } from '../config/settingValues';
import { resolveTheme } from '../config/theme';
import { resolveContact, sanitizeNavLinks } from '../config';
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

  it('refuses a corner radius resolveTheme would clamp, and only that', () => {
    for (const radius of [-1, 65, 200, Number.NaN]) {
      expect(fields({ theme: { radius } })).toEqual(['theme.radius']);
      expect(resolveTheme({ preset: 'minimal', radius }).radius).not.toBe(radius);
    }
    for (const radius of [0, 8, 1.5, 64]) {
      expect(fields({ theme: { radius } })).toEqual([]);
      expect(resolveTheme({ preset: 'minimal', radius }).radius).toBe(radius);
    }
  });

  it('refuses a retention resolveContact would round or clamp, and only that', () => {
    for (const retentionDays of [0, -3, 366, 30.5]) {
      expect(fields({ contact: { retentionDays } })).toEqual(['contact.retentionDays']);
      expect(resolveContact({ retentionDays }).retentionDays).not.toBe(retentionDays);
    }
    for (const retentionDays of [1, 90, 365]) {
      expect(fields({ contact: { retentionDays } })).toEqual([]);
      expect(resolveContact({ retentionDays }).retentionDays).toBe(retentionDays);
    }
    expect(fields({ contact: { enabled: true } })).toEqual([]);
  });

  it('refuses exactly the header links sanitizeNavLinks drops, per input', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const links = [
      { label: 'Shop', url: 'https://shop.example' },
      { label: 'Blog', url: 'blog.example' },
      { label: '  ', url: 'http://ok.example' },
      { label: 'Evil', url: 'javascript:alert(1)' },
      { label: '', url: '' },
    ];
    expect(fields({ navLinks: links })).toEqual([
      'navLinks.1.url',
      'navLinks.2.label',
      'navLinks.3.url',
      'navLinks.4.label',
      'navLinks.4.url',
    ]);
    // The resolver keeps exactly the entries with no error.
    expect(sanitizeNavLinks(links)).toEqual([{ label: 'Shop', url: 'https://shop.example' }]);
    warn.mockRestore();
  });
});
