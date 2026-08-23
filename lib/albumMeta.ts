/**
 * Derivations for the album header — what a whole album can honestly say about
 * itself. Server-side only by convention, but there is nothing here that needs
 * `fs`, so the unit tests import it directly.
 */

import type { ImmichAlbum } from './immich';

/**
 * Extra detail for the album header — shooting date and camera/lens. Both are
 * rendered in their own spans and hidden by default; only presets that ask for
 * them show them, so the header keeps reading "86 photos" everywhere else.
 *
 * Both used to be read off the first asset that happened to carry EXIF, so an
 * album shot on three bodies advertised whichever one sorted first — and
 * changing the album's sort mode changed the camera it claimed (#509). The
 * header now only states what the whole album agrees on, and spans a date range
 * when the photos do.
 */
export function albumMetaDetail(
  album: ImmichAlbum,
  showGear: boolean,
): { date?: string; gear?: string } {
  const dates = album.assets
    .map((a) => a.exifInfo?.dateTimeOriginal || a.fileCreatedAt)
    .filter((d): d is string => !!d)
    .map((d) => new Date(d).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);

  const first = dates[0];
  const last = dates[dates.length - 1];
  const from = first !== undefined ? formatMonthYear(new Date(first).toISOString()) : undefined;
  const to = last !== undefined ? formatMonthYear(new Date(last).toISOString()) : undefined;
  const date = from && to ? (from === to ? from : `${from} – ${to}`) : from || to;

  return {
    ...(date ? { date } : {}),
    ...(showGear ? withGear(album) : {}),
  };
}

/**
 * The camera and lens, but only when every photo that names one names the same
 * one. A mixed album says nothing rather than picking a winner.
 */
function withGear(album: ImmichAlbum): { gear?: string } {
  const unique = (values: (string | null | undefined)[]): string | undefined => {
    const set = new Set(values.filter((v): v is string => !!v));
    return set.size === 1 ? [...set][0] : undefined;
  };

  const model = unique(album.assets.map((a) => a.exifInfo?.model));
  const lens = unique(album.assets.map((a) => a.exifInfo?.lensModel));
  const gear = [model, lens].filter(Boolean).join(' · ');

  return gear ? { gear } : {};
}

function formatMonthYear(iso: string): string | undefined {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
