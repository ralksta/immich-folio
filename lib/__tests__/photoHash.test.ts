import { describe, it, expect } from 'vitest';
import { parsePhotoHash, buildPhotoHash, buildPhotoPermalink } from '@/lib/photoHash';

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

describe('buildPhotoPermalink', () => {
  const location = {
    origin: 'https://folio.example',
    pathname: '/travel/iceland',
    search: '',
  };

  it('builds an absolute link to the photo', () => {
    expect(buildPhotoPermalink(location, 2)).toBe('https://folio.example/travel/iceland#photo-3');
  });

  it('preserves an existing query string', () => {
    expect(buildPhotoPermalink({ ...location, search: '?preview=true' }, 0)).toBe(
      'https://folio.example/travel/iceland?preview=true#photo-1',
    );
  });

  it('works at the site root', () => {
    expect(buildPhotoPermalink({ ...location, pathname: '/' }, 0)).toBe(
      'https://folio.example/#photo-1',
    );
  });
});
