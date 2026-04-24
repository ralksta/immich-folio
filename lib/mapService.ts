import { immich } from './immich';
import { getConfig } from './config';
import { cache } from './cache';

/** A clustered map marker — one per unique city/country. */
export interface MapLocation {
  city: string;
  country: string;
  lat: number;
  lng: number;
  photoCount: number;
  coverAssetId: string;
  albums: { name: string; slug: string; subpageSlug?: string }[];
}

/**
 * Aggregate all geotagged photos into location-level markers.
 * Returns one entry per unique city+country with averaged lat/lng.
 */
export async function getMapData(): Promise<MapLocation[]> {
  const config = getConfig();
  const cacheKey = 'map-data';
  const cached = cache.get<MapLocation[]>(cacheKey);
  if (cached) return cached;

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

  // Bucket assets by city+country
  const buckets = new Map<
    string,
    { lats: number[]; lngs: number[]; count: number; coverAssetId: string; albumIds: Set<string> }
  >();

  for (const album of fullAlbums) {
    if (!album) continue;
    for (const asset of album.assets) {
      const exif = asset.exifInfo;
      if (!exif?.latitude || !exif?.longitude || !exif?.city || !exif?.country) continue;

      const key = `${exif.city}|${exif.country}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { lats: [], lngs: [], count: 0, coverAssetId: asset.id, albumIds: new Set() };
        buckets.set(key, bucket);
      }
      bucket.lats.push(exif.latitude);
      bucket.lngs.push(exif.longitude);
      bucket.count++;
      bucket.albumIds.add(album.id);
    }
  }

  // Convert buckets to MapLocation[]
  const locations: MapLocation[] = [];
  for (const [key, bucket] of buckets) {
    const [city, country] = key.split('|');
    const lat = bucket.lats.reduce((a, b) => a + b, 0) / bucket.lats.length;
    const lng = bucket.lngs.reduce((a, b) => a + b, 0) / bucket.lngs.length;
    locations.push({
      city,
      country,
      lat,
      lng,
      photoCount: bucket.count,
      coverAssetId: bucket.coverAssetId,
      albums: [...bucket.albumIds]
        .map((id) => albumMeta.get(id))
        .filter((m): m is NonNullable<typeof m> => !!m),
    });
  }

  cache.set(cacheKey, locations, config.cacheTtl);
  return locations;
}
