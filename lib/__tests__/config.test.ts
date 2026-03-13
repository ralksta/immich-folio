import { describe, it, expect, vi } from 'vitest';

// Mock env.ts so importing config.ts doesn't trigger Zod validation
vi.mock('@/lib/env', () => ({
  env: {
    IMMICH_API_URL: 'http://localhost:2283',
    IMMICH_API_KEY: 'test-key',
    SITE_TITLE: 'Test Gallery',
    SITE_SUBTITLE: '',
    CACHE_TTL: 300,
    RATE_LIMIT_RPM: 120,
  },
}));

import { slugify, buildSubpageGrid } from '@/lib/config';

describe('slugify', () => {
  it('converts a simple name to lowercase with hyphens', () => {
    expect(slugify('Kloster Chorin')).toBe('kloster-chorin');
  });

  it('strips diacritics', () => {
    expect(slugify('Schöne Aussicht')).toBe('schone-aussicht');
    expect(slugify('Café Müller')).toBe('cafe-muller');
  });

  it('replaces special characters with hyphens', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
    expect(slugify('foo & bar (baz)')).toBe('foo-bar-baz');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('--leading')).toBe('leading');
    expect(slugify('trailing---')).toBe('trailing');
    expect(slugify('---both---')).toBe('both');
  });

  it('collapses consecutive hyphens', () => {
    expect(slugify('a   b   c')).toBe('a-b-c');
  });

  it('handles an empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles all-special-character input', () => {
    expect(slugify('!@#$%')).toBe('');
  });

  it('preserves numbers', () => {
    expect(slugify('Album 2024')).toBe('album-2024');
  });
});

describe('buildSubpageGrid', () => {
  it('returns empty object when called without arguments', () => {
    expect(buildSubpageGrid()).toEqual({});
  });

  it('returns empty object when called with undefined', () => {
    expect(buildSubpageGrid(undefined)).toEqual({});
  });

  it('maps columns and gap correctly', () => {
    expect(buildSubpageGrid({ columns: 4, gap: 8 })).toEqual({
      grid: { columns: 4, gap: 8 },
    });
  });

  it('maps aspectRatio correctly', () => {
    expect(buildSubpageGrid({ aspectRatio: '16/9' })).toEqual({
      grid: { aspectRatio: '16/9' },
    });
  });

  it('preserves a valid layout value', () => {
    expect(buildSubpageGrid({ layout: 'uniform' })).toEqual({
      grid: { layout: 'uniform' },
    });
  });

  it('falls back to masonry for an unknown layout', () => {
    expect(buildSubpageGrid({ layout: 'unknown-layout' })).toEqual({
      grid: { layout: 'masonry' },
    });
  });

  it('omits fields that are not supplied', () => {
    const result = buildSubpageGrid({ columns: 2 });
    expect(result).toEqual({ grid: { columns: 2 } });
    expect((result as { grid: object }).grid).not.toHaveProperty('gap');
    expect((result as { grid: object }).grid).not.toHaveProperty('layout');
  });

  it('handles all fields together', () => {
    expect(buildSubpageGrid({ columns: 3, gap: 16, aspectRatio: '1', layout: 'masonry' })).toEqual({
      grid: { columns: 3, gap: 16, aspectRatio: '1', layout: 'masonry' },
    });
  });
});
