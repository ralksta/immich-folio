import type { AdminDictionary } from '../index';

/**
 * The building blocks the page builder and the journal studio share: the album
 * and photo pickers, the manual photo order editor, the block cards' drag grip
 * and type badges, and the screen reader announcements for drag and drop.
 */

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const pickers: AdminDictionary['pickers'] = {
  albumPicker: {
    title: 'Album kiezen',
    searchPlaceholder: 'Albums zoeken op naam of UUID…',
    empty: 'Geen albums gevonden. Controleer je verbinding met Immich en de toegangsrechten.',
    /** Under each album's name, before its description. */
    photoCount: (count: number) => `${count} ${count === 1 ? 'foto' : 'foto’s'}`,
    /** The album is private in Immich; publishing it still works. */
    notShared: 'Niet gedeeld in Immich',
    /** Badge on an album that is already on the site. */
    inUse: 'In gebruik',
    select: 'Kiezen',
  },

  assetPicker: {
    /** Heading when the caller names no purpose of its own. */
    defaultTitle: 'Foto kiezen',
    tabs: {
      albums: 'Albums',
      thisAlbum: 'Dit album',
      favorites: 'Favorieten',
      allPhotos: 'Alle foto’s',
    },
    filterAlbumPlaceholder: 'Dit album filteren op bestandsnaam…',
    searchPlaceholder: 'Zoek op bestandsnaam, beschrijving of een datum (2024-05)…',
    searchLabel: 'Foto’s zoeken',
    /** Accessible name of the photo grid. */
    gridLabel: 'Foto’s',
    noMatch: (query: string) => `Geen foto’s gevonden voor “${query}”.`,
    noFavorites:
      'Geen favoriete foto’s gevonden. Markeer eerst foto’s als favoriet in Immich, of kies “Alle foto’s”.',
    noPhotos: 'Geen foto’s gevonden.',
    /** Accessible name of a photo tile: file name, date and whether it is on the page already. */
    tileLabel: (fileName: string, date: string, used: boolean) =>
      `${fileName}, ${date}${used ? ' (al gebruikt)' : ''}`,
    /** Hints in the multi-select bar while nothing is picked. */
    pickAtLeast: (min: number) => `Kies minstens ${min} ${min === 1 ? 'foto' : 'foto’s'}`,
    pickUpTo: (max: number) => `Kies tot ${max} ${max === 1 ? 'foto' : 'foto’s'}`,
    pickPhotos: 'Kies foto’s',
    /**
     * The multi-select bar once something is picked. `max` is null when there
     * is no limit; `missing` is the required minimum while it is not reached.
     */
    selectedCount: (count: number, max: number | null, missing: number | null) =>
      `${count}${max !== null ? ` van ${max}` : ''} geselecteerd${
        missing !== null ? ` — selecteer er minstens ${missing}` : ''
      }`,
    clear: 'Wissen',
    addPhotos: (count: number) => (count > 1 ? `${count} foto’s toevoegen` : 'Foto toevoegen'),
    uuidPlaceholder: 'Of plak direct een asset-UUID…',
    uuidLabel: 'Asset-UUID',
    invalidUuid: 'Ongeldige UUID-notatie',
  },

  /** The editor for `sort: manual`: pinned photos first, the rest in Immich order. */
  orderEditor: {
    title: (albumName: string) => `Fotovolgorde — ${albumName}`,
    /** Pinned photos that were removed from the album in Immich. */
    dropped: (count: number) =>
      `${count} ${count === 1 ? 'vastgezette foto staat' : 'vastgezette foto’s staan'} niet meer in dit album. ${
        count === 1 ? 'Die wordt' : 'Die worden'
      } bij het opslaan uit de volgorde verwijderd.`,
    pinned: (count: number) => `Vastgezet (${count})`,
    unpinAll: 'Alles losmaken',
    nothingPinned:
      'Nog niets vastgezet — het album verschijnt in de Immich-volgorde. Zet de foto’s vast waarmee het album moet openen.',
    following: (count: number) => `Volgt automatisch (${count})`,
    pinAll: 'Alles vastzetten',
    followingHint:
      'Deze volgen na de vastgezette foto’s, in de Immich-volgorde van het album. Klik op een foto om die vast te zetten.',
    unpinTitle: 'Losmaken — deze foto automatisch laten volgen',
    unpin: (fileName: string) => `${fileName} losmaken`,
    pin: (fileName: string) => `${fileName} vastzetten`,
    apply: 'Volgorde toepassen',
  },

  sortable: {
    /** The grip on a block card. */
    dragToReorder: 'Sleep om te herschikken',
  },

  /** Block type chips on the block cards; keep them short. */
  badges: {
    paragraph: 'Tekst',
    heading: 'Kop',
    quote: 'Citaat',
    photo: 'Foto',
    photoPair: 'Fotopaar',
    photoGrid: 'Fotoraster',
    facts: 'Feiten',
    map: 'Kaart',
    album: 'Album',
  },

  /**
   * Screen reader announcements while dragging. `item` and `target` are what
   * the list shows, starting lowercase, e.g. `pagina “Tarieven”`.
   */
  dnd: {
    pickedUp: (item: string) => `${capitalise(item)} opgepakt.`,
    over: (item: string, target: string) => `${capitalise(item)} staat op de plaats van ${target}.`,
    notOver: (item: string) => `${capitalise(item)} is niet meer boven de lijst.`,
    dropped: (item: string, target: string) =>
      `${capitalise(item)} is neergezet op de plaats van ${target}.`,
    droppedOutside: (item: string) => `${capitalise(item)} is losgelaten.`,
    cancelled: (item: string) => `Verplaatsen van ${item} geannuleerd.`,
  },
};
