/**
 * Runtime map tile providers (#853).
 *
 * One table drives the Leaflet tile URL, attribution, CSP `img-src` origin,
 * CSS colour-filter opt-in and privacy policy facts, so they cannot drift
 * apart. Client-safe: no `fs` or `lib/env` imports.
 */

export const MAP_TILE_PROVIDER_IDS = [
  'osm',
  'carto-voyager',
  'carto-positron',
  'carto-dark-matter',
] as const;

export type MapTileProviderId = (typeof MAP_TILE_PROVIDER_IDS)[number];

export interface MapTileProviderDefinition {
  id: MapTileProviderId;
  label: string;
  tileUrl: string;
  attribution: string;
  cspOrigin: string;
  maxZoom: number;
  /** Apply the muted/inverted CSS filter in `app/leaflet.css`. */
  filterTiles: boolean;
  /** Provider name for privacy policy processing facts (`lib/privacy.ts`). */
  privacyName: string;
  /** Short name used in the second sentence of the privacy fact. */
  privacyShortName: string;
  requiresApiKey: boolean;
}

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const MAP_TILE_PROVIDERS: Record<MapTileProviderId, MapTileProviderDefinition> = {
  osm: {
    id: 'osm',
    label: 'OpenStreetMap',
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    cspOrigin: 'https://tile.openstreetmap.org',
    maxZoom: 19,
    filterTiles: true,
    privacyName: 'OpenStreetMap Foundation, UK',
    privacyShortName: 'OSM',
    requiresApiKey: false,
  },
  // `{r}` already substitutes `@2x` on high-DPI displays in Leaflet — do NOT
  // pair it with `detectRetina: true`, which would also step up a zoom level
  // and fetch four half-size @2x tiles.
  'carto-voyager': {
    id: 'carto-voyager',
    label: 'CARTO Voyager',
    tileUrl: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: CARTO_ATTRIBUTION,
    cspOrigin: 'https://basemaps.cartocdn.com',
    maxZoom: 20,
    filterTiles: false,
    privacyName: 'CARTO',
    privacyShortName: 'CARTO',
    requiresApiKey: true,
  },
  'carto-positron': {
    id: 'carto-positron',
    label: 'CARTO Positron',
    tileUrl: 'https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png',
    attribution: CARTO_ATTRIBUTION,
    cspOrigin: 'https://basemaps.cartocdn.com',
    maxZoom: 20,
    filterTiles: false,
    privacyName: 'CARTO',
    privacyShortName: 'CARTO',
    requiresApiKey: true,
  },
  'carto-dark-matter': {
    id: 'carto-dark-matter',
    label: 'CARTO Dark Matter',
    tileUrl: 'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png',
    attribution: CARTO_ATTRIBUTION,
    cspOrigin: 'https://basemaps.cartocdn.com',
    maxZoom: 20,
    filterTiles: false,
    privacyName: 'CARTO',
    privacyShortName: 'CARTO',
    requiresApiKey: true,
  },
};

export interface MapTilesConfig {
  provider: MapTileProviderId;
  /** Present only when the resolved provider requires a key. */
  apiKey?: string;
}

export interface MapTilesSettings {
  provider?: string;
  apiKey?: string;
}

export function isMapTileProvider(value: string): value is MapTileProviderId {
  return Object.hasOwn(MAP_TILE_PROVIDERS, value);
}

/**
 * Resolve runtime tile settings into what pages, CSP and privacy facts use.
 *
 * - Unknown providers fall back to OpenStreetMap.
 * - Providers that need no key never receive an `apiKey`, so `CARTO_API_KEY`
 *   cannot leak into page payloads while OpenStreetMap is selected.
 * - Providers that require a key fall back to OpenStreetMap when no key is
 *   configured, avoiding broken "API KEY REQUIRED" tiles (#701).
 */
export function resolveMapTiles(settings?: MapTilesSettings, envApiKey?: string): MapTilesConfig {
  const requested: MapTileProviderId =
    settings?.provider && isMapTileProvider(settings.provider) ? settings.provider : 'osm';
  const def = MAP_TILE_PROVIDERS[requested];

  if (!def.requiresApiKey) {
    return { provider: requested };
  }

  const apiKey = envApiKey?.trim() || settings?.apiKey?.trim();
  if (!apiKey) {
    return { provider: 'osm' };
  }

  return { provider: requested, apiKey };
}

export function getMapTileLayerOptions(config?: MapTilesConfig) {
  const requestedId: MapTileProviderId =
    config?.provider && isMapTileProvider(config.provider) ? config.provider : 'osm';
  const requested = MAP_TILE_PROVIDERS[requestedId];
  const apiKey = config?.apiKey?.trim();
  const provider = requested.requiresApiKey && !apiKey ? MAP_TILE_PROVIDERS.osm : requested;

  const url =
    provider.requiresApiKey && apiKey
      ? `${provider.tileUrl}?key=${encodeURIComponent(apiKey)}`
      : provider.tileUrl;

  return {
    id: provider.id,
    url,
    attribution: provider.attribution,
    maxZoom: provider.maxZoom,
    filterTiles: provider.filterTiles,
    cspOrigin: provider.cspOrigin,
    label: provider.label,
    privacyName: provider.privacyName,
    privacyShortName: provider.privacyShortName,
  };
}
