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

import {
  slugify,
  albumSlug,
  normalizeSlug,
  buildSubpageGrid,
  sanitizeNavLinks,
} from '@/lib/config';

// EXPERIMENTAL: external navigation links — rendered as <a href> in the
// header, so only http(s) URLs may survive sanitisation.
describe('sanitizeNavLinks', () => {
  it('keeps well-formed http(s) links', () => {
    expect(
      sanitizeNavLinks([
        { label: 'Shop', url: 'https://shop.example.com' },
        { label: 'Blog', url: 'http://blog.example.com/a?b=c' },
      ]),
    ).toEqual([
      { label: 'Shop', url: 'https://shop.example.com' },
      { label: 'Blog', url: 'http://blog.example.com/a?b=c' },
    ]);
  });

  it('drops non-http schemes and entries without label or url', () => {
    expect(
      sanitizeNavLinks([
        { label: 'Bad', url: 'javascript:alert(1)' },
        { label: 'AlsoBad', url: 'data:text/html,x' },
        { label: '', url: 'https://x.example' },
        { label: 'NoUrl', url: '' },
      ]),
    ).toEqual([]);
  });

  it('returns empty for undefined input', () => {
    expect(sanitizeNavLinks(undefined)).toEqual([]);
  });
});

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

  // #522: stripping every non-ASCII character left CJK names with an empty
  // slug, so their links pointed at "/" and clicking an album did nothing.
  it('preserves CJK characters', () => {
    expect(slugify('家族相册')).toBe('家族相册');
    expect(slugify('写真')).toBe('写真');
    expect(slugify('旅行 2024')).toBe('旅行-2024');
  });

  it('preserves Hangul in composed (NFC) form', () => {
    const slug = slugify('가족 앨범');
    expect(slug).toBe('가족-앨범');
    expect(slug).toBe(slug.normalize('NFC'));
  });

  it('preserves other non-Latin scripts', () => {
    expect(slugify('Москва 2024')).toBe('москва-2024');
  });

  it('still returns empty when nothing letter-like remains', () => {
    expect(slugify('🎉🎉')).toBe('');
  });
});

describe('albumSlug', () => {
  it('uses the slugified name when it yields something', () => {
    expect(albumSlug('Kloster Chorin', 'abc-123')).toBe('kloster-chorin');
    expect(albumSlug('家族相册', 'abc-123')).toBe('家族相册');
  });

  // Without a fallback two emoji-only albums would both slugify to '' and
  // collide on the same (unreachable) URL.
  it('falls back to the album id when the name slugifies to nothing', () => {
    expect(albumSlug('🎉', 'abc-123')).toBe('abc-123');
    expect(albumSlug('', 'abc-123')).toBe('abc-123');
  });
});

describe('normalizeSlug', () => {
  // Next hands catch-all route segments over percent-encoded, so this is the
  // half of #522 that fixing slugify() alone did not cure.
  it('percent-decodes an encoded slug', () => {
    expect(normalizeSlug('%E5%AE%B6%E6%97%8F%E7%9B%B8%E5%86%8C')).toBe('家族相册');
  });

  it('leaves an already decoded slug alone', () => {
    expect(normalizeSlug('家族相册')).toBe('家族相册');
    expect(normalizeSlug('kloster-chorin')).toBe('kloster-chorin');
  });

  it('composes decomposed (NFD) input', () => {
    expect(normalizeSlug('가족-앨범'.normalize('NFD'))).toBe('가족-앨범');
  });

  it('survives a malformed percent sequence instead of throwing', () => {
    expect(() => normalizeSlug('%E5%AE')).not.toThrow();
    expect(normalizeSlug('100%-real')).toBe('100%-real');
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

  it('preserves the experimental justified layout', () => {
    expect(buildSubpageGrid({ layout: 'justified' })).toEqual({
      grid: { layout: 'justified' },
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
