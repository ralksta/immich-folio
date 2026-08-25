import type { AlbumSortMode } from '@/lib/albumSort';

export interface AlbumEntry {
  id: string;
  title?: string;
  description?: string;
  password?: string;
  heroImage?: string;
  sort?: AlbumSortMode;
  /** Pinned asset UUIDs for `sort: manual`; everything else follows automatically. */
  assetOrder?: string[];
  /** EXPERIMENTAL: per-album grid override (layout only in the UI for now) */
  grid?: { columns?: number; gap?: number; aspectRatio?: string; layout?: string };
  /** EXPERIMENTAL: focal point for the cover crop, e.g. "50% 25%" or "top" */
  coverPosition?: string;
}

export interface Section {
  title: string;
  description?: string;
  albums: AlbumEntry[];
}

export interface Subpage {
  name: string;
  title?: string;
  subtitle?: string;
  password?: string;
  enabled?: boolean;
  /** EXPERIMENTAL: reachable by direct link, but not shown in navigation */
  hidden?: boolean;
  essayText?: string;
  essayFile?: string;
  sections?: Section[];
  albums: AlbumEntry[];
  /** Photo grid for the albums on this page (and the page layout style). */
  grid?: { columns?: number; gap?: number; aspectRatio?: string; layout?: string };
  /** The album-cover tiles on this page only (#523). */
  coverGrid?: { columns?: number; gap?: number; aspectRatio?: string; layout?: string };
}

/**
 * The cover grid a subpage renders with when its gallery.yaml predates #523.
 *
 * Back then one `grid` key sized both the covers and the photos, so the values
 * a user typed into "Album Cover Grid" live there. Seeding the new field from
 * them means the drawer shows what the page actually renders, and the first
 * save writes the split out explicitly. Only the two keys the cover grid reads
 * are carried over — `layout` and `aspectRatio` never reached the covers.
 */
export function seedCoverGrid(grid: Subpage['grid']): Subpage['coverGrid'] {
  if (!grid) return undefined;
  return normalizeSubpageGrid({ columns: grid.columns, gap: grid.gap });
}

/**
 * Drops keys the editor cleared so an emptied field never persists as `null`
 * in gallery.yaml, and returns undefined once nothing is left — `handleSave`
 * only writes `grid` when it is truthy.
 */
export function normalizeSubpageGrid(grid: Subpage['grid']): Subpage['grid'] {
  if (!grid) return undefined;
  const next = { ...grid };
  for (const key of Object.keys(next) as Array<keyof typeof next>) {
    const value = next[key];
    if (value === undefined || value === '') delete next[key];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export interface ActiveEditAlbumAddress {
  type: 'standalone' | 'subpage' | 'section';
  subpageIndex?: number;
  sectionIndex?: number;
  albumIndex: number;
}

export interface ImmichAlbumInfo {
  id: string;
  albumName: string;
  description: string;
  thumbnailAssetId: string | null;
  assetCount: number;
  isConfigured: boolean;
}

/** Where the album picker inserts the album it returns. */
export interface PickerTarget {
  type: 'standalone' | 'subpage' | 'section';
  subpageIndex?: number;
  sectionIndex?: number;
}

export interface HeroPickerTarget {
  albumId?: string;
  onSelect: (assetId: string) => void;
  currentAssetIds?: string[];
  title?: string;
}

export interface OrderEditorTarget {
  albumId: string;
  albumName: string;
  assetOrder: string[];
  onSave: (assetOrder: string[]) => void;
}
