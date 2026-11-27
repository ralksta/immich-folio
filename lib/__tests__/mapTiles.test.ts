import { describe, expect, it } from 'vitest';
import {
  getMapTileLayerOptions,
  MAP_TILE_PROVIDERS,
  MAP_TILE_PROVIDER_IDS,
  resolveMapTiles,
} from '../mapTiles';

describe('runtime map tile providers (#853)', () => {
  it('defaults to OpenStreetMap with no API key and CSS tile filtering enabled', () => {
    const config = resolveMapTiles();
    const options = getMapTileLayerOptions(config);

    expect(config).toEqual({ provider: 'osm' });
    expect(options.id).toBe('osm');
    expect(options.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(options.cspOrigin).toBe('https://tile.openstreetmap.org');
    expect(options.filterTiles).toBe(true);
    expect(options.privacyName).toBe('OpenStreetMap Foundation, UK');
    expect(options.privacyShortName).toBe('OSM');
  });

  it('never leaks CARTO_API_KEY when OpenStreetMap is selected', () => {
    const config = resolveMapTiles({ provider: 'osm', apiKey: 'yaml-key' }, 'env-secret-key');
    expect(config).toEqual({ provider: 'osm' });
    expect('apiKey' in config).toBe(false);

    const defaultConfig = resolveMapTiles(undefined, 'env-secret-key');
    expect(defaultConfig).toEqual({ provider: 'osm' });
    expect('apiKey' in defaultConfig).toBe(false);
  });

  it('falls back to OpenStreetMap when a CARTO style is selected without a key', () => {
    expect(resolveMapTiles({ provider: 'carto-voyager' })).toEqual({ provider: 'osm' });
    expect(resolveMapTiles({ provider: 'carto-positron', apiKey: '   ' }, '  ')).toEqual({
      provider: 'osm',
    });
    expect(resolveMapTiles({ provider: 'carto-dark-matter' })).toEqual({ provider: 'osm' });

    // Defense in depth: even a manually constructed unkeyed CARTO config falls back.
    const unkeyed = getMapTileLayerOptions({ provider: 'carto-voyager' });
    expect(unkeyed.id).toBe('osm');
    expect(unkeyed.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(unkeyed.cspOrigin).toBe('https://tile.openstreetmap.org');
    expect(unkeyed.filterTiles).toBe(true);
  });

  it('builds ?key= retina tile URLs for all CARTO styles without CSS inversion', () => {
    const key = 'test/key value';
    const voyager = getMapTileLayerOptions({ provider: 'carto-voyager', apiKey: key });
    const positron = getMapTileLayerOptions({ provider: 'carto-positron', apiKey: key });
    const dark = getMapTileLayerOptions({ provider: 'carto-dark-matter', apiKey: key });

    expect(voyager.url).toBe(
      'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=test%2Fkey%20value',
    );
    expect(positron.url).toBe(
      'https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?key=test%2Fkey%20value',
    );
    expect(dark.url).toBe(
      'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=test%2Fkey%20value',
    );

    for (const opts of [voyager, positron, dark]) {
      expect(opts.cspOrigin).toBe('https://basemaps.cartocdn.com');
      expect(opts.filterTiles).toBe(false);
      expect(opts.maxZoom).toBe(20);
      expect(opts.privacyName).toBe('CARTO');
    }
  });

  it('prefers the runtime CARTO_API_KEY env var and falls back for unknown providers', () => {
    expect(
      resolveMapTiles({ provider: 'carto-voyager', apiKey: 'settings-key' }, ' env-key '),
    ).toEqual({ provider: 'carto-voyager', apiKey: 'env-key' });
    expect(resolveMapTiles({ provider: 'carto-positron', apiKey: ' settings-key ' })).toEqual({
      provider: 'carto-positron',
      apiKey: 'settings-key',
    });
    expect(resolveMapTiles({ provider: 'future-provider', apiKey: 'k' }, 'env-k')).toEqual({
      provider: 'osm',
    });
  });

  it('exposes every supported provider in the central table', () => {
    expect(MAP_TILE_PROVIDER_IDS).toEqual([
      'osm',
      'carto-voyager',
      'carto-positron',
      'carto-dark-matter',
    ]);
    expect(MAP_TILE_PROVIDERS.osm.attribution).toContain('OpenStreetMap');
    expect(MAP_TILE_PROVIDERS['carto-dark-matter'].attribution).toContain('CARTO');
  });
});
