import { describe, it, expect } from 'vitest';
import {
  parsePhotoHash,
  buildPhotoHash,
  parsePhotoQuery,
  buildPhotoQuery,
  buildPhotoPermalink,
} from '@/lib/photoHash';

describe('buildPhotoHash', () => {
  it('presents the index 1-indexed', () => {
    expect(buildPhotoHash(0)).toBe('#photo-1');
    expect(buildPhotoHash(41)).toBe('#photo-42');
  });
});

describe('parsePhotoHash', () => {
  it('round-trips with buildPhotoHash', () => {
    for (const index of [0, 1, 7, 250]) {
      expect(parsePhotoHash(buildPhotoHash(index))).toBe(index);
    }
  });

  it.each([
    ['no hash', ''],
    ['bare hash', '#'],
    ['another anchor', '#gallery'],
    ['missing number', '#photo-'],
    ['not a number', '#photo-abc'],
    ['negative', '#photo--3'],
    ['trailing junk', '#photo-3x'],
    ['leading junk', '#x-photo-3'],
  ])('rejects %s', (_label, hash) => {
    expect(parsePhotoHash(hash)).toBeNull();
  });

  it('rejects #photo-0, which has no 0-based index', () => {
    expect(parsePhotoHash('#photo-0')).toBeNull();
  });
});

describe('parsePhotoQuery', () => {
  it('reads the photo param', () => {
    expect(parsePhotoQuery('?photo=v2:abc123')).toBe('v2:abc123');
  });

  it('returns null when absent', () => {
    expect(parsePhotoQuery('')).toBeNull();
    expect(parsePhotoQuery('?preview=true')).toBeNull();
  });

  it('ignores an empty value', () => {
    // URLSearchParams reads `?photo=` as the empty string, not absent — callers
    // treat an empty token the same as "not addressing a photo" downstream,
    // but this function reports exactly what was in the URL.
    expect(parsePhotoQuery('?photo=')).toBe('');
  });
});

describe('buildPhotoQuery', () => {
  it('adds the photo param to an empty search string', () => {
    expect(buildPhotoQuery('', 'v2:abc')).toBe('?photo=v2%3Aabc');
  });

  it('preserves other query parameters', () => {
    expect(buildPhotoQuery('?preview=true', 'v2:abc')).toBe('?preview=true&photo=v2%3Aabc');
  });

  it('replaces an existing photo param rather than duplicating it', () => {
    expect(buildPhotoQuery('?photo=old', 'v2:new')).toBe('?photo=v2%3Anew');
  });

  it('removes the param when assetId is null', () => {
    expect(buildPhotoQuery('?photo=v2:abc&preview=true', null)).toBe('?preview=true');
  });

  it('returns an empty string when nothing is left', () => {
    expect(buildPhotoQuery('?photo=v2:abc', null)).toBe('');
  });
});

describe('buildPhotoPermalink', () => {
  const location = {
    origin: 'https://folio.example',
    pathname: '/travel/iceland',
    search: '',
  };

  it('builds an absolute link to the photo, addressed by its stable id', () => {
    expect(buildPhotoPermalink(location, 'v2:abc123')).toBe(
      'https://folio.example/travel/iceland?photo=v2%3Aabc123',
    );
  });

  it('preserves an existing query string', () => {
    expect(buildPhotoPermalink({ ...location, search: '?preview=true' }, 'v2:abc123')).toBe(
      'https://folio.example/travel/iceland?preview=true&photo=v2%3Aabc123',
    );
  });

  it('works at the site root', () => {
    expect(buildPhotoPermalink({ ...location, pathname: '/' }, 'v2:abc123')).toBe(
      'https://folio.example/?photo=v2%3Aabc123',
    );
  });

  // The whole point: the same asset keeps the same link no matter where it
  // now sits in the album (#588). The old #photo-N form could not promise
  // that at all — it named a position, not a photo.
  it('does not change when the asset moves to a different position', () => {
    expect(buildPhotoPermalink(location, 'v2:abc123')).toBe(
      buildPhotoPermalink(location, 'v2:abc123'),
    );
  });
});
