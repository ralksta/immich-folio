/**
 * gallery.yaml ⇄ the page builder's model (#608).
 *
 * This is the code that decides what ends up in gallery.yaml when the
 * builder saves. It lived inside the 1,200-line PageBuilder component, where
 * nothing could test it; as pure functions it has a table of cases in
 * app/admin/__tests__/gallery-yaml.test.ts.
 */

import { parseAlbumEntries, serializeAlbumEntries } from './albumEntries';
import { seedCoverGrid, type AlbumEntry, type Subpage } from './types';

export interface GalleryState {
  hero: string[];
  albums: AlbumEntry[];
  subpages: Subpage[];
  /**
   * Content pages in the menu (#722): `- page: <slug>` among the subpages.
   * Optional so a draft saved before pages existed still loads.
   */
  pageRefs?: PageRef[];
}

/**
 * A content page placed in the menu. `position` is the number of subpages in
 * front of it, so the subpage list keeps its own indexes — every drawer and
 * album address in the builder is one — and the menu order is rebuilt from
 * both lists when saving. Refs sharing a position keep their array order.
 */
export interface PageRef {
  slug: string;
  position: number;
}

/**
 * Accepts both subpage shapes gallery.yaml allows: the list of objects the
 * builder writes, and the older map of name → albums (or name → object).
 */
export function parseGalleryYaml(raw: Record<string, unknown>): GalleryState {
  const hero = Array.isArray(raw.hero) ? raw.hero : raw.hero ? [raw.hero as string] : [];
  const albums = parseAlbumEntries(
    raw.albums as Array<string | Record<string, string>> | undefined,
  );

  let subpages: Subpage[] = [];
  const pageRefs: PageRef[] = [];
  if (Array.isArray(raw.subpages)) {
    const entries = raw.subpages as Array<Record<string, unknown>>;
    const subpageEntries: Array<Record<string, unknown>> = [];
    for (const entry of entries) {
      if (entry && typeof entry.page === 'string') {
        pageRefs.push({ slug: entry.page, position: subpageEntries.length });
      } else {
        subpageEntries.push(entry);
      }
    }
    subpages = subpageEntries.map((sp) => ({
      name: (sp.name as string) || '',
      title: sp.title as string | undefined,
      subtitle: sp.subtitle as string | undefined,
      password: sp.password as string | undefined,
      enabled: sp.enabled !== false,
      hidden: sp.hidden === true,
      proofing: typeof sp.proofing === 'boolean' ? sp.proofing : undefined,
      location: sp.location as string | undefined,
      essayText: sp.essayText as string | undefined,
      essayFile: sp.essayFile as string | undefined,
      albums: parseAlbumEntries(sp.albums as Array<string | Record<string, string>> | undefined),
      sections: sp.sections
        ? (sp.sections as Array<Record<string, unknown>>).map((sec) => ({
            title: (sec.title as string) || '',
            description: sec.description as string | undefined,
            albums: parseAlbumEntries(sec.albums as Array<string | Record<string, string>>),
          }))
        : undefined,
      grid: sp.grid as Subpage['grid'],
      coverGrid:
        (sp.coverGrid as Subpage['coverGrid']) ?? seedCoverGrid(sp.grid as Subpage['grid']),
    }));
  } else if (raw.subpages && typeof raw.subpages === 'object') {
    subpages = Object.entries(raw.subpages as Record<string, unknown>).map(([name, value]) => {
      if (Array.isArray(value)) {
        return { name, albums: parseAlbumEntries(value), sections: undefined, enabled: true };
      }
      const sp = value as Record<string, unknown>;
      return {
        name,
        title: sp.title as string | undefined,
        subtitle: sp.subtitle as string | undefined,
        password: sp.password as string | undefined,
        enabled: sp.enabled !== false,
        hidden: sp.hidden === true,
        proofing: typeof sp.proofing === 'boolean' ? sp.proofing : undefined,
        location: sp.location as string | undefined,
        essayText: sp.essayText as string | undefined,
        essayFile: sp.essayFile as string | undefined,
        albums: parseAlbumEntries(sp.albums as Array<string | Record<string, string>> | undefined),
        sections: undefined,
        grid: sp.grid as Subpage['grid'],
        coverGrid:
          (sp.coverGrid as Subpage['coverGrid']) ?? seedCoverGrid(sp.grid as Subpage['grid']),
      };
    });
  }

  return { hero, albums, subpages, pageRefs };
}

/** The gallery.yaml object for a builder state. Empty groups are left out. */
export function serializeGallery(gallery: GalleryState): Record<string, unknown> {
  const yamlData: Record<string, unknown> = {};

  if (gallery.hero.length > 0) {
    yamlData.hero = gallery.hero;
  }
  if (gallery.albums.length > 0) {
    yamlData.albums = serializeAlbumEntries(gallery.albums);
  }
  const pageRefs = gallery.pageRefs ?? [];
  if (gallery.subpages.length > 0 || pageRefs.length > 0) {
    const subpageEntries = gallery.subpages.map((sp) => {
      const entry: Record<string, unknown> = { name: sp.name };
      if (sp.title) entry.title = sp.title;
      if (sp.subtitle) entry.subtitle = sp.subtitle;
      if (sp.password) entry.password = sp.password;
      if (sp.enabled === false) entry.enabled = false;
      if (sp.hidden === true) entry.hidden = true;
      // Both values mean something: false switches proofing off for this page.
      if (sp.proofing !== undefined) entry.proofing = sp.proofing;
      if (sp.essayText) entry.essayText = sp.essayText;
      if (sp.essayFile) entry.essayFile = sp.essayFile;
      if (sp.grid) entry.grid = sp.grid;
      if (sp.coverGrid) entry.coverGrid = sp.coverGrid;
      if (sp.location) entry.location = sp.location;

      if (sp.sections && sp.sections.length > 0) {
        entry.sections = sp.sections.map((sec) => {
          const s: Record<string, unknown> = {
            title: sec.title,
            albums: serializeAlbumEntries(sec.albums),
          };
          if (sec.description) s.description = sec.description;
          return s;
        });
        if (sp.albums.length > 0) {
          entry.albums = serializeAlbumEntries(sp.albums);
        }
      } else {
        entry.albums = serializeAlbumEntries(sp.albums);
      }

      return entry;
    });
    yamlData.subpages = interleave(subpageEntries, pageRefs);
  }

  return yamlData;
}

/** Subpage entries with `{ page }` entries placed at their positions. */
function interleave(
  subpageEntries: Record<string, unknown>[],
  pageRefs: PageRef[],
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i <= subpageEntries.length; i++) {
    // A ref beyond the end (a subpage was removed) lands at the end.
    for (const ref of pageRefs) {
      const at = Math.min(ref.position, subpageEntries.length);
      if (at === i) out.push({ page: ref.slug });
    }
    if (i < subpageEntries.length) out.push(subpageEntries[i]);
  }
  return out;
}
