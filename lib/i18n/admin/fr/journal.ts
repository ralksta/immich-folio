import type { AdminDictionary } from '../index';

// CLDR: French puts 0 in the singular, unlike English.
const isOne = (n: number) => n <= 1;

/**
 * The journal studio: the entry list, the create dialog, the block editor
 * (also used for content pages), its settings and the live preview.
 */
export const journal: AdminDictionary['journal'] = {
  studio: {
    /** The page header's kicker. */
    kicker: 'Contenu',
    title: 'Journal',
    description:
      'Articles du journal, carnets de terrain et longs récits, écrits avec un aperçu en direct.',
    newEntry: 'Nouvel article du journal',
    emptyTitle: 'Aucun article pour le moment',
    emptyText:
      'Créez votre premier article pour partager un carnet de voyage ou un reportage de mariage.',
    createFirst: 'Créer le premier article',
    /** Reading time on an entry card. */
    readingTime: (minutes: number) => `${minutes} min`,
    draft: 'Brouillon',
    published: 'Publié',
    /** Shown on a card when the entry has a password. */
    password: 'Mot de passe',
    editInStudio: 'Modifier dans le studio',
    viewLive: 'Voir la page en ligne',
    /** The delete button's tooltip and the confirm dialog's button. */
    deleteEntry: 'Supprimer l’article',
    deleteTitle: (name: string) => `Supprimer « ${name} » ?`,
    deleteMessage: 'Une copie est conservée et peut être restaurée sous Sauvegardes.',
    deleteFailed: 'Échec de la suppression de l’article',
    deleteError: 'Impossible de supprimer l’article. Vérifiez la connexion et réessayez.',
    createFailed: 'Échec de la création de l’article',
    createError: 'Impossible de créer l’article. Vérifiez la connexion et réessayez.',
    albumsError: 'Impossible de charger les albums. Vérifiez la connexion à Immich et réessayez.',

    create: {
      title: 'Créer un nouvel article',
      titleLabel: 'Titre',
      titlePlaceholder: 'par ex. Expédition au cap Nord',
      slugLabel: 'Slug de l’URL',
      slugPlaceholder: 'par ex. expedition-cap-nord',
      /** `slug` is the entry's slug, or `slugFallback` while it is empty. */
      slugHint: (slug: string) => `Sera accessible sur /journal/${slug}`,
      slugFallback: 'slug',
      startFrom: 'Partir de',
      startFromLabel: 'Point de départ de l’article',
      tabTemplates: 'Modèles',
      tabAlbums: 'Albums',
      blank: 'Vide',
      blankDescription: 'Commencer avec un éditeur vide.',
      loadingAlbums: 'Chargement des albums…',
      changeAlbum: 'Changer d’album',
      selectAlbum: 'Choisir un album',
      choosePhotos: 'Choisir des photos',
      choosePhotosSelected: (n: number) =>
        `Choisir des photos (${n} ${isOne(n) ? 'sélectionnée' : 'sélectionnées'})`,
      selectedPhotos: 'Photos sélectionnées',
      albumNote: 'Seules les photos sélectionnées dans cet album seront ajoutées à l’article.',
      pickerTitle: 'Choisir des photos dans cet album',
      creating: 'Création…',
      submit: 'Créer & ouvrir le studio',
    },
  },

  /**
   * The names and descriptions of the starting templates, by template id
   * (`lib/journalTemplates.ts`). The blocks a template inserts stay as written.
   */
  templates: {
    wedding: {
      name: 'Mariage',
      description:
        'La date et le lieu d’emblée, une photo d’ouverture, une phrase des vœux, les invités en grille.',
    },
    hiking: {
      name: 'Randonnée / plein air',
      description:
        'Distance et dénivelé en repères, le sentier en grille, l’itinéraire sur une carte.',
    },
    travel: {
      name: 'Voyage',
      description: 'Le voyage sur une carte, puis une étape par section avec deux photos chacune.',
    },
    birthday: {
      name: 'Anniversaire / famille',
      description: 'Presque pas de texte — tout l’album en grille et une image pleine largeur.',
    },
    'portrait-session': {
      name: 'Séance portrait',
      description:
        'Des images larges seules, qui respirent, et une citation de la personne photographiée.',
    },
    'behind-the-scenes': {
      name: 'Coulisses',
      description:
        'La préparation et la prise de vue en paire, puis le résultat final pour conclure.',
    },
    pets: {
      name: 'Animaux',
      description: 'Des paires prises sur le vif, un portrait rapproché plein de caractère.',
    },
    'new-series': {
      name: 'Nouvelle série',
      description:
        'S’ouvre sur une déclaration, puis des paires photo-texte qui présentent le projet.',
    },
  },

  /** The editor of one entry, also used for content pages. */
  editor: {
    loadFailedFallback: 'L’article n’a pas pu être chargé.',
    conflictKept:
      'Non enregistré — le contenu a été modifié ailleurs. Vos modifications sont toujours là.',
    saveFailed: 'Échec de l’enregistrement',
    saveErrorEntry: 'Impossible d’enregistrer l’article. Vérifiez la connexion et réessayez.',
    saveErrorPage: 'Impossible d’enregistrer la page. Vérifiez la connexion et réessayez.',
    openingEntry: 'Ouverture du studio du journal…',
    openingPage: 'Ouverture de l’éditeur de page…',
    loadFailedEntry: 'Cet article n’a pas pu être chargé.',
    loadFailedPage: 'Cette page n’a pas pu être chargée.',
    albumListFailed: (error: string) => `Liste des albums : ${error}`,
    loadFailedNote:
      'Rien n’a été modifié. L’enregistrement reste désactivé tant que le contenu n’est pas chargé, pour qu’un éditeur vide ne puisse pas l’écraser.',
    backToEntries: 'Retour aux articles',
    backToPages: 'Retour aux pages',
    /** The top bar's back button. */
    allEntries: '← Tous les articles',
    pages: '← Pages',
    storyTitlePlaceholder: 'Titre de l’article…',
    storyTitleLabel: 'Titre de l’article',
    pageTitlePlaceholder: 'Titre de la page…',
    pageTitleLabel: 'Titre de la page',
    modeLabel: 'Mode de l’éditeur',
    modeBlocks: 'Blocs visuels',
    modeMarkdown: 'Markdown brut',
    storySettings: 'Réglages de l’article',
    pageSettings: 'Réglages de la page',
    publish: 'Publier',
    unpublish: 'Dépublier',
    publishTitle: 'Publier la page et l’enregistrer maintenant',
    unpublishTitle: 'Repasser la page en brouillon et l’enregistrer maintenant',
    /** Link to the published page. */
    live: 'En ligne',
    saving: 'Enregistrement…',
    saveChanges: 'Enregistrer les modifications',
    saved: 'Enregistré',
    markdownPlaceholder: 'Écrivez en Markdown ici…',
    addBlock: 'Ajouter un bloc :',
    addText: '+ Texte',
    addHeading: '+ Titre',
    addQuote: '+ Citation',
    addFacts: '+ Repères',
    addPhoto: '+ Photo',
    addPhotos: '+ Photos',
    addPair: '+ Paire de photos',
    addGrid: '+ Grille de photos',
    addAlbum: '+ Album',
    addMap: '+ Carte',
    moveUp: 'Monter le bloc',
    moveDown: 'Descendre le bloc',
    deleteBlock: 'Supprimer le bloc',
    resize: 'Redimensionner l’éditeur et l’aperçu',
  },

  /** Titles of the photo picker, by what it is opened for. */
  pickerTitles: {
    storyPhoto: 'Choisir une photo pour l’article',
    photos: 'Ajouter des photos (un bloc chacune)',
    pair: 'Choisir les photos de la paire',
    pairPhoto: (n: number) => `Choisir la photo n° ${n} de la paire`,
    grid: 'Choisir les photos de la grille',
    gridPhoto: (n: number) => `Choisir la photo n° ${n} de la grille`,
    mapPhoto: 'Choisir une photo à placer sur la carte',
    cover: 'Choisir la photo de couverture',
  },

  /**
   * The text a new block starts with. It is written into the entry, so it is
   * in the panel's language at the time the block is added.
   */
  blockDefaults: {
    heading: 'Nouveau titre',
    paragraph: 'Saisissez un paragraphe ici…',
    quote: 'Saisissez la citation…',
  },

  /** The fields of each block type. */
  blocks: {
    headingLevel: 'Niveau de titre',
    text: 'Texte',
    /** Keep the Markdown markers (`**`, `*`, `[…](…)`) as they are. */
    textPlaceholder: 'Texte (**gras**, *italique*, [lien](https://…))',
    quotePlaceholder: 'Texte de la citation…',
    authorPlaceholder: 'Auteur ou source (facultatif)',
    legacyRef: (ref: string) =>
      `La référence « ${ref} » est une ancienne position dans l’album, pas une photo. Elle n’apparaîtra pas sur la page publiée — choisissez une photo ci-dessous.`,
    legacyRefs: (refs: string[]) =>
      `Les références « ${refs.join(' », « ')} » sont d’anciennes positions dans l’album, pas des photos. Elles n’apparaîtront pas sur la page publiée — choisissez des photos ci-dessous.`,
    changePhoto: 'Changer la photo',
    pickPhoto: 'Choisir une photo',
    /** An empty photo tile. */
    pick: '+ Choisir',
    photoLayout: 'Mise en page de la photo',
    layoutContained: 'Contenue (largeur de colonne)',
    layoutWide: 'Large (largeur étendue)',
    layoutFullbleed: 'Pleine largeur (bord à bord)',
    changePhotoButton: 'Changer la photo',
    captionPlaceholder: 'Légende (facultatif)',
    changePairPhoto: (n: number) => `Changer la photo ${n} de la paire`,
    pickPairPhoto: (n: number) => `Choisir la photo ${n} de la paire`,
    pickPairSlot: (n: number) => `+ Choisir la photo n° ${n}`,
    pickBoth: 'Choisir les deux photos',
    pairCaptionPlaceholder: 'Légende commune de la paire (facultatif)',
    /** Alt text of a picked photo's thumbnail. */
    thumb: 'Vignette',
    pickGridSlot: (n: number) => `+ Choisir n° ${n}`,
    removePhoto: (n: number) => `Retirer la photo n° ${n}`,
    addPhoto: 'Ajouter une photo',
    pickSeveral: 'En choisir plusieurs',
    gridHint: 'Trois photos ou plus, disposées en rangées de trois.',
    gridCaptionPlaceholder: 'Légende commune de la grille (facultatif)',
    factLabelPlaceholder: 'Libellé, par ex. Distance',
    factValuePlaceholder: 'Valeur, par ex. 21 km',
    removeFact: (n: number) => `Retirer le repère n° ${n}`,
    addFact: 'Ajouter un repère',
    changeAlbum: 'Changer d’album',
    pickAlbum: 'Choisir un album',
    albumPhotoCount: (n: number) => `${n} ${isOne(n) ? 'photo' : 'photos'} dans l’album`,
    albumLoading: 'chargement…',
    count: 'Nombre',
    /** Placeholder of the empty Count field: every photo. */
    countAll: 'toutes',
    skip: 'Ignorer',
    layout: 'Mise en page',
    albumLayoutGrid: 'Grille (rangées de trois)',
    albumLayoutPairs: 'Paires (rangées de deux)',
    albumLayoutWide: 'Large (une par rangée)',
    albumCaptionPlaceholder: 'Légende de l’ensemble (facultatif)',
    albumHint:
      'Les photos suivent l’ordre de l’album (un ordre manuel dans la galerie passe en premier). Nombre et Ignorer en choisissent une tranche ; laissez le nombre vide pour toutes.',
    mapOff:
      'La carte est désactivée dans Paramètres → Général. Ce bloc ne s’affichera pas tant qu’elle n’est pas activée.',
    mapCaptionPlaceholder: 'Légende, par ex. Busan → Séoul (facultatif)',
    pointLabelPlaceholder: 'Libellé (facultatif)',
    /** Short placeholders of the coordinate fields. */
    lat: 'Lat.',
    latitude: 'Latitude',
    lng: 'Long.',
    longitude: 'Longitude',
    pickPhotoTile: '+ Choisir une photo',
    allPhotosItem: 'Toutes les photos géolocalisées de cet article, dans l’ordre',
    movePinUp: 'Monter le marqueur',
    movePinDown: 'Descendre le marqueur',
    removePin: 'Retirer le marqueur',
    invalidCoordinates:
      'Un point exige une latitude comprise entre ±90 et une longitude comprise entre ±180. Les points sans coordonnées valides ne sont pas enregistrés.',
    addPoint: 'Point',
    addPhotoPin: 'Marqueur photo',
    addAllPhotos: 'Toutes les photos géolocalisées',
    connectLine: 'Relier les marqueurs par une ligne',
    mapHint:
      'Les points saisis s’affichent aussitôt dans l’aperçu. Les marqueurs photo sont placés sur la page en ligne d’après le GPS de la photo, selon la précision de localisation de l’album.',
  },

  storySettings: {
    title: 'Réglages & métadonnées de l’article',
    subtitle: 'Sous-titre',
    subtitlePlaceholder: 'par ex. Carnet de notre voyage d’hiver',
    author: 'Auteur',
    authorPlaceholder: 'par ex. Ralf',
    date: 'Date de publication',
    cover: 'Photo de couverture',
    coverAlt: 'Couverture',
    chooseCover: 'Choisir la couverture',
    password: 'Protection par mot de passe (facultatif)',
    draft: 'Garder en brouillon (masqué de la liste publique /journal)',
    done: 'Terminé',
  },

  pageSettings: {
    title: 'Réglages de la page',
    description: 'Description SEO',
    descriptionPlaceholder:
      'Une ou deux phrases pour les moteurs de recherche et les aperçus de liens',
    draft: 'Brouillon',
    draftDescription: 'Vous seul voyez un brouillon, et il reste hors du menu et du sitemap.',
    password: 'Mot de passe (facultatif)',
    passwordLabel: 'Mot de passe de la page',
    note: 'Les réglages sont enregistrés avec la page. L’URL et la place dans le menu se définissent dans Pages.',
  },

  preview: {
    label: 'Aperçu du thème en temps réel',
    widthLabel: 'Largeur de l’aperçu',
    desktop: 'Ordinateur',
    mobile: 'Mobile',
  },
};
