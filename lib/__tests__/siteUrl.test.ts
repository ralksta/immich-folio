import { describe, it, expect } from 'vitest';
import { normaliseSiteUrl, resolveSiteUrl, absoluteUrl } from '@/lib/siteUrl';

describe('normaliseSiteUrl', () => {
  it('keeps a plain https origin', () => {
    expect(normaliseSiteUrl('https://folio.example')).toBe('https://folio.example');
  });

  it('drops the trailing slash so callers can join with /', () => {
    expect(normaliseSiteUrl('https://folio.example/')).toBe('https://folio.example');
    expect(normaliseSiteUrl('https://folio.example/gallery//')).toBe(
      'https://folio.example/gallery',
    );
  });

  it('keeps a sub-path, since a portfolio may live under one', () => {
    expect(normaliseSiteUrl('https://example.com/folio')).toBe('https://example.com/folio');
  });

  it('drops query and fragment', () => {
    expect(normaliseSiteUrl('https://folio.example/?utm=1#top')).toBe('https://folio.example');
  });

  it('trims surrounding whitespace', () => {
    expect(normaliseSiteUrl('  https://folio.example  ')).toBe('https://folio.example');
  });

  it('allows http, for a LAN instance behind no TLS', () => {
    expect(normaliseSiteUrl('http://192.168.1.10:7211')).toBe('http://192.168.1.10:7211');
  });

  /**
   * A wrong absolute URL is worse than none: it would be emitted into the
   * sitemap, the feed and the JSON-LD block.
   */
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty', ''],
    ['whitespace', '   '],
    ['a bare host', 'folio.example'],
    ['a path only', '/gallery'],
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html,x'],
    ['ftp', 'ftp://folio.example'],
    ['nonsense', 'not a url'],
  ])('rejects %s', (_label, raw) => {
    expect(normaliseSiteUrl(raw)).toBeNull();
  });
});

describe('resolveSiteUrl', () => {
  /**
   * settings.yaml wins, matching how `settings.title ?? env.SITE_TITLE`
   * already resolves. The admin field must never save and do nothing.
   */
  it('prefers settings.yaml over the environment', () => {
    expect(resolveSiteUrl('https://from-yaml.example', 'https://from-env.example')).toEqual({
      url: 'https://from-yaml.example',
      source: 'settings',
    });
  });

  it('falls back to the environment when the file says nothing', () => {
    expect(resolveSiteUrl(undefined, 'https://from-env.example')).toEqual({
      url: 'https://from-env.example',
      source: 'env',
    });
  });

  /** An unusable value in the file must not shadow a good one in the env. */
  it('ignores an invalid settings value and uses the environment', () => {
    expect(resolveSiteUrl('not a url', 'https://from-env.example')).toEqual({
      url: 'https://from-env.example',
      source: 'env',
    });
  });

  it('reports none when neither is set', () => {
    expect(resolveSiteUrl(undefined, undefined)).toEqual({ url: null, source: 'none' });
  });
});

describe('absoluteUrl', () => {
  it('joins a path', () => {
    expect(absoluteUrl('https://folio.example', '/travel')).toBe('https://folio.example/travel');
  });

  it('adds the missing leading slash', () => {
    expect(absoluteUrl('https://folio.example', 'travel')).toBe('https://folio.example/travel');
  });

  it('never emits a double slash', () => {
    expect(absoluteUrl('https://folio.example', '/travel/')).toBe('https://folio.example/travel');
  });

  it('keeps the root as a single slash', () => {
    expect(absoluteUrl('https://folio.example', '/')).toBe('https://folio.example/');
  });

  it('works under a sub-path', () => {
    expect(absoluteUrl('https://example.com/folio', '/travel')).toBe(
      'https://example.com/folio/travel',
    );
  });

  /** A relative sitemap entry is invalid and a relative feed link points at the reader. */
  it('returns null without a site URL', () => {
    expect(absoluteUrl(null, '/travel')).toBeNull();
  });
});

/**
 * A sitemap, a canonical link and a JSON-LD block all want a URI, not an IRI.
 * Non-Latin album slugs only became possible with #522, so this surfaced with
 * them.
 */
describe('absoluteUrl encoding', () => {
  it('percent-encodes a non-ASCII path', () => {
    expect(absoluteUrl('https://example.com', '/家族相册')).toBe(
      'https://example.com/%E5%AE%B6%E6%97%8F%E7%9B%B8%E5%86%8C',
    );
  });

  it('leaves an ASCII path exactly as it was', () => {
    expect(absoluteUrl('https://example.com', '/kloster-chorin')).toBe(
      'https://example.com/kloster-chorin',
    );
  });

  it('keeps a query string intact', () => {
    expect(absoluteUrl('https://example.com', '/api/image/abc?size=preview')).toBe(
      'https://example.com/api/image/abc?size=preview',
    );
  });

  // A portfolio may live under a sub-path, which normaliseSiteUrl keeps.
  it('preserves a sub-path in the site URL', () => {
    expect(absoluteUrl('https://example.com/folio', '/家族相册')).toBe(
      'https://example.com/folio/%E5%AE%B6%E6%97%8F%E7%9B%B8%E5%86%8C',
    );
  });

  // Encoding blindly would turn a '%' into '%25' and corrupt the URL.
  it('does not encode an already-encoded path a second time', () => {
    expect(absoluteUrl('https://example.com', '/%E5%AE%B6%E6%97%8F%E7%9B%B8%E5%86%8C')).toBe(
      'https://example.com/%E5%AE%B6%E6%97%8F%E7%9B%B8%E5%86%8C',
    );
  });
});
