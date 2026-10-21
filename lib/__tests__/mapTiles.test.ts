import { describe, expect, it } from 'vitest';
import { getMapTileLayerOptions, MAP_TILE_PROVIDERS, resolveMapTiles } from '../mapTiles';

describe('runtime map tile providers', () => {
  it('defaults to OpenStreetMap without an API key or retina substitution', () => {
    const config = resolveMapTiles();
    const options = getMapTileLayerOptions(config);

    expect(config).toEqual({ provider: 'osm' });
    expect(options.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(options.cspOrigin).toBe('https://tile.openstreetmap.org');
    expect(options.detectRetina).toBe(false);
    expect(options.filterTiles).toBe(true);
  });

  it('builds keyed retina URLs for both CARTO styles', () => {
    const key = 'test/key value';
    const voyager = getMapTileLayerOptions({ provider: 'carto-voyager', apiKey: key });
    const dark = getMapTileLayerOptions({ provider: 'carto-dark-matter', apiKey: key });

    expect(voyager.url).toBe(
      'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?api_key=test%2Fkey%20value',
    );
    expect(dark.url).toContain('/rastertiles/dark_all/');
    expect(voyager.cspOrigin).toBe('https://basemaps.cartocdn.com');
    expect(voyager.detectRetina).toBe(true);
    expect(voyager.filterTiles).toBe(false);
    expect(dark.filterTiles).toBe(false);
  });

  it('prefers the runtime environment key and falls back safely for unknown providers', () => {
    expect(
      resolveMapTiles({ provider: 'carto-voyager', apiKey: 'settings-key' }, ' env-key '),
    ).toEqual({ provider: 'carto-voyager', apiKey: 'env-key' });
    expect(resolveMapTiles({ provider: 'unknown' })).toEqual({ provider: 'osm' });
  });

  it('keeps the provider metadata centralized', () => {
    expect(MAP_TILE_PROVIDERS['carto-dark-matter'].privacyName).toBe('CARTO');
    expect(MAP_TILE_PROVIDERS.osm.attribution).toContain('OpenStreetMap');
  });
});
