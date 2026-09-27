import { describe, it, expect } from 'vitest';
import * as ops from '../components/page-builder/galleryOps';
import type { GalleryState } from '../components/page-builder/galleryYaml';

/** #608: the page builder's edits, out of the component and under test. */

const state = (): GalleryState => ({
  hero: ['h1', 'h2', 'h3'],
  albums: [{ id: 'a1' }, { id: 'a2' }],
  subpages: [
    { name: 'Japan', albums: [{ id: 'j1' }, { id: 'j2' }] },
    {
      name: 'Trips',
      enabled: false,
      albums: [],
      sections: [{ title: 'North', albums: [{ id: 'n1' }] }],
    },
    { name: 'Korea', albums: [{ id: 'k1' }] },
  ],
});

describe('album lists by address', () => {
  it('adds to the standalone list, a subpage and a section', () => {
    let g = ops.addAlbum(state(), { type: 'standalone' }, { id: 'x' });
    expect(g.albums.map((a) => a.id)).toEqual(['a1', 'a2', 'x']);
    g = ops.addAlbum(g, { type: 'subpage', subpageIndex: 0 }, { id: 'y' });
    expect(g.subpages[0].albums.map((a) => a.id)).toEqual(['j1', 'j2', 'y']);
    g = ops.addAlbum(g, { type: 'section', subpageIndex: 1, sectionIndex: 0 }, { id: 'z' });
    expect(g.subpages[1].sections![0].albums.map((a) => a.id)).toEqual(['n1', 'z']);
  });

  it('updates, removes and moves one entry and leaves its neighbours alone', () => {
    const at = { type: 'subpage' as const, subpageIndex: 0 };
    let g = ops.updateAlbum(state(), at, 1, { title: 'Tokyo', sort: 'manual' });
    expect(g.subpages[0].albums).toEqual([
      { id: 'j1' },
      { id: 'j2', title: 'Tokyo', sort: 'manual' },
    ]);
    g = ops.moveAlbum(g, at, 1, 0);
    expect(g.subpages[0].albums.map((a) => a.id)).toEqual(['j2', 'j1']);
    g = ops.removeAlbum(g, at, 0);
    expect(g.subpages[0].albums.map((a) => a.id)).toEqual(['j1']);
  });

  it('never mutates the state it was given', () => {
    const before = state();
    const copy = JSON.parse(JSON.stringify(before));
    ops.removeAlbum(before, { type: 'section', subpageIndex: 1, sectionIndex: 0 }, 0);
    ops.updateSubpage(before, 0, { title: 'x' });
    ops.moveHero(before, 0, 2);
    expect(before).toEqual(copy);
  });

  it('leaves the state as it is for an address that no longer exists', () => {
    const g = state();
    expect(ops.addAlbum(g, { type: 'subpage', subpageIndex: 9 }, { id: 'x' })).toBe(g);
    expect(ops.removeAlbum(g, { type: 'section', subpageIndex: 0, sectionIndex: 0 }, 0)).toBe(g);
    expect(ops.albumsAt(g, { type: 'section', subpageIndex: 1, sectionIndex: 5 })).toBeUndefined();
  });
});

describe('hero, subpages and sections', () => {
  it('adds, moves and removes hero photos', () => {
    let g = ops.addHero(state(), 'h4');
    g = ops.moveHero(g, 3, 0);
    expect(ops.removeHero(g, 1).hero).toEqual(['h4', 'h2', 'h3']);
  });

  it('names a new subpage after its position and starts it empty', () => {
    const g = ops.addSubpage(state());
    expect(g.subpages[3]).toEqual({ name: 'New Page 4', albums: [], sections: undefined });
  });

  it('adds, updates and removes sections', () => {
    let g = ops.addSection(state(), 0);
    expect(g.subpages[0].sections).toEqual([{ title: 'New Section', albums: [] }]);
    g = ops.updateSection(g, 0, 0, { title: 'Tokyo', description: 'Night' });
    expect(g.subpages[0].sections![0]).toEqual({
      title: 'Tokyo',
      description: 'Night',
      albums: [],
    });
    expect(ops.removeSection(g, 0, 0).subpages[0].sections).toEqual([]);
  });
});

describe('reading', () => {
  it('numbers subpages over the enabled ones only', () => {
    const g = state();
    expect(ops.enabledPosition(g, 0)).toBe(1);
    expect(ops.enabledPosition(g, 1)).toBeUndefined();
    expect(ops.enabledPosition(g, 2)).toBe(2);
  });

  it('collects every album in use, sections included', () => {
    expect([...ops.usedAlbumIds(state())].sort()).toEqual(['a1', 'a2', 'j1', 'j2', 'k1', 'n1']);
  });

  /*
   * The open subpage sheet follows its page through a drag: the page itself,
   * or a neighbour moving across it, shifts its index.
   */
  it.each([
    [null, 0, 2, null],
    [1, 1, 2, 2],
    [1, 0, 2, 0],
    [1, 2, 0, 2],
    [0, 1, 2, 0],
  ])('keeps sheet %s on its page when %s moves to %s', (open, from, to, expected) => {
    expect(ops.followMovedIndex(open, from, to)).toBe(expected);
  });
});
