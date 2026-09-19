/**
 * Alt-text coverage — which published photos reach the site without one.
 *
 * Folio has no alt-text field of its own: the Immich description becomes the
 * `alt` of a photo, and only while the `caption` EXIF group is switched on
 * (`assetCaption` in lib/urls.ts). A photo without a description therefore
 * renders with an empty alt, silently, and nothing in the admin said so.
 *
 * Pure, like lib/admin/doctor.ts: the route gathers the albums, this judges
 * them. The report is admin-only, so it carries raw asset UUIDs — the same as
 * /api/admin/thumbnail, which renders them.
 */

export interface AltTextAssetInput {
  id: string;
  type: 'IMAGE' | 'VIDEO';
  originalFileName: string;
  exifInfo?: { description?: string | null } | null;
}

export interface AltTextAlbumInput {
  id: string;
  name: string;
  /** Where the album is published — `/<subpage-slug>`, or `/` for a standalone one. */
  path: string;
  assets: AltTextAssetInput[];
}

export interface AltTextGap {
  assetId: string;
  fileName: string;
}

export interface AltTextAlbumReport {
  albumId: string;
  albumName: string;
  path: string;
  /** Photos in the album — videos are not counted, they have no alt. */
  total: number;
  missing: AltTextGap[];
}

export interface AltTextReport {
  /** Whether descriptions are used as alt text at all (`exif.caption`). */
  captionsEnabled: boolean;
  /** Distinct published photos — one that sits in two albums counts once. */
  total: number;
  described: number;
  /** Only albums with gaps, the most gaps first. */
  albums: AltTextAlbumReport[];
}

function hasDescription(asset: AltTextAssetInput): boolean {
  return !!asset.exifInfo?.description?.trim();
}

export function buildAltTextReport(
  albums: AltTextAlbumInput[],
  captionsEnabled: boolean,
): AltTextReport {
  const seen = new Map<string, boolean>();
  const reports: AltTextAlbumReport[] = [];

  for (const album of albums) {
    const photos = album.assets.filter((a) => a.type === 'IMAGE');
    for (const photo of photos) seen.set(photo.id, hasDescription(photo));

    const missing = photos
      .filter((p) => !hasDescription(p))
      .map((p) => ({ assetId: p.id, fileName: p.originalFileName }));
    if (missing.length) {
      reports.push({
        albumId: album.id,
        albumName: album.name,
        path: album.path,
        total: photos.length,
        missing,
      });
    }
  }

  reports.sort((a, b) => b.missing.length - a.missing.length);

  return {
    captionsEnabled,
    total: seen.size,
    described: [...seen.values()].filter(Boolean).length,
    albums: reports,
  };
}

/**
 * The published path of each album: the first subpage that lists it, else `/`.
 * An album can sit on several subpages; one path is enough to find it again.
 */
export function albumPaths(
  subpages: Array<{ slug: string; albumIds: string[] }>,
): Map<string, string> {
  const paths = new Map<string, string>();
  for (const sp of subpages) {
    for (const id of sp.albumIds) {
      if (!paths.has(id)) paths.set(id, `/${sp.slug}`);
    }
  }
  return paths;
}

/**
 * The Immich web app's address, derived from the API URL Folio talks to.
 *
 * This is the address *Folio* reaches Immich at. On a Docker network that is
 * often `http://immich:2283`, which the operator's browser cannot open — the
 * UI says so next to the links rather than pretending they always work.
 */
export function immichWebUrl(apiUrl: string): string {
  return apiUrl.replace(/\/+$/, '').replace(/\/api$/, '');
}
