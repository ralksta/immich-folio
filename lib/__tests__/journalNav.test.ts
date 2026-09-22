import { describe, it, expect } from 'vitest';
import { journalNeighbours } from '@/lib/journalNav';

const entry = (slug: string, title = slug.toUpperCase()) => ({ slug, title });

const three = [entry('a'), entry('b'), entry('c')];

describe('journalNeighbours', () => {
  it('offers both neighbours in the middle of a list', () => {
    expect(journalNeighbours(three, 'b')).toEqual({
      prev: { href: '/journal/a', title: 'A' },
      next: { href: '/journal/c', title: 'C' },
    });
  });

  it('omits the previous link on the first entry', () => {
    expect(journalNeighbours(three, 'a')).toEqual({ next: { href: '/journal/b', title: 'B' } });
  });

  it('omits the next link on the last entry — no wrap-around', () => {
    expect(journalNeighbours(three, 'c')).toEqual({ prev: { href: '/journal/b', title: 'B' } });
  });

  it('returns nothing for a single-entry list', () => {
    expect(journalNeighbours([entry('a')], 'a')).toEqual({});
  });

  it('returns nothing for an empty list', () => {
    expect(journalNeighbours([], 'a')).toEqual({});
  });

  it('returns nothing when the entry is not in the list', () => {
    expect(journalNeighbours(three, 'zzz')).toEqual({});
  });

  it('follows list order, not slug or title order', () => {
    const shuffled = [entry('c'), entry('a'), entry('b')];
    expect(journalNeighbours(shuffled, 'a')).toEqual({
      prev: { href: '/journal/c', title: 'C' },
      next: { href: '/journal/b', title: 'B' },
    });
  });

  it('falls back to whatever title is passed in, unchanged', () => {
    const list = [entry('untitled-entry', 'untitled-entry'), entry('b')];
    expect(journalNeighbours(list, 'b').prev).toEqual({
      href: '/journal/untitled-entry',
      title: 'untitled-entry',
    });
  });
});
