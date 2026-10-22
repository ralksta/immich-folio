import type { AdminDictionary } from '../index';

// CLDR: French puts 0 in the singular, unlike English.
const isOne = (n: number) => n <= 1;

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The building blocks the page builder and the journal studio share: the album
 * and photo pickers, the manual photo order editor, the block cards' drag grip
 * and type badges, and the screen reader announcements for drag and drop.
 */
export const pickers: AdminDictionary['pickers'] = {
  albumPicker: {
    title: 'Choisir un album',
    searchPlaceholder: 'Rechercher des albums par nom ou UUID…',
    empty: 'Aucun album trouvé. Vérifiez la connexion à Immich et les droits d’accès.',
    /** Under each album's name, before its description. */
    photoCount: (count: number) => `${count} ${isOne(count) ? 'photo' : 'photos'}`,
    /** The album is private in Immich; publishing it still works. */
    notShared: 'Non partagé dans Immich',
    /** Badge on an album that is already on the site. */
    inUse: 'Utilisé',
    select: 'Choisir',
  },

  assetPicker: {
    /** Heading when the caller names no purpose of its own. */
    defaultTitle: 'Choisir une image d’en-tête',
    tabs: {
      albums: 'Albums',
      thisAlbum: 'Cet album',
      favorites: 'Favoris',
      allPhotos: 'Toutes les photos',
    },
    filterAlbumPlaceholder: 'Filtrer cet album par nom de fichier…',
    searchPlaceholder: 'Nom de fichier, description ou date (2024-05)…',
    searchLabel: 'Rechercher des photos',
    /** Accessible name of the photo grid. */
    gridLabel: 'Photos',
    noMatch: (query: string) => `Aucune photo ne correspond à « ${query} ».`,
    noFavorites:
      'Aucune photo favorite trouvée. Ajoutez d’abord des photos aux favoris dans Immich, ou passez à « Toutes les photos ».',
    noPhotos: 'Aucune photo trouvée.',
    /** Accessible name of a photo tile: file name, date and whether it is on the page already. */
    tileLabel: (fileName: string, date: string, used: boolean) =>
      `${fileName}, ${date}${used ? ' (déjà utilisée)' : ''}`,
    /** Hints in the multi-select bar while nothing is picked. */
    pickAtLeast: (min: number) => `Choisissez au moins ${min} ${isOne(min) ? 'photo' : 'photos'}`,
    pickUpTo: (max: number) => `Choisissez jusqu’à ${max} ${isOne(max) ? 'photo' : 'photos'}`,
    pickPhotos: 'Choisissez des photos',
    /**
     * The multi-select bar once something is picked. `max` is null when there
     * is no limit; `missing` is the required minimum while it is not reached.
     */
    selectedCount: (count: number, max: number | null, missing: number | null) =>
      `${count}${max !== null ? ` sur ${max}` : ''} ${
        isOne(count) ? 'sélectionnée' : 'sélectionnées'
      }${missing !== null ? ` — sélectionnez-en au moins ${missing}` : ''}`,
    clear: 'Effacer',
    addPhotos: (count: number) => (count > 1 ? `Ajouter ${count} photos` : 'Ajouter la photo'),
    uuidPlaceholder: 'Ou collez directement l’UUID du média…',
    uuidLabel: 'UUID du média',
    invalidUuid: 'Format d’UUID invalide',
  },

  /** The editor for `sort: manual`: pinned photos first, the rest in Immich order. */
  orderEditor: {
    title: (albumName: string) => `Ordre des photos — ${albumName}`,
    loadFailed: 'Impossible de charger les photos de l’album depuis Immich.',
    /** Pinned photos that were removed from the album in Immich. */
    dropped: (count: number) =>
      isOne(count)
        ? `${count} photo épinglée n’est plus dans cet album. Elle sera retirée de l’ordre à l’enregistrement.`
        : `${count} photos épinglées ne sont plus dans cet album. Elles seront retirées de l’ordre à l’enregistrement.`,
    pinned: (count: number) => `${isOne(count) ? 'Épinglée' : 'Épinglées'} (${count})`,
    unpinAll: 'Tout désépingler',
    nothingPinned:
      'Rien n’est épinglé pour le moment — l’album s’affiche dans l’ordre d’Immich. Épinglez les photos qui doivent ouvrir l’album.',
    following: (count: number) => `Suivent automatiquement (${count})`,
    pinAll: 'Tout épingler',
    followingHint:
      'Celles-ci suivent les photos épinglées, dans l’ordre de l’album dans Immich. Cliquez sur l’une d’elles pour l’épingler.',
    unpinTitle: 'Désépingler — cette photo suit alors automatiquement',
    unpin: (fileName: string) => `Désépingler ${fileName}`,
    pin: (fileName: string) => `Épingler ${fileName}`,
    apply: 'Appliquer l’ordre',
  },

  sortable: {
    /** The grip on a block card. */
    dragToReorder: 'Faire glisser pour réorganiser',
  },

  /** Block type chips on the block cards; keep them short. */
  badges: {
    paragraph: 'Texte',
    heading: 'Titre',
    quote: 'Citation',
    photo: 'Photo',
    photoPair: 'Paire',
    photoGrid: 'Grille',
    facts: 'Repères',
    map: 'Carte',
    album: 'Album',
  },

  /**
   * Screen reader announcements while dragging. `item` and `target` are what
   * the list shows, starting lowercase and with their article, e.g.
   * `la page « Tarifs »` (see `pages.builder.drag`). The sentences put the
   * label where no participle has to agree with its gender.
   */
  dnd: {
    pickedUp: (item: string) => `Vous avez saisi ${item}.`,
    over: (item: string, target: string) =>
      `${capitalise(item)} se trouve à la position de ${target}.`,
    notOver: (item: string) => `${capitalise(item)} n’est plus au-dessus de la liste.`,
    dropped: (item: string, target: string) =>
      `Vous avez déposé ${item} à la position de ${target}.`,
    droppedOutside: (item: string) => `Vous avez déposé ${item}.`,
    cancelled: (item: string) => `Le déplacement de ${item} a été annulé.`,
  },
};
