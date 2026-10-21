export const MAP_TILE_PROVIDER_IDS = ['osm', 'carto-voyager', 'carto-dark-matter'] as const;

export type MapTileProviderId = (typeof MAP_TILE_PROVIDER_IDS)[number];

interface MapTileProviderDefinition {
  id: MapTileProviderId;
  label: string;
  tileUrl: string;
  attribution: string;
  cspOrigin: string;
  maxZoom: number;
  detectRetina: boolean;
  filterTiles: boolean;
  privacyName: string;
  requiresApiKey: boolean;
}

export const MAP_TILE_PROVIDERS: Record<MapTileProviderId, MapTileProviderDefinition> = {
  osm: {
    id: 'osm',
    label: 'OpenStreetMap',
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    cspOrigin: 'https://tile.openstreetmap.org',
    maxZoom: 19,
    detectRetina: false,
    filterTiles: true,
    privacyName: 'OpenStreetMap Foundation',
    requiresApiKey: false,
  },
  'carto-voyager': {
    id: 'carto-voyager',
    label: 'CARTO Voyager',
    tileUrl: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    cspOrigin: 'https://basemaps.cartocdn.com',
    maxZoom: 20,
    detectRetina: true,
    filterTiles: false,
    privacyName: 'CARTO',
    requiresApiKey: true,
  },
  'carto-dark-matter': {
    id: 'carto-dark-matter',
    label: 'CARTO Dark Matter',
    tileUrl: 'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    cspOrigin: 'https://basemaps.cartocdn.com',
    maxZoom: 20,
    detectRetina: true,
    filterTiles: false,
    privacyName: 'CARTO',
    requiresApiKey: true,
  },
};

export interface MapTilesConfig {
  provider: MapTileProviderId;
  apiKey?: string;
}

export interface MapTilesSettings {
  provider?: string;
  apiKey?: string;
}

export function isMapTileProvider(value: string): value is MapTileProviderId {
  return Object.hasOwn(MAP_TILE_PROVIDERS, value);
}

export function resolveMapTiles(settings?: MapTilesSettings, envApiKey?: string): MapTilesConfig {
  const provider =
    settings?.provider && isMapTileProvider(settings.provider) ? settings.provider : 'osm';
  const apiKey = envApiKey?.trim() || settings?.apiKey?.trim();
  return { provider, ...(apiKey ? { apiKey } : {}) };
}

export function getMapTileLayerOptions(config?: MapTilesConfig) {
  const providerId = config?.provider ?? 'osm';
  const provider = MAP_TILE_PROVIDERS[providerId];
  const apiKey = config?.apiKey?.trim();
  const url =
    provider.requiresApiKey && apiKey
      ? `${provider.tileUrl}?api_key=${encodeURIComponent(apiKey)}`
      : provider.tileUrl;

  return {
    url,
    attribution: provider.attribution,
    maxZoom: provider.maxZoom,
    detectRetina: provider.detectRetina,
    filterTiles: provider.filterTiles,
    cspOrigin: provider.cspOrigin,
    label: provider.label,
    privacyName: provider.privacyName,
  };
}
