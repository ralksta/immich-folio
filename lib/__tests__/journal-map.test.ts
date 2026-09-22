import { describe, it, expect } from 'vitest';
import { parseJournalMarkdown, serializeJournalMarkdown } from '../journal';
import type { JournalBlock } from '../journal';
import { pinsForEntry } from '../journalMap';
import type { LocationPrecision } from '../mapPrecision';

describe('map block syntax', () => {
  it('parses ::map with and without a caption', () => {
    expect(parseJournalMarkdown('::map').blocks).toEqual([{ type: 'map', caption: undefined }]);
    expect(parseJournalMarkdown('::map Busan → Seoul').blocks).toEqual([
      { type: 'map', caption: 'Busan → Seoul' },
    ]);
  });

  it('does not mistake ::mapping for a map', () => {
    expect(parseJournalMarkdown('::mapping things').blocks[0].type).toBe('paragraph');
  });

  it('round-trips and never writes pins to the file', () => {
    const block: JournalBlock = {
      type: 'map',
      caption: 'A <strong>trip</strong>',
      pins: [{ lat: 1, lng: 2, label: 'Somewhere' }],
    };
    const md = serializeJournalMarkdown({
      frontmatter: {},
      blocks: [block],
      referencedAssetIds: [],
    });
    expect(md).toBe('::map A **trip**');
    expect(parseJournalMarkdown(md).blocks).toEqual([
      { type: 'map', caption: 'A <strong>trip</strong>' },
    ]);
  });

  it('sits between other blocks and adds no asset references', () => {
    const parsed = parseJournalMarkdown('Intro.\n\n::map\n\n![abc123](x)');
    expect(parsed.blocks.map((b) => b.type)).toEqual(['paragraph', 'map', 'photo']);
    expect(parsed.referencedAssetIds).toEqual(['abc123']);
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

  it('keeps exact positions with a city, country label, in authoring order', () => {
    const pins = pinsForEntry(
      [asset('a', 35.1796, 129.0756), asset('b', 37.5665, 126.978, 'Seoul')],
      ['b', 'a'],
      exact,
    );
    expect(pins).toEqual([
      { lat: 37.5665, lng: 126.978, label: 'Seoul, South Korea' },
      { lat: 35.1796, lng: 129.0756, label: 'Busan, South Korea' },
    ]);
  });

  it('snaps city precision to the 0.05° grid and keeps the city name', () => {
    const pins = pinsForEntry(
      [asset('a', 52.5163, 13.3777, 'Berlin', 'Germany')],
      ['a'],
      () => 'city',
    );
    expect(pins).toEqual([{ lat: 52.5, lng: 13.4, label: 'Berlin, Germany' }]);
  });

  it('drops country and hidden precision entirely', () => {
    const levels: Record<string, LocationPrecision> = { a: 'country', b: 'hidden', c: 'exact' };
    const pins = pinsForEntry(
      [asset('a', 1, 1), asset('b', 2, 2), asset('c', 3, 3)],
      ['a', 'b', 'c'],
      (id) => levels[id],
    );
    expect(pins).toEqual([{ lat: 3, lng: 3, label: 'Busan, South Korea' }]);
  });

  it('skips photos without coordinates but keeps the equator (#635)', () => {
    const pins = pinsForEntry(
      [asset('a', null, null), asset('b', 0, 0, '', '')],
      ['a', 'b'],
      exact,
    );
    expect(pins).toEqual([{ lat: 0, lng: 0 }]);
  });

  it('merges photos at one quantised position into one pin', () => {
    const pins = pinsForEntry(
      [asset('a', 52.5163, 13.3777), asset('b', 52.5201, 13.3899)],
      ['a', 'b'],
      () => 'city',
    );
    expect(pins).toHaveLength(1);
  });

  it('ignores ids the page did not fetch', () => {
    expect(pinsForEntry([asset('a', 1, 1)], ['missing', 'a'], exact)).toHaveLength(1);
  });
});
