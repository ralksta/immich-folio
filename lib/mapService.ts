import { immich } from './immich';
import { getConfig } from './config';
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
      const albums = await immich.getAlbums();

      // Build a lookup: album ID → { name, slug, subpageSlug? }
      const albumMeta = new Map<string, { name: string; slug: string; subpageSlug?: string }>();
      for (const a of albums) {
        // Check if this album belongs to a subpage
        const sp = config.subpages.find((s) => s.albumIds.includes(a.id));
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
          if (!exif?.latitude || !exif?.longitude || !exif?.city || !exif?.country) continue;

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
