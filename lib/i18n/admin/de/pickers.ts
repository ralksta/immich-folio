import type { AdminDictionary } from '../index';

/**
 * The building blocks the page builder and the journal studio share: the album
 * and photo pickers, the manual photo order editor, the block cards' drag grip
 * and type badges, and the screen reader announcements for drag and drop.
 */

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const pickers: AdminDictionary['pickers'] = {
  albumPicker: {
    title: 'Album wählen',
    searchPlaceholder: 'Alben nach Name oder UUID suchen...',
    empty: 'Keine Alben gefunden. Prüfe die Verbindung zu Immich und die Zugriffsrechte.',
    /** Under each album's name, before its description. */
    photoCount: (count: number) => `${count} ${count === 1 ? 'Foto' : 'Fotos'}`,
    /** The album is private in Immich; publishing it still works. */
    notShared: 'In Immich nicht geteilt',
    /** Badge on an album that is already on the site. */
    inUse: 'Verwendet',
    select: 'Wählen',
  },

  assetPicker: {
    /** Heading when the caller names no purpose of its own. */
    defaultTitle: 'Foto wählen',
    tabs: {
      albums: 'Alben',
      thisAlbum: 'Dieses Album',
      favorites: 'Favoriten',
      allPhotos: 'Alle Fotos',
    },
    filterAlbumPlaceholder: 'Dieses Album nach Dateiname filtern…',
    searchPlaceholder: 'Nach Dateiname, Beschreibung oder Datum (2024-05) suchen…',
    searchLabel: 'Fotos suchen',
    /** Accessible name of the photo grid. */
    gridLabel: 'Fotos',
    noMatch: (query: string) => `Keine Fotos passen zu „${query}“.`,
    noFavorites:
      'Keine Favoriten gefunden. Markiere zuerst Fotos in Immich mit einem Stern oder wechsle zu „Alle Fotos“.',
    noPhotos: 'Keine Fotos gefunden.',
    /** Accessible name of a photo tile: file name, date and whether it is on the page already. */
    tileLabel: (fileName: string, date: string, used: boolean) =>
      `${fileName}, ${date}${used ? ' (bereits verwendet)' : ''}`,
    /** Hints in the multi-select bar while nothing is picked. */
    pickAtLeast: (min: number) => `Wähle mindestens ${min} ${min === 1 ? 'Foto' : 'Fotos'}`,
    pickUpTo: (max: number) => `Wähle bis zu ${max} ${max === 1 ? 'Foto' : 'Fotos'}`,
    pickPhotos: 'Fotos wählen',
    /**
     * The multi-select bar once something is picked. `max` is null when there
     * is no limit; `missing` is the required minimum while it is not reached.
     */
    selectedCount: (count: number, max: number | null, missing: number | null) =>
      `${count}${max !== null ? ` von ${max}` : ''} ausgewählt${
        missing !== null ? ` — wähle mindestens ${missing}` : ''
      }`,
    clear: 'Leeren',
    addPhotos: (count: number) => (count > 1 ? `${count} Fotos hinzufügen` : 'Foto hinzufügen'),
    uuidPlaceholder: 'Oder Asset-UUID direkt einfügen...',
    uuidLabel: 'Asset-UUID',
    invalidUuid: 'Ungültiges UUID-Format',
  },

  /** The editor for `sort: manual`: pinned photos first, the rest in Immich order. */
  orderEditor: {
    title: (albumName: string) => `Fotoreihenfolge — ${albumName}`,
    /** Pinned photos that were removed from the album in Immich. */
    dropped: (count: number) =>
      count === 1
        ? `${count} angeheftetes Foto ist nicht mehr in diesem Album. Es wird beim Speichern aus der Reihenfolge entfernt.`
        : `${count} angeheftete Fotos sind nicht mehr in diesem Album. Sie werden beim Speichern aus der Reihenfolge entfernt.`,
    pinned: (count: number) => `Angeheftet (${count})`,
    unpinAll: 'Alle lösen',
    nothingPinned:
      'Noch nichts angeheftet — das Album erscheint in der Immich-Reihenfolge. Hefte die Fotos an, mit denen das Album beginnen soll.',
    following: (count: number) => `Folgen automatisch (${count})`,
    pinAll: 'Alle anheften',
    followingHint:
      'Diese folgen den angehefteten Fotos in der Immich-Reihenfolge des Albums. Klicke auf eines, um es anzuheften.',
    unpinTitle: 'Lösen — dieses Foto folgt dann automatisch',
    unpin: (fileName: string) => `${fileName} lösen`,
    pin: (fileName: string) => `${fileName} anheften`,
    apply: 'Reihenfolge übernehmen',
  },

  sortable: {
    /** The grip on a block card. */
    dragToReorder: 'Zum Umsortieren ziehen',
  },

  /** Block type chips on the block cards; keep them short. */
  badges: {
    paragraph: 'Text',
    heading: 'Überschrift',
    quote: 'Zitat',
    photo: 'Foto',
    photoPair: 'Fotopaar',
    photoGrid: 'Fotoraster',
    facts: 'Fakten',
    map: 'Karte',
    album: 'Album',
  },

  /**
   * Screen reader announcements while dragging. `item` and `target` are what
   * the list shows, e.g. `Seite „Preise“`. German labels start with a noun and
   * so are capitalised already; `capitalise` only guards a label that is not.
   */
  dnd: {
    pickedUp: (item: string) => `${capitalise(item)} aufgenommen.`,
    over: (item: string, target: string) => `${capitalise(item)} ist an der Stelle von ${target}.`,
    notOver: (item: string) => `${capitalise(item)} ist nicht mehr über der Liste.`,
    dropped: (item: string, target: string) =>
      `${capitalise(item)} wurde an der Stelle von ${target} abgelegt.`,
    droppedOutside: (item: string) => `${capitalise(item)} wurde abgelegt.`,
    cancelled: (item: string) => `Verschieben von ${item} abgebrochen.`,
  },
};
