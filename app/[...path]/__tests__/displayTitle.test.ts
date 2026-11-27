import { describe, it, expect } from 'vitest';
import { displayTitle } from '../displayTitle';

describe('displayTitle', () => {
  it('returns the trimmed display title', () => {
    expect(displayTitle('  Summer  ', 'IMG Album')).toBe('Summer');
  });
  it('falls back to the album name when unset, empty or whitespace', () => {
    expect(displayTitle(undefined, 'IMG Album')).toBe('IMG Album');
    expect(displayTitle(null, 'IMG Album')).toBe('IMG Album');
    expect(displayTitle('', 'IMG Album')).toBe('IMG Album');
    expect(displayTitle('   ', 'IMG Album')).toBe('IMG Album');
  });
});
