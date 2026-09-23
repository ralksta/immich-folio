/**
 * French dictionary.
 *
 * Typed as `Dictionary` (derived from `en.ts`), so a key added to English but
 * forgotten here fails the type-check rather than falling through to English
 * at runtime.
 */

import type { Dictionary } from '../index';

const plural = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`;

export const fr: Dictionary = {
  dateLocale: 'fr-FR',

  nav: {
    home: 'Accueil',
    about: 'À propos',
    map: 'Carte',
    journal: 'Journal',
    skipToContent: 'Aller au contenu',
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
  },

  common: {
    backTo: (label: string) => `Retour à ${label}`,
    backToGallery: 'Retour à la galerie',
    backToJournal: 'Retour au journal',
    email: 'E-mail',
    website: 'Site web',
    home: 'Accueil',
    photos: (n: number) => plural(n, 'photo', 'photos'),
    albums: (n: number) => plural(n, 'album', 'albums'),
    collections: (n: number) => plural(n, 'collection', 'collections'),
    prevAlbum: 'Album précédent',
    nextAlbum: 'Album suivant',
    prevAlbumAria: (name: string) => `Album précédent : ${name}`,
    nextAlbumAria: (name: string) => `Album suivant : ${name}`,
    albumNavAria: 'Navigation entre les albums',
    prevEntry: 'Article précédent',
    nextEntry: 'Article suivant',
    prevEntryAria: (title: string) => `Article précédent : ${title}`,
    nextEntryAria: (title: string) => `Article suivant : ${title}`,
    entryNavAria: 'Navigation entre les articles du journal',
    loadingGallery: 'Chargement de la galerie',
    loadingPhotos: 'Chargement des photos',
    downloadAlbum: 'Télécharger l’album',
  },

  home: {
    enter: 'Entrer',
  },

  error: {
    notFoundTitle: 'Page introuvable',
    notFoundText: 'Cette page n’existe pas, ou l’album n’est plus publié.',
    errorTitle: 'Une erreur est survenue',
    errorText:
      'Cette page n’a pas pu être chargée. C’est généralement temporaire — réessayez dans un instant.',
    siteErrorText:
      'Ce site n’a pas pu être chargé. C’est généralement temporaire — réessayez dans un instant.',
    tryAgain: 'Réessayer',
    reference: (digest: string) => `Référence : ${digest}`,
  },

  download: {
    unavailableTitle: 'Téléchargement indisponible',
    notAvailable: 'Ce téléchargement n’est pas disponible.',
    rateLimited: 'Trop de demandes de téléchargement. Patientez un instant, puis réessayez.',
    immichUnavailable:
      'La photothèque est momentanément indisponible. Veuillez réessayer dans un instant.',
    back: 'Retour à la galerie',
  },

  theme: {
    switchToLight: 'Passer en mode clair',
    switchToDark: 'Passer en mode sombre',
    scrollToTop: 'Revenir en haut',
  },

  password: {
    subtitle: 'Cette galerie est protégée par un mot de passe.',
    siteSubtitle: 'Ce site est protégé par un mot de passe.',
    placeholder: 'Saisissez le mot de passe',
    submit: 'Entrer',
    verifying: 'Vérification…',
    incorrect: 'Mot de passe incorrect. Veuillez réessayer.',
    failed: 'Impossible de vérifier le mot de passe. Veuillez réessayer plus tard.',
  },

  about: {
    kicker: 'À propos',
    title: 'À propos',
    metaTitle: (name: string) => `À propos — ${name}`,
    portraitAlt: 'Portrait',
    gear: 'Matériel',
  },

  map: {
    title: 'Carte',
    kicker: 'Où',
    subtitle: 'Les lieux où les photos ont été prises',
    loading: 'Chargement de la carte…',
    loadFailed: (status: number) => `Échec du chargement des données de la carte (${status})`,
    initFailed: 'Impossible d’initialiser la carte',
  },

  subpage: {
    collectionKicker: (index: string) => `${index} — Collection`,
    sectionsNav: 'Sections',
    coverAria: (albumName: string, count: string) => `${albumName}, ${count}`,
    nextSubpage: 'Suivant',
    nextSubpageAria: (name: string) => `Suivant : ${name}`,
  },

  journal: {
    title: 'Journal',
    kicker: 'Récits & essais',
    subtitle: 'Essais photographiques, récits visuels et notes de terrain.',
    description: 'Essais photographiques, récits de voyage et coulisses.',
    entryDescription: 'Article du journal',
    empty: 'Aucun article publié pour le moment.',
    readStory: 'Lire le récit →',
    minRead: (n: number) => `${n} min de lecture`,
    draft: 'Brouillon',
    by: (author: string) => `par ${author}`,
    notFound: 'Introuvable',
  },

  lightbox: {
    viewer: 'Visionneuse d’images',
    openPhoto: (n: number) => `Afficher la photo ${n}`,
    close: 'Fermer',
    closeTitle: 'Fermer (Échap)',
    previous: 'Photo précédente',
    previousTitle: 'Photo précédente (flèche gauche)',
    next: 'Photo suivante',
    nextTitle: 'Photo suivante (flèche droite)',
    toggleInfo: 'Afficher/masquer les informations',
    toggleInfoTitle: 'Afficher/masquer les informations (i)',
    hideInfo: 'Masquer les infos',
    info: 'Infos',
    loading: 'Chargement…',
    camera: 'Appareil',
    lens: 'Objectif',
    focalLength: 'Focale',
    aperture: 'Ouverture',
    shutter: 'Vitesse',
    iso: 'ISO',
    location: 'Lieu',
    noExif: 'Aucune donnée EXIF disponible',
    copyLink: 'Copier le lien de cette photo',
    copyLinkTitle: 'Copier le lien de cette photo (c)',
    copyLinkShort: 'Lien',
    copied: 'Copié',
    copyManual: 'Copiez ce lien',
    shortcuts: 'Raccourcis clavier',
    shortcutNavigate: 'Photo précédente / suivante',
    shortcutInfo: 'Informations sur la photo',
    shortcutFullscreen: 'Plein écran',
    shortcutExitFullscreen: 'Quitter le plein écran',
    download: 'Télécharger le fichier original',
    downloadTitle: 'Télécharger le fichier original (d)',
    downloadShort: 'Original',
    shortcutDownload: 'Télécharger l’original',
    shortcutSlideshow: 'Diaporama',
    shortcutSlideshowRunning: (seconds: number) => `Diaporama — toutes les ${seconds} s`,
    slideshowStopped: 'Diaporama arrêté',
    slideshowRunning: (seconds: number) =>
      `Diaporama en cours, photo suivante toutes les ${seconds} secondes`,
    shortcutCopyLink: 'Copier le lien de cette photo',
    shortcutList: 'Cette liste',
    shortcutClose: 'Fermer la visionneuse',
  },

  proofing: {
    addFavorite: 'Ajouter aux favoris',
    removeFavorite: 'Retirer des favoris',
    addToFavorites: 'Ajouter aux favoris',
    removeFromFavorites: 'Retirer des favoris',
    saved: 'Enregistré',
    favorite: 'Favori',
    showAll: 'Tout afficher',
    selected: (n: number) => `❤️ ${n} ${n === 1 ? 'sélectionnée' : 'sélectionnées'}`,
    shareExport: 'Partager & exporter',
    modalTitle: (n: number) => `❤️ Sélection (${n})`,
    closeModal: 'Fermer la fenêtre',
    intro: (n: number) =>
      `Vous avez sélectionné ${plural(n, 'photo', 'photos')}. Choisissez une option d’export ci-dessous pour partager votre sélection :`,
    copyLink: 'Copier le lien de partage',
    linkCopied: 'Lien copié !',
    copyList: 'Copier la liste (#1, #2…)',
    listCopied: 'Liste copiée !',
    copyManualLink: 'Copiez ce lien',
    copyManualList: 'Copiez cette liste',
    sendEmail: '✉️ Envoyer un e-mail au photographe',
    downloadSelected: 'Télécharger la sélection (.zip)',
    clearSelection: 'Vider la sélection',
    confirmClear: 'Retirer tous les favoris sélectionnés ?',
    listEmpty: (albumName: string) => `${albumName} : aucune photo sélectionnée.`,
    listSummary: (albumName: string, count: number, indices: string) =>
      `${albumName} — Photos sélectionnées (${count}) : ${indices}`,
    mailSubject: (n: number) => `Sélection de photos (${n})`,
    mailBody: (list: string, url: string) =>
      `Bonjour,\n\nVoici ma sélection de photos :\n\n${list}\n\nLien de partage : ${url}\n\nCordialement,`,
  },

  legal: {
    navLabel: 'Mentions légales',
    title: 'Mentions légales',
    subtitle: 'Informations conformément au § 5 TMG',
    address: 'Adresse',
    contact: 'Contact',
    email: 'E-mail',
    phone: 'Téléphone',
    taxSection: 'Informations fiscales',
    taxId: 'Numéro fiscal',
    vatId: 'Numéro de TVA',
    extraInfo: 'Informations complémentaires',
    source: 'Source : créé avec le générateur de mentions légales d’eRecht24.',
  },
};
