import { describe, it, expect } from 'vitest';
import {
  parseJournalMarkdown,
  serializeJournalMarkdown,
  collectAssetIds,
  mapBlockAssetIds,
} from '../journal';
import type { JournalBlock } from '../journal';
import { pinsForEntry } from '../journalMap';
import type { LocationPrecision } from '../mapPrecision';

const mapBlock = (md: string) => parseJournalMarkdown(md).blocks[0];

describe('map block syntax', () => {
  it('parses ::map with and without a caption, empty by default', () => {
    expect(mapBlock('::map')).toEqual({ type: 'map', caption: undefined, line: true, items: [] });
    expect(mapBlock('::map Busan → Seoul')).toMatchObject({ caption: 'Busan → Seoul' });
  });

  it('does not mistake ::mapping for a map', () => {
    expect(mapBlock('::mapping things').type).toBe('paragraph');
  });

  it('reads every line form, in order', () => {
    const block = mapBlock(
      [
        '::map The trip',
        'Busan harbour: 35.098, 129.036',
        'photo: aaa, bbb',
        'photos: all',
        '37.566, 126.978',
        'Photo: ccc',
        'line: off',
      ].join('\n'),
    );
    expect(block).toEqual({
      type: 'map',
      caption: 'The trip',
      line: false,
      items: [
        { kind: 'point', label: 'Busan harbour', lat: 35.098, lng: 129.036 },
        { kind: 'photo', assetId: 'aaa' },
        { kind: 'photo', assetId: 'bbb' },
        { kind: 'all-photos' },
        { kind: 'point', lat: 37.566, lng: 126.978 },
        { kind: 'photo', assetId: 'ccc' },
      ],
    });
  });

  it('ignores malformed and out-of-range coordinates and unknown lines', () => {
    const block = mapBlock(
      [
        '::map',
        'Nowhere: 95, 10',
        'Also: 10, 200',
        'Text without numbers',
        '1.5',
        'Ok: -33.9, 151.2',
      ].join('\n'),
    );
    expect(block).toMatchObject({
      items: [{ kind: 'point', label: 'Ok', lat: -33.9, lng: 151.2 }],
    });
  });

  it('round-trips byte-stable and never writes pins', () => {
    const block: JournalBlock = {
      type: 'map',
      caption: 'A <strong>trip</strong>',
      line: false,
      items: [
        { kind: 'point', label: 'Start', lat: 52.51, lng: 13.47 },
        { kind: 'photo', assetId: 'abc' },
        { kind: 'all-photos' },
        { kind: 'point', lat: 52.4, lng: 13.04 },
      ],
      pins: [{ lat: 1, lng: 2, label: 'never' }],
    };
    const md = serializeJournalMarkdown({
      frontmatter: {},
      blocks: [block],
      referencedAssetIds: [],
    });
    expect(md).toBe(
      [
        '::map A **trip**',
        'Start: 52.51, 13.47',
        'photo: abc',
        'photos: all',
        '52.4, 13.04',
        'line: off',
      ].join('\n'),
    );
    const reparsed = parseJournalMarkdown(md);
    const { pins: _pins, ...withoutPins } = block;
    expect(reparsed.blocks).toEqual([{ ...withoutPins, caption: 'A <strong>trip</strong>' }]);
    expect(serializeJournalMarkdown(reparsed)).toBe(md);
  });

  it('drops invalid points and empty photo placeholders on save', () => {
    const block: JournalBlock = {
      type: 'map',
      line: true,
      items: [
        { kind: 'point', lat: Number.NaN, lng: Number.NaN },
        { kind: 'photo', assetId: '' },
        { kind: 'point', label: 'Kept', lat: 1, lng: 2 },
      ],
    };
    expect(
      serializeJournalMarkdown({ frontmatter: {}, blocks: [block], referencedAssetIds: [] }),
    ).toBe('::map\nKept: 1, 2');
  });

  it('collects and maps the ids of photo pins', () => {
    const block: JournalBlock = {
      type: 'map',
      line: true,
      items: [
        { kind: 'photo', assetId: 'abc' },
        { kind: 'all-photos' },
        { kind: 'photo', assetId: '' },
      ],
    };
    expect(collectAssetIds([block])).toEqual(['abc']);
    expect(mapBlockAssetIds(block, (id) => `t:${id}`)).toMatchObject({
      items: [
        { kind: 'photo', assetId: 't:abc' },
        { kind: 'all-photos' },
        { kind: 'photo', assetId: 't:' },
      ],
    });
  });
});

const asset = (
  id: string,
  lat: number | null,
  lng: number | null,
  city = 'Busan',
  country = 'South Korea',
) => ({
  id,
  exifInfo: {
    latitude: lat,
    longitude: lng,
    city,
    country,
  } as unknown as NonNullable<import('../immich').ImmichAsset['exifInfo']>,
});

describe('pinsForEntry', () => {
  const exact = (): LocationPrecision => 'exact';

  it('publishes typed points as typed, no snapping, no label invented', () => {
    const pins = pinsForEntry(
      [
        { kind: 'point', label: 'Harbour', lat: 35.098123, lng: 129.036456 },
        { kind: 'point', lat: 37.5, lng: 127 },
      ],
      [],
      [],
      exact,
    );
    expect(pins).toEqual([
      { lat: 35.098123, lng: 129.036456, label: 'Harbour' },
      { lat: 37.5, lng: 127 },
    ]);
  });

  it('places a photo pin on the 1 km grid with the city label', () => {
    const pins = pinsForEntry(
      [{ kind: 'photo', assetId: 'a' }],
      [asset('a', 52.510044, 13.467244, 'Berlin', 'Germany')],
      [],
      exact,
    );
    expect(pins).toEqual([{ lat: 52.51, lng: 13.47, label: 'Berlin, Germany' }]);
  });

  it('expands photos: all in entry order, skipping ids listed explicitly', () => {
    const assets = [asset('a', 1, 1), asset('b', 2, 2), asset('c', 3, 3)];
    const pins = pinsForEntry(
      [{ kind: 'photo', assetId: 'c' }, { kind: 'all-photos' }],
      assets,
      ['a', 'b', 'c'],
      exact,
    );
    expect(pins.map((p) => [p.lat, p.lng])).toEqual([
      [3, 3],
      [1, 1],
      [2, 2],
    ]);
  });

  it('keeps the drawing order across mixed items', () => {
    const pins = pinsForEntry(
      [
        { kind: 'point', label: 'Start', lat: 0.5, lng: 0.5 },
        { kind: 'photo', assetId: 'a' },
        { kind: 'point', label: 'End', lat: 9, lng: 9 },
      ],
      [asset('a', 1, 1)],
      ['a'],
      exact,
    );
    expect(pins.map((p) => p.label)).toEqual(['Start', 'Busan, South Korea', 'End']);
  });

  it('applies precision to photo pins only: city snaps, country and hidden vanish', () => {
    const levels: Record<string, LocationPrecision> = { a: 'city', b: 'country', c: 'hidden' };
    const pins = pinsForEntry(
      [{ kind: 'all-photos' }, { kind: 'point', lat: 52.5163, lng: 13.3777 }],
      [asset('a', 52.5163, 13.3777, 'Berlin', 'Germany'), asset('b', 2, 2), asset('c', 3, 3)],
      ['a', 'b', 'c'],
      (id) => levels[id],
    );
    expect(pins).toEqual([
      { lat: 52.5, lng: 13.4, label: 'Berlin, Germany' },
      { lat: 52.5163, lng: 13.3777 },
    ]);
  });

  it('skips photos without coordinates but keeps the equator (#635)', () => {
    const pins = pinsForEntry(
      [{ kind: 'all-photos' }],
      [asset('a', null, null), asset('b', 0, 0, '', '')],
      ['a', 'b'],
      exact,
    );
    expect(pins).toEqual([{ lat: 0, lng: 0 }]);
  });

  it('merges items at one position into one pin', () => {
    const pins = pinsForEntry(
      [
        { kind: 'point', lat: 52.51, lng: 13.47 },
        { kind: 'photo', assetId: 'a' },
      ],
      [asset('a', 52.510044, 13.467244)],
      [],
      exact,
    );
    expect(pins).toHaveLength(1);
  });

  it('ignores photo items the page did not fetch', () => {
    expect(pinsForEntry([{ kind: 'photo', assetId: 'missing' }], [], [], exact)).toEqual([]);
  });
});
