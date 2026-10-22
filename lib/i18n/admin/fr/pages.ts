import type { AdminDictionary } from '../index';

// CLDR: French puts 0 in the singular, unlike English.
const isOne = (n: number) => n <= 1;

/**
 * Admin → Pages: the page builder (home page hero, standalone albums,
 * subpages, content pages), its drawers and the photo-essay block editor.
 *
 * File names (gallery.yaml, content/pages/), CSS values and units in the
 * strings below are literal — keep them as written.
 */
export const pages: AdminDictionary['pages'] = {
  /** The page header above the builder. */
  header: {
    kicker: 'Contenu',
    title: 'Pages',
    description:
      'Les photos d’accueil, les albums indépendants, les sous-pages et les pages de contenu. Faites glisser pour réorganiser ; les modifications sont en ligne dès l’enregistrement.',
  },

  builder: {
    albumListFailed: (error: string) =>
      `Les albums Immich n’ont pas été chargés : le sélecteur d’albums est vide. ${error}`,
    pageListFailed: (error: string) =>
      `Les pages de contenu n’ont pas été chargées ; leurs entrées de menu restent telles quelles. ${error}`,
    loadFailed: 'La structure des pages n’a pas pu être chargée.',
    loadFailedNote:
      'Rien n’a été modifié. L’enregistrement reste désactivé tant qu’elle n’est pas chargée, pour qu’un éditeur vide ne puisse pas écraser votre galerie.',
    notSavedConflict: 'Non enregistré — gallery.yaml a été modifié ailleurs.',
    saved: 'Enregistré !',
    /** Inserted into "Erreur : …" (common.errorWith). */
    saveFailed: 'Échec de l’enregistrement',
    saveChanges: 'Enregistrer les modifications',
    createFailed: 'Échec de la création de la page',
    createdInMenu: 'Page créée en brouillon. Enregistrez les modifications pour l’ajouter au menu.',
    created: 'Page créée en brouillon.',
    createOffline: 'Impossible de créer la page. Vérifiez la connexion et réessayez.',
    /** Toasts after a removal; each offers `undo`. */
    pageRemoved: 'Page retirée.',
    albumRemoved: 'Album retiré.',
    albumRemovedFromPage: 'Album retiré de la page.',
    albumRemovedFromSection: 'Album retiré de la section.',
    heroRemoved: 'Photo d’accueil retirée.',
    undo: 'Annuler',
    undoFailed:
      'Annulation impossible : la structure des pages a changé depuis. Rien n’est encore enregistré.',
    /**
     * What screen readers call a dragged item, with its article, so that
     * `pickers.dnd` can build "Vous avez saisi la page « Voyages »." Only "la"
     * and "l’" are used, never "le", so "de" + label never needs contracting.
     */
    drag: {
      page: (name: string) => `la page « ${name} »`,
      untitled: 'Sans titre',
      hero: (n: number) => `la photo d’accueil ${n}`,
      album: (name: string) => `l’album « ${name} »`,
      item: 'l’élément',
    },
    /** The structure list on the left. */
    tree: 'Structure des pages',
    searchLabel: 'Rechercher des albums ou des sous-pages',
    searchPlaceholder: 'Rechercher des albums ou des sous-pages…',
    clearSearch: 'Effacer la recherche',
    homePage: 'Page d’accueil',
    heroPhotos: 'Photos d’accueil',
    menu: 'Menu',
    subpagesLive: (live: number, total: number) =>
      `${live} sur ${total} ${isOne(total) ? 'sous-page en ligne' : 'sous-pages en ligne'}`,
    noMatches: 'Aucune entrée correspondante.',
    newSubpage: 'Nouvelle sous-page',
    newPage: 'Nouvelle page',
    notInMenu: 'Hors du menu',
    offMenuEmpty:
      'Pages accessibles uniquement par leur lien. Faites glisser une page ici pour la retirer du menu.',
    standaloneGroup: 'Albums indépendants',
    onHomePage: 'Sur la page d’accueil',
    /** The panel for standalone albums. */
    standaloneHeading: 'Albums indépendants',
    addAlbum: '+ Ajouter un album',
    noMatchingStandalone: 'Aucun album indépendant correspondant.',
    noStandalone:
      'Aucun album indépendant. Ces albums s’affichent directement sur la page d’accueil.',
    /** The panel for the home page hero. */
    addHero: 'Ajouter des photos',
    heroPickerTitle: 'Choisir les photos de la page d’accueil',
    noHero:
      'Aucune photo d’accueil configurée. Ajoutez des photos pour afficher un carrousel sur la page d’accueil.',
  },

  /** Seed values for a new subpage or section, written into gallery.yaml. */
  defaults: {
    subpageName: (n: number) => `Nouvelle sous-page ${n}`,
    sectionTitle: 'Nouvelle section',
  },

  /** The per-album photo order (Listbox options and the card's badge tooltip). */
  sort: {
    immich: 'Ordre d’Immich (par défaut)',
    newest: 'Plus récentes d’abord',
    oldest: 'Plus anciennes d’abord',
    filename: 'Nom de fichier',
    manual: 'Manuel',
  },

  albumCard: {
    reorder: (name: string) => `Réorganiser ${name}`,
    dragToReorder: 'Faire glisser pour réorganiser',
    editDetails: 'Modifier les détails',
    removeAlbum: 'Retirer l’album',
    passwordProtected: 'Protégé par mot de passe',
    customHero: 'Image d’en-tête personnalisée définie',
    /** `label` is one of the `sort` labels. */
    photoOrder: (label: string) => `Ordre des photos : ${label}`,
    /** English always says "photos"; French uses the singular for 0 and 1. */
    photos: (n: number) => `${n} ${isOne(n) ? 'photo' : 'photos'}`,
  },

  albumDrawer: {
    heading: 'Modifier les détails de l’album',
    close: 'Fermer les détails',
    photos: (n: number) => `${n} ${isOne(n) ? 'photo' : 'photos'}`,
    /** Shown after the photo count when the title is overridden. */
    original: (name: string) => `Original : ${name}`,
    titleOverride: 'Titre de remplacement',
    description: 'Description',
    descriptionPlaceholder: 'Description facultative pour les visiteurs',
    passwordProtection: 'Protection par mot de passe',
    albumPassword: 'Mot de passe de l’album',
    downloads: 'Téléchargements',
    allowDownloads: 'Autoriser le téléchargement des originaux',
    allowDownloadsDesc:
      'Les visiteurs peuvent télécharger l’album entier ou les photos sélectionnées en ZIP',
    zoomInherit: 'Hériter des paramètres de la page / du site',
    zoomHint:
      'Permet aux visiteurs de zoomer sur une photo dans la visionneuse pour vérifier la netteté. Les originaux JPEG et AVIF sont affichés sans leurs données GPS ; HEIC et RAW nécessitent les aperçus en pleine taille d’Immich. Les PNG, WebP, GIF et les photos retouchées dans Immich ne sont jamais zoomés. S’applique là où l’album figure ici.',
    layoutOverride: 'Mise en page de remplacement (expérimental)',
    layoutOverrideAria: 'Mise en page de remplacement',
    layoutInherit: 'Hériter des paramètres de la page / globaux',
    layouts: {
      masonry: 'Maçonnerie',
      uniform: 'Grille uniforme',
      showcase: 'Vitrine',
      filmstrip: 'Pellicule',
      editorialFlow: 'Flux éditorial',
      justified: 'Justifiée (expérimental)',
    },
    coverFocalPoint: 'Point focal de la couverture (expérimental)',
    /** "50% 25%" and "top" are CSS values; keep them as written. */
    coverFocalPointPlaceholder:
      'par ex. « 50% 25% » ou « top » — le point d’ancrage du recadrage de la couverture',
    customHero: 'Image d’en-tête personnalisée',
    heroAlt: 'Image d’en-tête',
    removeHero: 'Retirer l’image d’en-tête personnalisée',
    defaultCover: 'Couverture de l’album par défaut',
    pickHeroTitle: (name: string) => `Choisir l’image d’en-tête de ${name}`,
    changeImage: 'Changer l’image',
    pickHero: 'Choisir une image d’en-tête',
    photoOrder: 'Ordre des photos',
    manualHint:
      'Les photos épinglées passent en premier, dans l’ordre choisi. Les autres suivent dans l’ordre de l’album dans Immich.',
    immichHint: 'L’ordre d’Immich suit le tri défini pour l’album dans Immich.',
    reorderPhotos: 'Réorganiser les photos',
    reorderPhotosPinned: (n: number) =>
      `Réorganiser les photos (${n} ${isOne(n) ? 'épinglée' : 'épinglées'})`,
    removeAlbum: 'Retirer l’album',
    uuidTitle: 'UUID de l’album Immich',
    copyUuid: 'Copier l’UUID',
    copyUuidAria: 'Copier l’UUID de l’album Immich',
    done: 'Terminé',
  },

  subpageDrawer: {
    breadcrumb: 'Pages / Sous-pages',
    untitled: 'Page sans titre',
    /** Accessible name of the Edit / Live Preview switch. */
    view: 'Affichage',
    livePreview: 'Aperçu en direct',
    openLive: 'Ouvrir la page en ligne dans un nouvel onglet (sans cache)',
    close: 'Fermer le panneau',
    pageName: 'Nom de la page (identifiant dans l’URL)',
    pageNamePlaceholder: 'par ex. dubai, voyages, mariages',
    displayTitle: 'Titre affiché (facultatif)',
    /** Sits in a half-width field; keep it short. */
    displayTitlePlaceholder: 'Comme le nom',
    subtitle: 'Sous-titre',
    subtitlePlaceholder: 'Texte du sous-titre',
    visibility: 'Visibilité & accès',
    visibilityOptions: {
      published: {
        title: 'Publiée',
        desc: 'Affichée dans le menu de l’en-tête et sur la page d’accueil, accessible par son URL',
      },
      unlisted: {
        title: 'Non listée (expérimental)',
        desc: 'Absente des menus et de la page d’accueil, mais accessible par un lien direct',
      },
      disabled: {
        title: 'Désactivée',
        desc: 'Entièrement hors ligne — renvoie une 404 même en accès direct',
      },
    },
    passwordPlaceholder:
      'Protection par mot de passe (facultatif) — laissez vide pour un accès public',
    pagePassword: 'Mot de passe de la page',
    layoutStyle: 'Style de mise en page',
    layoutStyleAria: 'Style de mise en page',
    /** Options of a <select>: plain text only. */
    layouts: {
      masonry: 'Maçonnerie (hauteur variable)',
      uniform: 'Grille uniforme (vignettes carrées)',
      showcase: 'Vitrine (premier média mis en avant)',
      filmstrip: 'Pellicule (défilement horizontal)',
      editorialFlow: 'Flux éditorial',
      essay: 'Essai photo (éditeur narratif)',
    },
    zoomInherit: 'Hériter des paramètres du site',
    zoomHint:
      'S’applique à chaque album de cette page qui ne définit pas le sien. Le réglage pour tout le site se trouve dans Paramètres › Général.',
    coverGrid: 'Grille des couvertures d’albums',
    coverGridHint:
      'Remplace la disposition des couvertures d’albums sur cette page — les photos à l’intérieur des albums ne sont pas concernées. Laissez le nombre de colonnes vide pour suivre la grille du site, et l’espacement vide pour garder celui du thème. Sur tablette, au plus deux couvertures s’affichent par rangée.',
    photoGrid: 'Grille des photos (albums de cette page)',
    photoGridHint:
      'La disposition des photos à l’intérieur de chaque album de cette page. Laissez les deux champs vides pour suivre Paramètres › Grille ; un album peut toujours la remplacer dans gallery.yaml.',
    essayHeading: 'Éditeur narratif & essai photo',
    essayIntro:
      'Composez visuellement du texte, des citations et des photos larges ou pleine largeur.',
    essayPickerTitle: 'Choisir une photo pour l’essai photo',
    albums: 'Albums de cette page',
    addAlbum: '+ Ajouter un album',
    noAlbums:
      'Aucun album pour le moment. Cliquez sur + Ajouter un album pour en choisir un dans Immich.',
    /** Placeholder and accessible name of a section's title field. */
    sectionTitle: 'Titre de la section',
    removeSection: 'Retirer la section',
    sectionDescPlaceholder: 'Description de la section (facultatif)',
    sectionDesc: 'Description de la section',
    addSection: '+ Ajouter une section',
    addLooseAlbum: '+ Ajouter un album hors section',
    deleteSubpage: 'Supprimer la sous-page',
    done: 'Terminé',
  },

  /** The subpage drawer's Live Preview tab. */
  preview: {
    note: 'Rendu avec le préréglage de thème enregistré du site, en largeur ordinateur. Les modifications non enregistrées de ce panneau apparaissent ici ; celles du thème, une fois enregistrées dans Paramètres.',
    settingsFailed: (error: string) =>
      `L’aperçu utilise la grille par défaut et l’anglais tant que les paramètres du site ne sont pas chargés. ${error}`,
  },

  /** Rows and tiles of the structure list. */
  tiles: {
    reorderHero: (n: number) => `Réorganiser la photo d’accueil ${n}`,
    reorder: (name: string) => `Réorganiser ${name}`,
    /** Stands in for a subpage without a name in `reorder`. */
    pageFallback: 'la page',
    dragToReorder: 'Faire glisser pour réorganiser',
    disabledTitle: 'La page est désactivée',
    disabled: 'Désactivée',
    unlistedTitle: 'Masquée dans la navigation, accessible par un lien direct',
    /** Short state badges in a list row; one word. */
    unlisted: 'Non listée',
    off: 'Désactivée',
    missing: 'Manquante',
    draft: 'Brouillon',
    /** Tag marking a content page, as opposed to a subpage; one short word. */
    page: 'Page',
    passwordProtected: 'Protégée par mot de passe',
    password: 'Mot de passe',
    editPage: 'Modifier la page',
    albums: (n: number) => `${n} ${isOne(n) ? 'album' : 'albums'}`,
  },

  newPage: {
    title: 'Nouvelle page',
    titleLabel: 'Titre',
    titlePlaceholder: 'par ex. Tarifs',
    url: 'URL',
    /** An example slug: lowercase letters, digits and dashes only. */
    slugPlaceholder: 'tarifs',
    /** Shown as "/slug" while no slug is typed; same rules as above. */
    slugFallback: 'slug',
    exists: (slug: string) => `Une page « ${slug} » existe déjà.`,
    hint: 'Commence vide et en brouillon. Vous pourrez changer l’URL plus tard.',
    showInMenu: 'Afficher dans le menu',
    showInMenuDesc:
      'L’ajoute à la fin du menu ; enregistré avec « Enregistrer les modifications ».',
    creating: 'Création…',
    create: 'Créer la page',
  },

  pagePanel: {
    noFile: 'Il n’y a pas de fichier pour cette page dans content/pages/.',
    exists: (slug: string) => `Une page « ${slug} » existe déjà.`,
    moveTitle: (slug: string) => `Déplacer cette page vers /${slug} ?`,
    linksBreak: (slug: string) =>
      `Les liens vers /${slug} cesseront de fonctionner. Il n’y a pas de redirection automatique.`,
    movePage: 'Déplacer la page',
    notSavedConflict:
      'Non enregistré — la page a été modifiée ailleurs. Vos modifications sont toujours là.',
    saveFailed: 'Échec de l’enregistrement de la page',
    saved: 'Page enregistrée.',
    saveOffline: 'Impossible d’enregistrer la page. Vérifiez la connexion et réessayez.',
    deleteTitle: (name: string) => `Supprimer « ${name} » ?`,
    deleteMessageInMenu:
      'La page est aussi retirée du menu dans gallery.yaml. Les deux fichiers sont d’abord sauvegardés et peuvent être restaurés sous Sauvegardes.',
    deleteMessage: 'Une copie est conservée et peut être restaurée sous Sauvegardes.',
    deletePage: 'Supprimer la page',
    deleteFailed: 'Échec de la suppression de la page',
    deleted: 'Page supprimée.',
    deleteOffline: 'Impossible de supprimer la page. Vérifiez la connexion et réessayez.',
    loadFailed: 'Cette page n’a pas pu être chargée.',
    menuStillLists:
      'Le menu la mentionne encore. Désactivez « Afficher dans le menu » et enregistrez la structure pour retirer l’entrée.',
    removeFromMenu: 'Retirer du menu',
    openLive: 'Ouvrir la page en ligne dans un nouvel onglet',
    title: 'Titre',
    url: 'URL',
    slugHint:
      'Vérifiée par rapport aux sous-pages, aux albums, aux articles du journal et aux routes intégrées.',
    showInMenu: 'Afficher dans le menu',
    inMenuDesc:
      'Figure dans le menu de l’en-tête. Faites-la glisser dans la structure pour la déplacer.',
    offMenuDesc:
      'Absente du menu, mais accessible par son URL — pour les pages partagées par lien.',
    /** Follows `inMenuDesc` / `offMenuDesc`. */
    savedWithStructure: 'Enregistré avec « Enregistrer les modifications ».',
    draft: 'Brouillon',
    draftDesc: 'Vous seul voyez un brouillon. Il reste hors du menu et du sitemap.',
    password: 'Mot de passe (facultatif)',
    pagePassword: 'Mot de passe de la page',
    seoDescription: 'Description SEO',
    seoPlaceholder: 'Une ou deux phrases pour les moteurs de recherche et les aperçus de liens',
    editContent: 'Modifier le contenu →',
    savePage: 'Enregistrer la page',
  },

  /** The photo-essay block editor in a subpage set to "Essai photo". */
  essay: {
    /** The starting story of an empty essay: a "# heading" and a paragraph. */
    starterTitle: 'Titre',
    starterBody: 'Écrivez votre histoire ici…',
    /** Text a newly added block starts with. */
    newHeading: 'Nouveau titre de section',
    newParagraph: 'Saisissez un paragraphe ici…',
    newQuote: 'Saisissez la citation ici…',
    toolbar: 'Ajouter un bloc :',
    add: {
      paragraph: '+ Paragraphe',
      heading: '+ Titre',
      quote: '+ Citation',
      facts: '+ Repères',
      photo: '+ Photo',
      photoPair: '+ Paire de photos',
      photoGrid: '+ Grille de photos',
      album: '+ Album',
      map: '+ Carte',
    },
    empty:
      'Aucun bloc pour le moment. Utilisez les boutons ci-dessus pour construire votre essai photo !',
    moveUp: 'Monter',
    moveDown: 'Descendre',
    deleteBlock: 'Supprimer le bloc',
    headingLevel: 'Niveau de titre',
    headingPlaceholder: 'Titre de section…',
    /** `**bold**` and `*italic*` are markdown syntax; keep the asterisks. */
    paragraphPlaceholder: 'Écrivez un paragraphe… (Markdown **gras** et *italique* pris en charge)',
    quotePlaceholder: 'Texte de la citation…',
    authorPlaceholder: '— Auteur / source (facultatif)',
    noPhoto: 'Aucune photo',
    changePhoto: 'Changer la photo',
    selectPhoto: 'Choisir une photo',
    /** Width options of a photo block; the measures are CSS units. */
    contained: 'Contenue (68ch)',
    wide: 'Large (1100px)',
    fullbleed: 'Pleine largeur (100vw)',
    assetUuidPlaceholder: 'UUID du média Immich…',
    photoCaption: 'Légende de la photo (facultatif)',
    photoN: (n: number) => `Photo ${n}`,
    selectPhotoN: (n: number) => `Choisir la photo ${n}`,
    uuidN: (n: number) => `UUID de la photo ${n}…`,
    swapPhotos: 'Échanger la photo 1 et la photo 2',
    pairCaption: 'Légende commune (facultatif)',
    removePhoto: 'Retirer la photo',
    select: 'Choisir',
    change: 'Changer',
    addPhoto: 'Ajouter une photo',
    gridCaption: 'Légende de la grille (facultatif)',
    factLabel: 'Libellé, par ex. Distance',
    factValue: 'Valeur, par ex. 21 km',
    removeFact: 'Retirer le repère',
    addFact: 'Ajouter un repère',
    albumUuidPlaceholder: 'UUID de l’album Immich (le sélecteur d’albums de Pages affiche les ID)',
    countPlaceholder: 'Nombre (tout)',
    count: 'Nombre',
    skipPlaceholder: 'Ignorer (0)',
    skip: 'Ignorer',
    layout: 'Mise en page',
    albumLayouts: {
      grid: 'Grille (rangées de trois)',
      pairs: 'Paires (rangées de deux)',
      wide: 'Large (une par rangée)',
    },
    albumCaption: 'Légende de l’ensemble (facultatif)',
    albumHint:
      'Développé en blocs photo au rendu de la page — dans l’ordre de l’album, l’ordre manuel de la galerie en premier. Laissez le nombre vide pour l’album entier.',
    mapCaption: 'Légende, par ex. Busan → Séoul (facultatif)',
    pointLabel: 'Libellé (facultatif)',
    latitude: 'Latitude',
    /** Placeholders of the latitude / longitude fields; keep them short. */
    lat: 'Lat.',
    longitude: 'Longitude',
    lng: 'Long.',
    photoUuidPlaceholder: 'UUID de la photo…',
    allPhotosItem: 'Toutes les photos géolocalisées des albums de cette page, dans l’ordre',
    removePin: 'Retirer le marqueur',
    invalidPoint:
      'Un point exige une latitude comprise entre ±90 et une longitude comprise entre ±180 ; les points sans coordonnées valides ne sont pas enregistrés.',
    addPoint: 'Point',
    addPhotoPin: 'Marqueur photo',
    addAllPhotos: 'Toutes les photos géolocalisées',
    connectLine: 'Relier les marqueurs par une ligne',
    mapHint:
      'Les points saisis sont publiés tels quels. Les marqueurs photo sont placés sur la page en ligne d’après le GPS de la photo, selon la précision de localisation de l’album. Rendu uniquement si la carte est activée dans Paramètres.',
  },
  collision: {
    invalid: (slug: string) =>
      `« ${slug} » n’est pas un slug valide : utilisez uniquement des lettres, des chiffres, « - » et « _ ».`,
    reserved: (slug: string) => `/${slug} est une route intégrée du site.`,
    subpage: (slug: string) => `/${slug} est déjà une sous-page.`,
    album: (slug: string) => `/${slug} est déjà un album indépendant.`,
    journal: (slug: string) => `Un article du journal utilise déjà le slug « ${slug} ».`,
  },
};
