import type { AdminDictionary } from '../index';

/**
 * The building blocks the page builder and the journal studio share: the album
 * and photo pickers, the manual photo order editor, the block cards' drag grip
 * and type badges, and the screen reader announcements for drag and drop.
 */

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const pickers: AdminDictionary['pickers'] = {
  albumPicker: {
    title: 'Seleziona un album',
    searchPlaceholder: 'Cerca album per nome o UUID...',
    empty: 'Nessun album trovato. Controlla la connessione a Immich e i permessi di accesso.',
    /** Under each album's name, before its description. */
    photoCount: (count: number) => `${count} foto`,
    /** The album is private in Immich; publishing it still works. */
    notShared: 'Non condiviso in Immich',
    /** Badge on an album that is already on the site. */
    inUse: 'In uso',
    select: 'Seleziona',
  },

  assetPicker: {
    /** Heading when the caller names no purpose of its own. */
    defaultTitle: 'Seleziona l’immagine hero',
    tabs: {
      albums: 'Album',
      thisAlbum: 'Questo album',
      favorites: 'Preferiti',
      allPhotos: 'Tutte le foto',
    },
    filterAlbumPlaceholder: 'Filtra questo album per nome del file…',
    searchPlaceholder: 'Cerca per nome del file, descrizione o data (2024-05)…',
    searchLabel: 'Cerca foto',
    /** Accessible name of the photo grid. */
    gridLabel: 'Foto',
    noMatch: (query: string) => `Nessuna foto corrisponde a «${query}».`,
    noFavorites:
      'Nessuna foto preferita trovata. Prima aggiungi delle foto ai preferiti in Immich, oppure passa a «Tutte le foto».',
    noPhotos: 'Nessuna foto trovata.',
    /** Accessible name of a photo tile: file name, date and whether it is on the page already. */
    tileLabel: (fileName: string, date: string, used: boolean) =>
      `${fileName}, ${date}${used ? ' (già usata)' : ''}`,
    /** Hints in the multi-select bar while nothing is picked. */
    pickAtLeast: (min: number) => `Scegli almeno ${min} foto`,
    pickUpTo: (max: number) => `Scegli fino a ${max} foto`,
    pickPhotos: 'Scegli le foto',
    /**
     * The multi-select bar once something is picked. `max` is null when there
     * is no limit; `missing` is the required minimum while it is not reached.
     */
    selectedCount: (count: number, max: number | null, missing: number | null) =>
      `${count}${max !== null ? ` di ${max}` : ''} ${count === 1 ? 'selezionata' : 'selezionate'}${
        missing !== null ? ` — selezionane almeno ${missing}` : ''
      }`,
    clear: 'Deseleziona',
    addPhotos: (count: number) => (count > 1 ? `Aggiungi ${count} foto` : 'Aggiungi la foto'),
    uuidPlaceholder: 'Oppure incolla direttamente l’UUID dell’asset...',
    uuidLabel: 'UUID dell’asset',
    invalidUuid: 'Formato UUID non valido',
  },

  /** The editor for `sort: manual`: pinned photos first, the rest in Immich order. */
  orderEditor: {
    title: (albumName: string) => `Ordine delle foto — ${albumName}`,
    loadFailed: 'Impossibile caricare da Immich le foto dell’album.',
    /** Pinned photos that were removed from the album in Immich. */
    dropped: (count: number) =>
      `${count} ${count === 1 ? 'foto fissata non è' : 'foto fissate non sono'} più in questo album. ${
        count === 1 ? 'Verrà rimossa' : 'Verranno rimosse'
      } dall’ordine al salvataggio.`,
    pinned: (count: number) => `Fissate (${count})`,
    unpinAll: 'Sblocca tutte',
    nothingPinned:
      'Ancora nessuna foto fissata: l’album appare nell’ordine di Immich. Fissa le foto che devono aprire l’album.',
    following: (count: number) => `Seguono automaticamente (${count})`,
    pinAll: 'Fissa tutte',
    followingHint:
      'Queste seguono le foto fissate, nell’ordine dell’album in Immich. Fai clic su una foto per fissarla.',
    unpinTitle: 'Sblocca: lascia che questa foto segua automaticamente',
    unpin: (fileName: string) => `Sblocca ${fileName}`,
    pin: (fileName: string) => `Fissa ${fileName}`,
    apply: 'Applica l’ordine',
  },

  sortable: {
    /** The grip on a block card. */
    dragToReorder: 'Trascina per riordinare',
  },

  /** Block type chips on the block cards; keep them short. */
  badges: {
    paragraph: 'Testo',
    heading: 'Titolo',
    quote: 'Citazione',
    photo: 'Foto',
    photoPair: 'Coppia di foto',
    photoGrid: 'Griglia di foto',
    facts: 'Dati',
    map: 'Mappa',
    album: 'Album',
  },

  /**
   * Screen reader announcements while dragging. `item` and `target` are what
   * the list shows, starting lowercase and with their article, e.g.
   * `la pagina «Prezzi»` (`pages.builder.drag`). The sentences only put them
   * where no preposition has to merge with the article, and avoid participles
   * that would have to agree with their gender.
   */
  dnd: {
    pickedUp: (item: string) => `Hai preso ${item}.`,
    over: (item: string, target: string) => `${capitalise(item)} è ora dove si trova ${target}.`,
    notOver: (item: string) => `${capitalise(item)} non è più sopra l’elenco.`,
    dropped: (item: string, target: string) => `Hai rilasciato ${item} dove si trovava ${target}.`,
    droppedOutside: (item: string) => `Hai rilasciato ${item}.`,
    cancelled: (item: string) => `Spostamento annullato per ${item}.`,
  },
};
