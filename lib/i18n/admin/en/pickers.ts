/**
 * The building blocks the page builder and the journal studio share: the album
 * and photo pickers, the manual photo order editor, the block cards' drag grip
 * and type badges, and the screen reader announcements for drag and drop.
 */

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const pickers = {
  albumPicker: {
    title: 'Select Album',
    searchPlaceholder: 'Search albums by name or UUID...',
    empty: 'No albums found. Check your Immich connection and access.',
    /** Under each album's name, before its description. */
    photoCount: (count: number) => `${count} photos`,
    /** The album is private in Immich; publishing it still works. */
    notShared: 'Not shared in Immich',
    /** Badge on an album that is already on the site. */
    inUse: 'In use',
    select: 'Select',
  },

  assetPicker: {
    /** Heading when the caller names no purpose of its own. */
    defaultTitle: 'Select Photo',
    tabs: {
      albums: 'Albums',
      thisAlbum: 'This Album',
      favorites: 'Favorites',
      allPhotos: 'All Photos',
    },
    filterAlbumPlaceholder: 'Filter this album by filename…',
    searchPlaceholder: 'Search filename, description, or a date (2024-05)…',
    searchLabel: 'Search photos',
    /** Accessible name of the photo grid. */
    gridLabel: 'Photos',
    noMatch: (query: string) => `No photos match “${query}”.`,
    noFavorites:
      'No favorite photos found. Star photos in Immich first, or switch to "All Photos".',
    noPhotos: 'No photos found.',
    /** Accessible name of a photo tile: file name, date and whether it is on the page already. */
    tileLabel: (fileName: string, date: string, used: boolean) =>
      `${fileName}, ${date}${used ? ' (already used)' : ''}`,
    /** Hints in the multi-select bar while nothing is picked. */
    pickAtLeast: (min: number) => `Pick at least ${min} photos`,
    pickUpTo: (max: number) => `Pick up to ${max} photos`,
    pickPhotos: 'Pick photos',
    /**
     * The multi-select bar once something is picked. `max` is null when there
     * is no limit; `missing` is the required minimum while it is not reached.
     */
    selectedCount: (count: number, max: number | null, missing: number | null) =>
      `${count}${max !== null ? ` of ${max}` : ''} selected${
        missing !== null ? ` — select at least ${missing}` : ''
      }`,
    clear: 'Clear',
    addPhotos: (count: number) => (count > 1 ? `Add ${count} photos` : 'Add photo'),
    uuidPlaceholder: 'Or paste asset UUID directly...',
    uuidLabel: 'Asset UUID',
    invalidUuid: 'Invalid UUID format',
  },

  /** The editor for `sort: manual`: pinned photos first, the rest in Immich order. */
  orderEditor: {
    title: (albumName: string) => `Photo order — ${albumName}`,
    /** Pinned photos that were removed from the album in Immich. */
    dropped: (count: number) =>
      `${count} pinned ${count === 1 ? 'photo is' : 'photos are'} no longer in this album. ${
        count === 1 ? 'It' : 'They'
      } will be removed from the order when you save.`,
    pinned: (count: number) => `Pinned (${count})`,
    unpinAll: 'Unpin all',
    nothingPinned:
      'Nothing pinned yet — the album shows in Immich order. Pin the photos that should open the album.',
    following: (count: number) => `Follows automatically (${count})`,
    pinAll: 'Pin all',
    followingHint:
      'These follow the pinned photos in the album’s Immich order. Click one to pin it.',
    unpinTitle: 'Unpin — let this photo follow automatically',
    unpin: (fileName: string) => `Unpin ${fileName}`,
    pin: (fileName: string) => `Pin ${fileName}`,
    apply: 'Apply order',
  },

  sortable: {
    /** The grip on a block card. */
    dragToReorder: 'Drag to reorder',
  },

  /** Block type chips on the block cards; keep them short. */
  badges: {
    paragraph: 'Text',
    heading: 'Heading',
    quote: 'Quote',
    photo: 'Photo',
    photoPair: 'Photo Pair',
    photoGrid: 'Photo Grid',
    facts: 'Facts',
    map: 'Map',
    album: 'Album',
  },

  /**
   * Screen reader announcements while dragging. `item` and `target` are what
   * the list shows, starting lowercase, e.g. `page "Pricing"`.
   */
  dnd: {
    pickedUp: (item: string) => `Picked up ${item}.`,
    over: (item: string, target: string) => `${capitalise(item)} is at the position of ${target}.`,
    notOver: (item: string) => `${capitalise(item)} is no longer over the list.`,
    dropped: (item: string, target: string) =>
      `${capitalise(item)} was dropped at the position of ${target}.`,
    droppedOutside: (item: string) => `${capitalise(item)} was dropped.`,
    cancelled: (item: string) => `Moving ${item} was cancelled.`,
  },
};
