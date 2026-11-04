/**
 * The photo grid layouts, named once (#691).
 *
 * Settings › Grid, an album's layout override and a page's layout all offer
 * the same list, so their labels and descriptions live in `common.layouts` of
 * the admin dictionaries and every picker reads them through here. Before
 * #691 each picker carried its own copy, and they had drifted: the page sheet
 * lacked `justified` and described `uniform` differently.
 *
 * The ids are the values written to `grid.layout` in gallery.yaml and
 * settings.yaml. They are content — never rename one, only its label.
 *
 * Client-safe: no `fs`, so client components may import it.
 */

/** Layouts offered wherever photos are tiled — settings, a page, an album. */
export const PHOTO_LAYOUTS = [
  'masonry',
  'uniform',
  'showcase',
  'filmstrip',
  'editorial-flow',
  'justified',
] as const;

/**
 * A page can also be rendered as a story (`grid.layout: essay`). An album or
 * the site-wide default cannot: there is no essay to render without a page.
 */
export const STORY_LAYOUT = 'essay';

/** Every layout a page may choose. */
export const PAGE_LAYOUTS = [...PHOTO_LAYOUTS, STORY_LAYOUT] as const;

export type PhotoLayout = (typeof PHOTO_LAYOUTS)[number];
export type PageLayout = (typeof PAGE_LAYOUTS)[number];
