import { describe, it, expect } from 'vitest';
import { findAlbumAddress } from '../components/page-builder/findAlbumAddress';
import type { Subpage } from '../components/page-builder/types';

const subpage = (name: string, albums: string[], sections: string[][] = []): Subpage => ({
  name,
  albums: albums.map((id) => ({ id })),
  sections: sections.map((ids, i) => ({ title: `S${i}`, albums: ids.map((id) => ({ id })) })),
});

describe('findAlbumAddress', () => {
  it('finds a standalone album', () => {
    expect(findAlbumAddress({ albums: [{ id: 'x' }, { id: 'a' }], subpages: [] }, 'a')).toEqual({
      type: 'standalone',
      albumIndex: 1,
    });
  });

  it("finds an album on a subpage's own list", () => {
    const gallery = { albums: [], subpages: [subpage('one', ['x']), subpage('two', ['y', 'a'])] };
    expect(findAlbumAddress(gallery, 'a')).toEqual({
      type: 'subpage',
      subpageIndex: 1,
      albumIndex: 1,
    });
  });

  it('finds an album inside a section', () => {
    const gallery = { albums: [], subpages: [subpage('one', [], [['x'], ['y', 'a']])] };
    expect(findAlbumAddress(gallery, 'a')).toEqual({
      type: 'section',
      subpageIndex: 0,
      sectionIndex: 1,
      albumIndex: 1,
    });
  });

  it('prefers the standalone listing when an album appears twice', () => {
    const gallery = { albums: [{ id: 'a' }], subpages: [subpage('one', ['a'])] };
    expect(findAlbumAddress(gallery, 'a')?.type).toBe('standalone');
  });

  it('returns null for an album the builder does not list', () => {
    expect(findAlbumAddress({ albums: [], subpages: [subpage('one', ['x'])] }, 'a')).toBeNull();
  });
});
