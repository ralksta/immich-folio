import { describe, it, expect } from 'vitest';
import { canSelectMore, matchesQuery, toggleSelection } from '../admin/assetSelection';

describe('toggleSelection (#602)', () => {
  it('appends in click order and removes on a second toggle', () => {
    let s = toggleSelection([], 'a');
    s = toggleSelection(s, 'b');
    s = toggleSelection(s, 'c');
    expect(s).toEqual(['a', 'b', 'c']);
    expect(toggleSelection(s, 'b')).toEqual(['a', 'c']);
  });

  it('refuses assets the caller already uses', () => {
    expect(toggleSelection(['a'], 'x', { disabled: new Set(['x']) })).toEqual(['a']);
  });

  it('stops at max but still lets you deselect', () => {
    const full = ['a', 'b'];
    expect(toggleSelection(full, 'c', { max: 2 })).toEqual(['a', 'b']);
    expect(toggleSelection(full, 'a', { max: 2 })).toEqual(['b']);
  });

  it('replaces the pick when max is 1', () => {
    expect(toggleSelection(['a'], 'b', { max: 1 })).toEqual(['b']);
  });

  it('does not mutate its input', () => {
    const s = ['a'];
    toggleSelection(s, 'b');
    expect(s).toEqual(['a']);
  });
});

describe('canSelectMore', () => {
  it('is unlimited without max, bounded with it, and always open for a single slot', () => {
    expect(canSelectMore(['a', 'b', 'c'])).toBe(true);
    expect(canSelectMore(['a'], 2)).toBe(true);
    expect(canSelectMore(['a', 'b'], 2)).toBe(false);
    expect(canSelectMore(['a'], 1)).toBe(true);
  });
});

describe('matchesQuery', () => {
  const asset = { originalFileName: 'IMG_4021.HEIC' };
  it('matches a case-insensitive filename fragment', () => {
    expect(matchesQuery(asset, 'img_40')).toBe(true);
    expect(matchesQuery(asset, '  4021 ')).toBe(true);
    expect(matchesQuery(asset, 'DSC')).toBe(false);
  });
  it('matches everything for an empty query', () => {
    expect(matchesQuery(asset, '   ')).toBe(true);
  });
});
