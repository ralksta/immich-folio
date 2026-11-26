/**
 * The title a single-album subpage shows: its Display Title, trimmed, or the
 * Immich album's own name when none is set (or it is only whitespace). One
 * helper so the heading, `<title>`, share card and hero `alt` cannot drift.
 */
export function displayTitle(title: string | undefined | null, albumName: string): string {
  return title?.trim() || albumName;
}
