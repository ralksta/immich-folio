import { describe, it, expect } from 'vitest';
import { albumNeighbours } from '@/lib/albumNav';

const album = (id: string, slug = id, albumName = id.toUpperCase()) => ({ id, slug, albumName });

const three = [album('a'), album('b'), album('c')];

describe('albumNeighbours', () => {
  it('offers both neighbours in the middle of a list', () => {
    expect(albumNeighbours(three, 'b')).toEqual({
      prev: { href: '/a', name: 'A' },
      next: { href: '/c', name: 'C' },
    });
  });

  it('omits the previous link on the first album', () => {
    expect(albumNeighbours(three, 'a')).toEqual({ next: { href: '/b', name: 'B' } });
  });

  it('omits the next link on the last album — no wrap-around', () => {
    expect(albumNeighbours(three, 'c')).toEqual({ prev: { href: '/b', name: 'B' } });
  });

  it('prefixes hrefs with the subpage path when there is one', () => {
    expect(albumNeighbours(three, 'b', '/travel')).toEqual({
      prev: { href: '/travel/a', name: 'A' },
      next: { href: '/travel/c', name: 'C' },
    });
  });

  it('returns nothing for a single-album list', () => {
    expect(albumNeighbours([album('a')], 'a')).toEqual({});
  });

  it('returns nothing for an empty list', () => {
    expect(albumNeighbours([], 'a')).toEqual({});
  });

  it('returns nothing when the album is not in the list', () => {
    expect(albumNeighbours(three, 'zzz')).toEqual({});
  });

  it('follows list order, not slug or name order', () => {
    const shuffled = [album('c'), album('a'), album('b')];
    expect(albumNeighbours(shuffled, 'a')).toEqual({
      prev: { href: '/c', name: 'C' },
      next: { href: '/b', name: 'B' },
    });
  });

  it('uses the slug for the href and the display name for the label', () => {
    const list = [album('id-1', 'harbour-at-dawn', 'Harbour at Dawn'), album('id-2')];
    expect(albumNeighbours(list, 'id-2').prev).toEqual({
      href: '/harbour-at-dawn',
      name: 'Harbour at Dawn',
    });
  });
});
