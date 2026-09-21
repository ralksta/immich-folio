import { describe, it, expect } from 'vitest';
import {
  parseAlbumEntries,
  serializeAlbumEntries,
  hasAlbumOptions,
} from '../components/page-builder/albumEntries';
import type { AlbumEntryObject } from '@/lib/config/schema';

/**
 * The page builder rewrites gallery.yaml wholesale on every save, so a field it
 * does not know about is not merely ignored — it is deleted. `location` was
 * lost this way (#614): an album deliberately placed at city level, or hidden
 * from the map, silently went back to exact coordinates the next time anything
 * unrelated was saved.
 *
 * The round-trip test below is the part that matters. It is driven by a sample
 * entry carrying every key of AlbumEntryObject, so the next field added to the
 * schema and forgotten here fails this suite instead of quietly disappearing
 * from someone's configuration.
 */

const uuid = '11111111-1111-1111-1111-111111111111';

/**
 * One value per key of AlbumEntryObject. The type annotation is the enforcement:
 * adding a key to the schema without adding it here is a type error, and the
 * round-trip test then proves the builder preserves it.
 */
const everyOption: Required<Omit<AlbumEntryObject, 'grid'>> & Pick<AlbumEntryObject, 'grid'> = {
  title: 'Kloster Chorin',
  description: 'Brick gothic in the Uckermark',
  password: 'hunter2',
  heroImage: '22222222-2222-2222-2222-222222222222',
  sort: 'oldest',
  assetOrder: ['33333333-3333-3333-3333-333333333333'],
  coverPosition: '50% 25%',
  download: true,
  location: 'hidden',
  grid: { columns: 4, gap: 8, aspectRatio: '3/2', layout: 'masonry' },
};

describe('album entry round trip', () => {
  it('preserves every option a gallery.yaml entry can carry', () => {
    const parsed = parseAlbumEntries([{ [uuid]: everyOption }]);
    const [serialized] = serializeAlbumEntries(parsed);

    expect(serialized).toEqual({ [uuid]: everyOption });
  });

  it('keeps map precision across a save', () => {
    const parsed = parseAlbumEntries([{ [uuid]: { location: 'city' } }]);

    expect(parsed[0].location).toBe('city');
    expect(serializeAlbumEntries(parsed)).toEqual([{ [uuid]: { location: 'city' } }]);
  });

  it('does not collapse a location-only entry back to a bare id', () => {
    // This is the actual mechanism of the bug: an entry that looks "empty" is
    // written back as a plain UUID string, taking its options with it.
    const entry = { id: uuid, location: 'hidden' };

    expect(hasAlbumOptions(entry)).toBe(true);
    expect(serializeAlbumEntries([entry])).toEqual([{ [uuid]: { location: 'hidden' } }]);
  });

  it('carries a value this version does not recognise', () => {
    // Narrowing belongs to deriveGallery(), which rejects a typo loudly. The
    // builder's job is to hand back what it was given rather than drop it.
    const parsed = parseAlbumEntries([{ [uuid]: { location: 'district' } }]);

    expect(serializeAlbumEntries(parsed)).toEqual([{ [uuid]: { location: 'district' } }]);
  });

  it('still collapses an entry that really is bare', () => {
    expect(serializeAlbumEntries([{ id: uuid }])).toEqual([uuid]);
    expect(serializeAlbumEntries([{ id: uuid, title: 'Just a title' }])).toEqual([
      { [uuid]: 'Just a title' },
    ]);
  });
});
