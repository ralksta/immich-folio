/**
 * The page builder's edits as pure functions on GalleryState (#608).
 *
 * Each takes a state and returns a new one; PageBuilder wraps them in
 * setGallery() and adds what is not the state's business: confirming a
 * removal and marking the form dirty. Out here they have tests
 * (app/admin/__tests__/gallery-ops.test.ts).
 *
 * An index that does not exist leaves the state as it is.
 */

import { arrayMove } from '@dnd-kit/sortable';
import type { GalleryState } from './galleryYaml';
import type { AlbumEntry, PickerTarget, Section, Subpage } from './types';

/**
 * Where a list of albums lives: the standalone list, a subpage's own list, or
 * a section of a subpage. PickerTarget and ActiveEditAlbumAddress both carry
 * this shape.
 */
type AlbumListAddress = Pick<PickerTarget, 'type' | 'subpageIndex' | 'sectionIndex'>;

function mapSubpage(g: GalleryState, index: number, fn: (sp: Subpage) => Subpage): GalleryState {
  if (!g.subpages[index]) return g;
  return { ...g, subpages: g.subpages.map((sp, i) => (i === index ? fn(sp) : sp)) };
}

function mapSection(
  g: GalleryState,
  subpageIndex: number,
  sectionIndex: number,
  fn: (sec: Section) => Section,
): GalleryState {
  if (!g.subpages[subpageIndex]?.sections?.[sectionIndex]) return g;
  return mapSubpage(g, subpageIndex, (sp) => ({
    ...sp,
    sections: sp.sections!.map((sec, i) => (i === sectionIndex ? fn(sec) : sec)),
  }));
}

/** Replace the album list at an address. */
export function mapAlbums(
  g: GalleryState,
  at: AlbumListAddress,
  fn: (albums: AlbumEntry[]) => AlbumEntry[],
): GalleryState {
  if (at.type === 'standalone') return { ...g, albums: fn(g.albums) };
  if (at.subpageIndex == null) return g;
  if (at.type === 'subpage') {
    return mapSubpage(g, at.subpageIndex, (sp) => ({ ...sp, albums: fn(sp.albums) }));
  }
  if (at.sectionIndex == null) return g;
  return mapSection(g, at.subpageIndex, at.sectionIndex, (sec) => ({
    ...sec,
    albums: fn(sec.albums),
  }));
}

/** The album list at an address, or undefined when the address is stale. */
export function albumsAt(g: GalleryState, at: AlbumListAddress): AlbumEntry[] | undefined {
  if (at.type === 'standalone') return g.albums;
  const sp = at.subpageIndex == null ? undefined : g.subpages[at.subpageIndex];
  if (at.type === 'subpage') return sp?.albums;
  return at.sectionIndex == null ? undefined : sp?.sections?.[at.sectionIndex]?.albums;
}

// ── Albums ──────────────────────────────────────────────────────

export const addAlbum = (g: GalleryState, at: AlbumListAddress, entry: AlbumEntry) =>
  mapAlbums(g, at, (albums) => [...albums, entry]);

export const updateAlbum = (
  g: GalleryState,
  at: AlbumListAddress,
  albumIndex: number,
  updates: Partial<AlbumEntry>,
) =>
  mapAlbums(g, at, (albums) => albums.map((a, i) => (i === albumIndex ? { ...a, ...updates } : a)));

export const removeAlbum = (g: GalleryState, at: AlbumListAddress, albumIndex: number) =>
  mapAlbums(g, at, (albums) => albums.filter((_, i) => i !== albumIndex));

export const moveAlbum = (g: GalleryState, at: AlbumListAddress, from: number, to: number) =>
  mapAlbums(g, at, (albums) => arrayMove(albums, from, to));

// ── Hero ────────────────────────────────────────────────────────

export const addHero = (g: GalleryState, assetId: string): GalleryState => ({
  ...g,
  hero: [...g.hero, assetId],
});

/** Append several hero photos in pick order, skipping any already listed. */
export const addHeroes = (g: GalleryState, assetIds: string[]): GalleryState => ({
  ...g,
  hero: [
    ...g.hero,
    ...assetIds.filter((id, i) => !g.hero.includes(id) && assetIds.indexOf(id) === i),
  ],
});

export const removeHero = (g: GalleryState, index: number): GalleryState => ({
  ...g,
  hero: g.hero.filter((_, i) => i !== index),
});

export const moveHero = (g: GalleryState, from: number, to: number): GalleryState => ({
  ...g,
  hero: arrayMove(g.hero, from, to),
});

// ── Subpages and sections ───────────────────────────────────────

export const addSubpage = (g: GalleryState): GalleryState => ({
  ...g,
  subpages: [
    ...g.subpages,
    { name: `New Page ${g.subpages.length + 1}`, albums: [], sections: undefined },
  ],
});

export const removeSubpage = (g: GalleryState, index: number): GalleryState => ({
  ...g,
  subpages: g.subpages.filter((_, i) => i !== index),
  // A page after the removed subpage moves up with the rest of the menu.
  ...(g.pageRefs
    ? {
        pageRefs: g.pageRefs.map((r) =>
          r.position > index ? { ...r, position: r.position - 1 } : r,
        ),
      }
    : {}),
});

export const updateSubpage = (g: GalleryState, index: number, updates: Partial<Subpage>) =>
  mapSubpage(g, index, (sp) => ({ ...sp, ...updates }));

export const moveSubpage = (g: GalleryState, from: number, to: number): GalleryState => ({
  ...g,
  subpages: arrayMove(g.subpages, from, to),
});

export const addSection = (g: GalleryState, subpageIndex: number) =>
  mapSubpage(g, subpageIndex, (sp) => ({
    ...sp,
    sections: [...(sp.sections || []), { title: 'New Section', albums: [] }],
  }));

export const removeSection = (g: GalleryState, subpageIndex: number, sectionIndex: number) =>
  mapSubpage(g, subpageIndex, (sp) => ({
    ...sp,
    sections: (sp.sections || []).filter((_, i) => i !== sectionIndex),
  }));

export const updateSection = (
  g: GalleryState,
  subpageIndex: number,
  sectionIndex: number,
  updates: Partial<Section>,
) => mapSection(g, subpageIndex, sectionIndex, (sec) => ({ ...sec, ...updates }));

// ── Menu: subpages and content pages together (#722) ────────────

/** One row of the menu list: a subpage by its index, or a page by its slug. */
export type MenuItem = { kind: 'subpage'; index: number } | { kind: 'page'; slug: string };

/** The menu in the order it is saved and shown: subpages with pages interleaved. */
export function menuItems(g: GalleryState): MenuItem[] {
  const refs = g.pageRefs ?? [];
  const out: MenuItem[] = [];
  for (let i = 0; i <= g.subpages.length; i++) {
    for (const ref of refs) {
      if (Math.min(ref.position, g.subpages.length) === i)
        out.push({ kind: 'page', slug: ref.slug });
    }
    if (i < g.subpages.length) out.push({ kind: 'subpage', index: i });
  }
  return out;
}

/** Rebuild the state from a reordered menu list. */
function fromMenu(g: GalleryState, items: MenuItem[]): GalleryState {
  const subpages: GalleryState['subpages'] = [];
  const pageRefs: NonNullable<GalleryState['pageRefs']> = [];
  for (const item of items) {
    if (item.kind === 'subpage') subpages.push(g.subpages[item.index]);
    else pageRefs.push({ slug: item.slug, position: subpages.length });
  }
  return { ...g, subpages, pageRefs };
}

/**
 * Move a menu row from one position to another. Subpage indexes change with
 * it; `followMenuMove` tells the builder where an open subpage went.
 */
export function moveMenuItem(g: GalleryState, from: number, to: number): GalleryState {
  const items = menuItems(g);
  if (!items[from] || !items[to]) return g;
  return fromMenu(g, arrayMove(items, from, to));
}

/** The index an open subpage has after moveMenuItem(from, to). */
export function followMenuMove(
  g: GalleryState,
  open: number | null,
  from: number,
  to: number,
): number | null {
  if (open === null) return null;
  const moved = arrayMove(menuItems(g), from, to);
  let index = 0;
  for (const item of moved) {
    if (item.kind !== 'subpage') continue;
    if (item.index === open) return index;
    index++;
  }
  return open;
}

export function isPageInMenu(g: GalleryState, slug: string): boolean {
  return (g.pageRefs ?? []).some((r) => r.slug === slug);
}

/**
 * Put a page in the menu or take it out. `at` is a menu row index to insert
 * before; without one the page goes to the end of the menu.
 */
export function setPageInMenu(
  g: GalleryState,
  slug: string,
  inMenu: boolean,
  at?: number,
): GalleryState {
  const without = (g.pageRefs ?? []).filter((r) => r.slug !== slug);
  if (!inMenu) {
    return isPageInMenu(g, slug) ? { ...g, pageRefs: without } : g;
  }
  if (isPageInMenu(g, slug)) return g;
  const items = menuItems(g);
  const index = at === undefined ? items.length : Math.max(0, Math.min(at, items.length));
  items.splice(index, 0, { kind: 'page', slug });
  return fromMenu(g, items);
}

/** Follow a page rename, keeping its place in the menu. */
export function renamePageRef(g: GalleryState, from: string, to: string): GalleryState {
  if (!isPageInMenu(g, from)) return g;
  return {
    ...g,
    pageRefs: (g.pageRefs ?? []).map((r) => (r.slug === from ? { ...r, slug: to } : r)),
  };
}

// ── Reading ─────────────────────────────────────────────────────

/** The "03 — Collection" number the page renders: counted over enabled subpages only. */
export function enabledPosition(g: GalleryState, index: number): number | undefined {
  const sp = g.subpages[index];
  if (!sp || sp.enabled === false) return undefined;
  return g.subpages.slice(0, index).filter((s) => s.enabled !== false).length + 1;
}

/** Every album published anywhere, so the picker can mark the ones already in use. */
export function usedAlbumIds(g: GalleryState): Set<string> {
  const ids = new Set<string>();
  g.albums.forEach((a) => ids.add(a.id));
  g.subpages.forEach((sp) => {
    sp.albums.forEach((a) => ids.add(a.id));
    sp.sections?.forEach((sec) => sec.albums.forEach((a) => ids.add(a.id)));
  });
  return ids;
}

/**
 * Where the open subpage sheet goes after a drag, so the sheet stays on the
 * page it was showing.
 */
export function followMovedIndex(open: number | null, from: number, to: number): number | null {
  if (open === null) return null;
  if (open === from) return to;
  if (from < open && to >= open) return open - 1;
  if (from > open && to <= open) return open + 1;
  return open;
}
