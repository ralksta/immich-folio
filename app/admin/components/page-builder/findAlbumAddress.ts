import type { ActiveEditAlbumAddress, AlbumEntry, Subpage } from './types';

/**
 * Where an album sits in the page builder, as the address its drawer opens by.
 *
 * Used by the `/admin/pages?album=<id>` deep link from the diagnostics page. An
 * album can be listed more than once; the first place wins — standalone, then
 * each subpage's own albums, then its sections — which is also the order the
 * builder shows them in.
 */
export function findAlbumAddress(
  gallery: { albums: AlbumEntry[]; subpages: Subpage[] },
  albumId: string,
): ActiveEditAlbumAddress | null {
  const standalone = gallery.albums.findIndex((a) => a.id === albumId);
  if (standalone !== -1) return { type: 'standalone', albumIndex: standalone };

  for (const [subpageIndex, sp] of gallery.subpages.entries()) {
    const direct = sp.albums.findIndex((a) => a.id === albumId);
    if (direct !== -1) return { type: 'subpage', subpageIndex, albumIndex: direct };

    for (const [sectionIndex, section] of (sp.sections ?? []).entries()) {
      const inSection = section.albums.findIndex((a) => a.id === albumId);
      if (inSection !== -1) {
        return { type: 'section', subpageIndex, sectionIndex, albumIndex: inSection };
      }
    }
  }
  return null;
}
