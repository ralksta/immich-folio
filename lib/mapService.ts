import { immich } from './immich';
import { getConfig } from './config';
import { isListedSubpage, listedAlbumIds } from './config/schema';
import { cache } from './cache';

/**
 * One album's contribution to a location marker.
 *
 * Aggregation is deliberately kept per-album (rather than pre-summed) so the
 * API layer can drop albums the viewer is not authorized to see *before*
 * computing coords, counts and the cover asset. Summing here would leak
 * protected albums into every marker.
 */
export interface MapAlbumEntry {
  id: string;
  name: string;
  slug: string;
  subpageSlug?: string;
  photoCount: number;
  latSum: number;
  lngSum: number;
  coverAssetId: string;
  /** Set when the cover was edited in Immich, for its image URL's edit marker (#831). */
  coverEdit?: { isEdited: true; updatedAt?: string };
}

interface MapConfig {
  standaloneAlbums?: readonly string[];
  subpages: ReadonlyArray<{
    slug: string;
    albumIds: readonly string[];
    enabled?: boolean;
    hidden?: boolean;
  }>;
}

/**
 * The subpage a marker links an album to, and whose password gates it on the
 * map: the first listed one that carries it. Never an offline subpage (its URL
 * is a 404 and its password guards nothing), and never a hidden one (the
 * marker would publish its address).
 */
function mapSubpageFor(config: MapConfig, albumId: string) {
  return config.subpages.find((s) => isListedSubpage(s) && s.albumIds.includes(albumId));
}

/**
 * The counts the /map header prints, for this viewer.
 *
 * `/api/map` drops every album whose subpage or own password the viewer has
 * not unlocked; the header counted them anyway, so a visitor read "3
 * collections · 12 albums" above a map that showed two. Same rule here, the
 * same subpage per album (`mapSubpageFor`), so the two cannot disagree.
 * `isAllowed` is `isAuthenticated` bound to the request's cookies.
 */
export function visibleMapCounts(
  config: MapConfig,
  isAllowed: (key: string, type: 'subpage' | 'album') => boolean,
): { collections: number; albums: number } {
  const collections = config.subpages.filter(
    (sp) => isListedSubpage(sp) && isAllowed(sp.slug, 'subpage'),
  ).length;
  let albums = 0;
  for (const id of listedAlbumIds(config)) {
    const sp = mapSubpageFor(config, id);
    if ((!sp || isAllowed(sp.slug, 'subpage')) && isAllowed(id, 'album')) albums++;
  }
  return { collections, albums };
}

/** A clustered map marker — one per unique city/country. */
export interface MapLocation {
  city: string;
  country: string;
  albums: MapAlbumEntry[];
}

/**
 * Aggregate all geotagged photos into location-level markers.
 * Returns one entry per unique city+country with averaged lat/lng.
 */
let pendingMapDataPromise: Promise<MapLocation[]> | null = null;

export async function getMapData(): Promise<MapLocation[]> {
  const config = getConfig();
  const cacheKey = 'map-data';
  const cached = cache.get<MapLocation[]>(cacheKey);
  if (cached) return cached;

  if (pendingMapDataPromise) return pendingMapDataPromise;

  pendingMapDataPromise = (async () => {
    try {
      // The allowlist still holds the albums of subpages taken offline with
      // `enabled: false`, and those of `hidden` subpages, which are reachable
      // by direct link only. A marker names, links and shows a photo of every
      // album it counts — a listing — so both have to go before anything is
      // aggregated.
      const listed = listedAlbumIds(config);
      const albums = (await immich.getAlbums()).filter((a) => listed.has(a.id));

      // Build a lookup: album ID → { name, slug, subpageSlug? }
      const albumMeta = new Map<string, { name: string; slug: string; subpageSlug?: string }>();
      for (const a of albums) {
        const sp = mapSubpageFor(config, a.id);
        albumMeta.set(a.id, { name: a.albumName, slug: a.slug, subpageSlug: sp?.slug });
      }

      // Fetch full album data (with assets) for each
      // Process in chunks of 10 to balance network speed and prevent Out of Memory (OOM)
      // crashes from fetching thousands of assets simultaneously.
      const fullAlbums: (Awaited<ReturnType<typeof immich.getAlbum>> | null)[] = [];
      const chunkSize = 10;
      for (let i = 0; i < albums.length; i += chunkSize) {
        const chunk = albums.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(chunk.map((a) => immich.getAlbum(a.id)));
        fullAlbums.push(...chunkResults);
      }

      // Bucket assets by city+country, keeping each album's contribution separate
      const buckets = new Map<string, Map<string, MapAlbumEntry>>();

      for (const album of fullAlbums) {
        if (!album) continue;
        const meta = albumMeta.get(album.id);
        if (!meta) continue;

        for (const asset of album.assets) {
          const exif = asset.exifInfo;
          // A falsiness check here would drop a coordinate of exactly 0 — the
          // equator or the prime meridian — as if it were absent (#635).
          if (exif?.latitude == null || exif?.longitude == null || !exif?.city || !exif?.country)
            continue;

          const key = `${exif.city}|${exif.country}`;
          let byAlbum = buckets.get(key);
          if (!byAlbum) {
            byAlbum = new Map();
            buckets.set(key, byAlbum);
          }

          let entry = byAlbum.get(album.id);
          if (!entry) {
            entry = {
              id: album.id,
              name: meta.name,
              slug: meta.slug,
              subpageSlug: meta.subpageSlug,
              photoCount: 0,
              latSum: 0,
              lngSum: 0,
              coverAssetId: asset.id,
              ...(asset.isEdited === true
                ? { coverEdit: { isEdited: true as const, updatedAt: asset.updatedAt } }
                : {}),
            };
            byAlbum.set(album.id, entry);
          }
          entry.latSum += exif.latitude;
          entry.lngSum += exif.longitude;
          entry.photoCount++;
        }
      }

      // Convert buckets to MapLocation[]
      const locations: MapLocation[] = [];
      for (const [key, byAlbum] of buckets) {
        const [city, country] = key.split('|');
        locations.push({ city, country, albums: [...byAlbum.values()] });
      }

      cache.set(cacheKey, locations, config.cacheTtl);
      return locations;
    } finally {
      pendingMapDataPromise = null;
    }
  })();

  return pendingMapDataPromise;
}
