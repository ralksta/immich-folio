import { describe, it, expect } from 'vitest';
import { parseGalleryYaml, serializeGallery } from '../components/page-builder/galleryYaml';
import type { GalleryYaml } from '@/lib/config/schema';

/**
 * #608: gallery.yaml ⇄ the page builder's model. This is what decides what the
 * builder writes on save, and until it left PageBuilder.tsx nothing tested it.
 * Album entries themselves are covered in album-entries-round-trip.test.ts.
 */

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

/** Load and save once, the way the builder does without any edit in between. */
const roundTrip = (yaml: Record<string, unknown>) => serializeGallery(parseGalleryYaml(yaml));

describe('gallery.yaml round trip', () => {
  it('keeps hero photos, standalone albums and a plain subpage', () => {
    const yaml = {
      hero: ['h1', 'h2'],
      albums: [A],
      subpages: [{ name: 'Japan', albums: [B] }],
    };
    expect(roundTrip(yaml)).toEqual(yaml);
  });

  it('turns a single hero string into a list', () => {
    expect(roundTrip({ hero: 'h1' })).toEqual({ hero: ['h1'] });
  });

  it('leaves empty groups out instead of writing empty lists', () => {
    expect(roundTrip({ hero: [], albums: [], subpages: [] })).toEqual({});
  });

  it('keeps every subpage field the builder knows', () => {
    const sp = {
      name: 'Clients',
      title: 'For clients',
      subtitle: 'Handover',
      password: 'scrypt:aa:bb',
      enabled: false,
      hidden: true,
      essayText: 'Text',
      essayFile: 'story',
      grid: { columns: 4, layout: 'justified' },
      coverGrid: { columns: 2, gap: 8 },
      location: 'city',
      albums: [A],
    };
    expect(roundTrip({ subpages: [sp] })).toEqual({ subpages: [sp] });
  });

  it('writes enabled and hidden only when they differ from the default', () => {
    const out = roundTrip({ subpages: [{ name: 'P', enabled: true, hidden: false, albums: [A] }] });
    expect(out).toEqual({ subpages: [{ name: 'P', albums: [A] }] });
  });

  it('keeps sections, and page-level albums next to them only when there are any', () => {
    const withSections = {
      subpages: [
        {
          name: 'Trips',
          sections: [
            { title: 'North', description: 'Cold', albums: [A] },
            { title: 'South', albums: [B] },
          ],
        },
      ],
    };
    expect(roundTrip(withSections)).toEqual(withSections);

    const both = {
      subpages: [{ name: 'Trips', albums: [B], sections: [{ title: 'North', albums: [A] }] }],
    };
    expect(roundTrip(both)).toEqual({
      subpages: [{ name: 'Trips', sections: [{ title: 'North', albums: [A] }], albums: [B] }],
    });
  });

  it('converts the older name → albums map into the list the builder writes', () => {
    expect(
      roundTrip({ subpages: { Japan: [A], Korea: { title: 'South Korea', albums: [B] } } }),
    ).toEqual({
      subpages: [
        { name: 'Japan', albums: [A] },
        { name: 'Korea', title: 'South Korea', albums: [B] },
      ],
    });
  });

  /*
   * #523 split `grid` into photo grid and cover grid. A pre-#523 page keeps
   * its cover columns and gap by being seeded from `grid` on load, so the
   * first save writes the split out explicitly.
   */
  it('seeds the cover grid from a pre-#523 grid', () => {
    const out = roundTrip({
      subpages: [{ name: 'Old', grid: { columns: 3, gap: 10, layout: 'masonry' }, albums: [A] }],
    });
    expect(out).toEqual({
      subpages: [
        {
          name: 'Old',
          grid: { columns: 3, gap: 10, layout: 'masonry' },
          coverGrid: { columns: 3, gap: 10 },
          albums: [A],
        },
      ],
    });
  });

  it('is stable: a second round trip changes nothing', () => {
    const once = roundTrip({
      hero: 'h1',
      subpages: { Japan: { grid: { columns: 2 }, albums: [A] } },
    });
    expect(roundTrip(once)).toEqual(once);
  });
});

/**
 * The builder rewrites gallery.yaml wholesale on every save, so a subpage key
 * it does not carry is deleted, not ignored. `proofing` was lost this way: a
 * page switched off for client proofing by hand came back on after any
 * unrelated save in the admin. Same lesson as #614 for album entries.
 *
 * The type annotation is the enforcement: every key the schema allows on a
 * subpage has to be listed here, so the next one added and forgotten in
 * galleryYaml.ts fails this test instead of vanishing from someone's file.
 */
type SubpageYaml = Extract<NonNullable<GalleryYaml['subpages']>, unknown[]>[number];

const everySubpageKey: Required<SubpageYaml> = {
  name: 'Clients',
  title: 'For clients',
  subtitle: 'Handover',
  albums: [A],
  sections: [{ title: 'North', description: 'Cold', albums: [B] }],
  password: 'scrypt:aa:bb',
  proofing: false,
  zoom: true,
  essayFile: 'story',
  essayText: 'Text',
  enabled: false,
  hidden: true,
  location: 'city',
  grid: { columns: 4, gap: 6, aspectRatio: '3/2', layout: 'justified' },
  coverGrid: { columns: 2, gap: 8, aspectRatio: '1', layout: 'masonry' },
};

describe('subpage keys', () => {
  it('survives a round trip with every key the schema allows', () => {
    expect(roundTrip({ subpages: [everySubpageKey] })).toEqual({ subpages: [everySubpageKey] });
  });

  it('keeps proofing in either direction, and writes nothing when unset', () => {
    const on = { name: 'P', proofing: true, albums: [A] };
    expect(roundTrip({ subpages: [on] })).toEqual({ subpages: [on] });
    expect(roundTrip({ subpages: [{ name: 'P', albums: [A] }] })).toEqual({
      subpages: [{ name: 'P', albums: [A] }],
    });
  });
});

describe('subpage zoom (#467)', () => {
  it('keeps zoom in either direction, and writes nothing when unset', () => {
    const off = { name: 'Z', zoom: false, albums: [A] };
    const on = { name: 'Z', zoom: true, albums: [A] };
    expect(roundTrip({ subpages: [off] })).toEqual({ subpages: [off] });
    expect(roundTrip({ subpages: [on] })).toEqual({ subpages: [on] });
    expect(roundTrip({ subpages: [{ name: 'Z', albums: [A] }] })).toEqual({
      subpages: [{ name: 'Z', albums: [A] }],
    });
  });
});

describe('content page references (#722)', () => {
  it('keeps `- page:` entries where they were among the subpages', () => {
    const yaml = {
      subpages: [
        { page: 'pricing' },
        { name: 'Japan', albums: [A] },
        { page: 'faq' },
        { name: 'Korea', albums: [B] },
        { page: 'contact-me' },
      ],
    };
    expect(roundTrip(yaml)).toEqual(yaml);
  });

  it('parses page references apart from the subpages', () => {
    const g = parseGalleryYaml({ subpages: [{ name: 'Japan', albums: [A] }, { page: 'faq' }] });
    expect(g.subpages.map((s) => s.name)).toEqual(['Japan']);
    expect(g.pageRefs).toEqual([{ slug: 'faq', position: 1 }]);
  });

  it('writes a menu of pages only', () => {
    const yaml = { subpages: [{ page: 'pricing' }] };
    expect(roundTrip(yaml)).toEqual(yaml);
  });
});
