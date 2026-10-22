import type { AdminDictionary } from '../index';

/**
 * The building blocks the page builder and the journal studio share: the album
 * and photo pickers, the manual photo order editor, the block cards' drag grip
 * and type badges, and the screen reader announcements for drag and drop.
 */

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const pickers: AdminDictionary['pickers'] = {
  albumPicker: {
    title: 'Seleccionar álbum',
    searchPlaceholder: 'Buscar álbumes por nombre o UUID…',
    empty: 'No se han encontrado álbumes. Comprueba la conexión con Immich y el acceso.',
    /** Under each album's name, before its description. */
    photoCount: (count: number) => `${count} ${count === 1 ? 'foto' : 'fotos'}`,
    /** The album is private in Immich; publishing it still works. */
    notShared: 'No compartido en Immich',
    /** Badge on an album that is already on the site. */
    inUse: 'En uso',
    select: 'Elegir',
  },

  assetPicker: {
    /** Heading when the caller names no purpose of its own. */
    defaultTitle: 'Seleccionar imagen de portada',
    tabs: {
      albums: 'Álbumes',
      thisAlbum: 'Este álbum',
      favorites: 'Favoritas',
      allPhotos: 'Todas las fotos',
    },
    filterAlbumPlaceholder: 'Filtrar este álbum por nombre de archivo…',
    searchPlaceholder: 'Buscar por nombre de archivo, descripción o fecha (2024-05)…',
    searchLabel: 'Buscar fotos',
    /** Accessible name of the photo grid. */
    gridLabel: 'Fotos',
    noMatch: (query: string) => `Ninguna foto coincide con «${query}».`,
    noFavorites:
      'No se han encontrado fotos favoritas. Marca fotos con una estrella en Immich o cambia a «Todas las fotos».',
    noPhotos: 'No se han encontrado fotos.',
    /** Accessible name of a photo tile: file name, date and whether it is on the page already. */
    tileLabel: (fileName: string, date: string, used: boolean) =>
      `${fileName}, ${date}${used ? ' (ya en uso)' : ''}`,
    /** Hints in the multi-select bar while nothing is picked. */
    pickAtLeast: (min: number) => `Elige al menos ${min} ${min === 1 ? 'foto' : 'fotos'}`,
    pickUpTo: (max: number) => `Elige hasta ${max} ${max === 1 ? 'foto' : 'fotos'}`,
    pickPhotos: 'Elige fotos',
    /**
     * The multi-select bar once something is picked. `max` is null when there
     * is no limit; `missing` is the required minimum while it is not reached.
     */
    selectedCount: (count: number, max: number | null, missing: number | null) =>
      `${count}${max !== null ? ` de ${max}` : ''} ${
        count === 1 && max === null ? 'seleccionada' : 'seleccionadas'
      }${missing !== null ? `; selecciona al menos ${missing}` : ''}`,
    clear: 'Borrar',
    addPhotos: (count: number) => (count > 1 ? `Añadir ${count} fotos` : 'Añadir foto'),
    uuidPlaceholder: 'O pega directamente el UUID del recurso…',
    uuidLabel: 'UUID del recurso',
    invalidUuid: 'Formato de UUID no válido',
  },

  /** The editor for `sort: manual`: pinned photos first, the rest in Immich order. */
  orderEditor: {
    title: (albumName: string) => `Orden de las fotos: ${albumName}`,
    loadFailed: 'No se han podido cargar las fotos del álbum desde Immich.',
    /** Pinned photos that were removed from the album in Immich. */
    dropped: (count: number) =>
      count === 1
        ? '1 foto fijada ya no está en este álbum. Se quitará del orden al guardar.'
        : `${count} fotos fijadas ya no están en este álbum. Se quitarán del orden al guardar.`,
    pinned: (count: number) => `Fijadas (${count})`,
    unpinAll: 'Dejar de fijar todas',
    nothingPinned:
      'Todavía no hay nada fijado: el álbum se muestra en el orden de Immich. Fija las fotos con las que debe empezar el álbum.',
    following: (count: number) => `Siguen automáticamente (${count})`,
    pinAll: 'Fijar todas',
    followingHint:
      'Siguen a las fotos fijadas en el orden del álbum en Immich. Haz clic en una para fijarla.',
    unpinTitle: 'Dejar de fijar: esta foto seguirá automáticamente',
    unpin: (fileName: string) => `Dejar de fijar ${fileName}`,
    pin: (fileName: string) => `Fijar ${fileName}`,
    apply: 'Aplicar orden',
  },

  sortable: {
    /** The grip on a block card. */
    dragToReorder: 'Arrastra para reordenar',
  },

  /** Block type chips on the block cards; keep them short. */
  badges: {
    paragraph: 'Texto',
    heading: 'Encabezado',
    quote: 'Cita',
    photo: 'Foto',
    photoPair: 'Pareja',
    photoGrid: 'Cuadrícula',
    facts: 'Datos',
    map: 'Mapa',
    album: 'Álbum',
  },

  /**
   * Screen reader announcements while dragging. `item` and `target` are what
   * the list shows, starting lowercase and with their article, e.g.
   * `la página «Tarifas»` — so no sentence puts "de" before them (it would
   * have to contract to "del").
   */
  dnd: {
    pickedUp: (item: string) => `Se ha levantado ${item}.`,
    over: (item: string, target: string) =>
      `${capitalise(item)} está en el lugar que ocupa ${target}.`,
    notOver: (item: string) => `${capitalise(item)} ya no está sobre la lista.`,
    dropped: (item: string, target: string) =>
      `${capitalise(item)} se ha soltado en el lugar que ocupaba ${target}.`,
    droppedOutside: (item: string) => `${capitalise(item)} se ha soltado.`,
    cancelled: (item: string) => `Se ha cancelado el movimiento: ${item} vuelve a su sitio.`,
  },
};
