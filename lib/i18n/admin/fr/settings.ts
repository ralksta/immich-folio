import type { AdminDictionary } from '../index';

/**
 * Settings (`/admin/settings/<section>`): the editor shell, each section, the
 * privacy policy editor in Legal, and the shared form fields in
 * `app/admin/components/fields/` that other areas reuse.
 *
 * `{name}` placeholders are filled with markup by `rich()` — usually a
 * `<code>` element holding a file name or an environment variable, which stays
 * as it is in every language.
 */
export const settings: AdminDictionary['settings'] = {
  editor: {
    sections: {
      general: 'Général',
      theme: 'Thème',
      grid: 'Grille',
      footer: 'Pied de page',
      legal: 'Mentions légales',
      seo: 'SEO',
      security: 'Sécurité & protection',
      about: 'À propos',
    },
    kicker: 'Site',
    title: 'Paramètres',
    description:
      'Les modifications enregistrées s’appliquent immédiatement au site, sans redémarrage.',
    saveChanges: 'Enregistrer les modifications',
    loadErrorTitle: 'Les paramètres n’ont pas pu être chargés.',
    loadErrorBody:
      'Rien n’a été modifié. L’enregistrement reste désactivé tant qu’ils ne sont pas chargés, pour qu’un formulaire vide ne puisse pas écraser votre configuration.',
    conflict: 'Non enregistré — les paramètres ont été modifiés ailleurs.',
    saved: 'Enregistré !',
    saveFailed: 'Échec de l’enregistrement',
  },

  general: {
    title: 'Paramètres généraux du site',
    sub: 'Configurez l’identité du site, la langue et les fonctionnalités principales.',
    siteTitle: 'Titre du site',
    siteTitleHint: 'Affiché dans l’en-tête, l’onglet du navigateur et les aperçus de liens.',
    siteTitleEmpty: (title: string, fromEnv: boolean) =>
      `Vide, le site affiche donc « ${title} »${fromEnv ? ', issu de SITE_TITLE' : ''}.`,
    subtitle: 'Sous-titre',
    subtitlePlaceholder: 'Un journal visuel',
    language: 'Langue',
    languageHint:
      'L’interface visible par les visiteurs est traduite en {locales}. Les autres langues définissent quand même {htmlLang} et le format des dates, mais affichent l’interface en anglais. Le panneau d’administration a son propre réglage de langue, ci-dessous.',
    adminLanguage: 'Langue du panneau d’administration',
    adminLanguageSame: 'Identique à la langue du site',
    adminLanguageHint:
      'La langue de ce panneau d’administration. Elle change une fois les paramètres enregistrés.',

    featuresTitle: 'Fonctionnalités & modules du portfolio',
    featuresSub:
      'Pages facultatives, et ce que le site révèle de vos photos et compte des visites.',
    modules: 'Modules',
    modulesDesc: 'Chacun ajoute une page ou une commande à la disposition des visiteurs.',
    aboutPage: 'Page À propos',
    aboutPageDesc: 'Portrait, biographie et matériel sur /about',
    map: 'Carte',
    mapDesc: 'Lieux des photos sur une carte du monde, sur /map',
    proofing: 'Sélection client',
    proofingDesc: 'Les visiteurs marquent d’un cœur, filtrent et exportent une sélection de photos',
    zoom: 'Zoom sur les photos',
    zoomDesc:
      'Les visiteurs zooment sur une photo en pleine résolution (1:1) pour vérifier la netteté. Les pages et les albums peuvent passer outre ce réglage',
    proofingEmail: 'E-mail de sélection',
    proofingEmailPlaceholder: 'Par défaut, l’e-mail de contact du pied de page',
    proofingEmailHint:
      'L’adresse à laquelle « Envoyer un e-mail au photographe » envoie une sélection. À défaut, l’e-mail de contact du pied de page est utilisé ; si aucun n’est défini, le bouton est masqué.',

    privacyGroup: 'Ce que les visiteurs apprennent sur vous',
    privacyGroupDesc: 'Ce que révèle chaque photo, et ce qui est compté lors d’une visite.',
    privacyGroupChip: 'visible par les visiteurs',
    photoMetadata: 'Métadonnées des photos',
    metadataSummary: {
      camera: 'Appareil & objectif',
      exposure: 'Exposition',
      location: 'Lieu',
      description: 'Description',
      none: 'Rien n’est publié — la visionneuse masque son panneau d’informations',
    },
    details: 'Détails',
    exifCamera: 'Appareil & objectif',
    exifCameraDesc: 'Boîtier, objectif et focale',
    exifSettings: 'Réglages d’exposition',
    exifSettingsDesc: 'Ouverture, vitesse d’obturation et ISO',
    exifLocation: 'Lieu',
    exifLocationDesc: 'Ville et pays d’après les données GPS de la photo',
    exifCaption: 'Description de la photo',
    exifCaptionDesc: 'La description saisie dans Immich',
    gridHover: 'Résumé au survol de la grille',
    gridHoverDesc: 'Appareil et objectif sur la photo, pas seulement dans la visionneuse',
    gridHoverNeedsCamera: 'Nécessite Appareil & objectif',
    analytics: 'Statistiques',
    analyticsDesc: 'Comptage des vues sans cookies, stocké uniquement sur votre serveur',

    favicon: 'Favicon',
    faviconAlt: 'Favicon actuel',
    faviconUpload: 'Téléverser une icône',
    faviconUploadFailed: 'Échec du téléversement',
    faviconResetFailed: 'Échec de la réinitialisation',
    faviconResetTitle: 'Réinitialiser le favicon ?',
    faviconResetMessage:
      'L’icône téléversée est supprimée et l’icône fournie par défaut est rétablie.',
    faviconHint:
      'SVG, PNG, ICO ou JPEG — 512 kB max. Stocké dans le volume de contenu. Réinitialiser rétablit l’icône fournie par défaut.',
  },

  theme: {
    title: 'Préréglages de thème & mode de couleur',
    sub: 'Choisissez un préréglage typographique et prévisualisez-le en mode clair ou sombre.',
    visitorMode: 'Mode par défaut des visiteurs',
    visitorModeAria: 'Mode par défaut des visiteurs',
    modeDark: 'Sombre',
    modeLight: 'Clair',
    modeAuto: 'Suivre le système du visiteur',
    visitorModeHint:
      'Ce que voit un visiteur lors de sa première visite. Le bouton clair/sombre de l’en-tête du site lui laisse le choix, et ce choix est mémorisé sur son appareil. L’aperçu ci-dessous ne concerne que vous et ne modifie pas ce réglage.',
    preset: 'Préréglage',
    presetSpecs: (font: string, radius: number, frame: string) =>
      `${font} · rayon ${radius} · ${frame}`,
    colorMode: 'Mode de couleur',
    colorModeHint:
      'Les préréglages comme {editorial}, {minimal} et {classic} proposent des fonds clairs couleur crème en mode clair et anthracite en mode sombre.',
    lightMode: 'Mode clair (crème / beige)',
    darkMode: 'Mode sombre (anthracite)',
    accentTitle: 'Couleur d’accent',
    accentSub:
      'Choisissez une couleur d’accent principale pour les liens, les boutons et les mises en valeur.',
    swatches: {
      studioRed: 'Rouge studio',
      editorialGold: 'Or éditorial',
      emerald: 'Émeraude',
      sapphire: 'Saphir',
      violet: 'Violet',
      white: 'Blanc monochrome',
      black: 'Noir obsidienne',
    },
    accentAria: 'Couleur d’accent',
    accentHexAria: 'Couleur d’accent (hex)',
    frameTitle: 'Cadre photo & mise en page',
    frameSub: 'Personnalisez la bordure des images et la mise en page de l’accueil.',
    photoFrame: 'Cadre photo',
    photoFrames: {
      none: { label: 'Aucun', desc: 'Image affleurante aux bords nets' },
      passepartout: { label: 'Passe-partout', desc: 'Marge de galerie classique' },
      shadow: { label: 'Ombre', desc: 'Ombre portée douce, effet flottant' },
    },
    heroStyle: 'Style de l’accueil',
    heroStyles: {
      split: { label: 'Côte à côte', desc: 'Titre et photo côte à côte' },
      fullbleed: { label: 'Pleine largeur', desc: 'Bannière bord à bord sur toute la largeur' },
      minimal: { label: 'Minimaliste', desc: 'Titre centré avec une photo discrète' },
      stacked: { label: 'Superposé', desc: 'Titre placé directement au-dessus de la photo' },
      typographic: { label: 'Typographique', desc: 'Grand titre en texte, sans photos' },
      mosaic: { label: 'Mosaïque', desc: 'Collage de photos dynamique' },
      cover: {
        label: 'Couverture (expérimental)',
        desc: 'Écran d’accueil plein écran avec un seul lien Entrer',
      },
    },
    lookTitle: 'Apparence & mouvement',
    lookSub: 'Effets et petites commandes sur chaque page.',
    transitions: 'Transitions entre pages',
    transitionsDesc: 'Un court fondu entre les pages',
    scrollToTop: 'Bouton de retour en haut',
    scrollToTopDesc: 'Une flèche flottante sur les pages longues',
    grain: 'Grain argentique',
    grainDesc: 'Bruit analogique sur l’arrière-plan',
    headerDot: 'Point d’accent dans l’en-tête',
    headerDotDesc: 'Un point à côté du titre de la rubrique active',
  },

  grid: {
    title: 'Grille & moteur de mise en page',
    sub: 'Configurez la structure des colonnes de la galerie et le format des vignettes.',
    layout: 'Algorithme de mise en page',
    aspectRatio: 'Format',
    aspectRatios: {
      '1': { label: 'Carré (1:1)', desc: 'Recadrage carré au format 1:1' },
      '3/2': { label: 'Paysage (3:2)', desc: 'Format paysage standard des reflex 35 mm' },
      '2/3': { label: 'Portrait (2:3)', desc: 'Orientation portrait verticale' },
      '16/9': { label: 'Cinéma (16:9)', desc: 'Format cinéma panoramique 16:9' },
      auto: { label: 'Original (auto)', desc: 'Proportions d’origine, sans recadrage' },
    },
    spacingTitle: 'Espacement & colonnes',
    spacingSub:
      'Réglez le nombre de colonnes et l’espacement de la grille. Le nombre de colonnes dispose aussi les couvertures d’albums sur une page ; leur espacement reste celui du thème, sauf si une page le remplace.',
    columns: (min: number, max: number) => `Colonnes (${min} - ${max})`,
    gap: 'Espacement (px)',
  },

  footer: {
    title: 'Pied de page & réseaux sociaux',
    sub: 'Affichez le nom de marque et les liens Instagram, e-mail et site web dans le pied de page du portfolio.',
    brandName: 'Nom de marque du pied de page',
    brandNamePlaceholder: 'Ma photographie',
    instagram: 'URL Instagram',
    email: 'E-mail de contact',
    website: 'Site personnel',
    navTitle: 'Liens de navigation de l’en-tête (expérimental)',
    navSub:
      'Liens externes affichés après vos pages dans le menu de l’en-tête. Seules les URL http(s) sont autorisées ; elles s’ouvrent dans un nouvel onglet.',
    linkLabel: 'Libellé',
    linkLabelPlaceholder: 'Boutique',
    linkUrl: 'URL',
    removeLink: 'Retirer le lien',
    addLink: '+ Ajouter un lien externe',
  },

  legal: {
    title: 'Mentions légales & Impressum',
    sub: 'Configurez la page de mentions légales exigée par la loi allemande Digitale-Dienste-Gesetz (DDG).',
    view: 'Voir /impressum ↗',
    enable: 'Activer la page Impressum (/impressum)',
    enableDesc: 'Génère automatiquement /impressum et ajoute le lien dans le pied de page',
    heading: 'Titre',
    headingHint:
      'Laissez vide pour la mention § 5 DDG dans la langue du site. Renseignez-le lorsqu’une autre loi s’applique, par ex. § 5 ECG en Autriche.',
    name: 'Nom complet / raison sociale',
    address: 'Adresse',
    zipCity: 'Code postal & ville',
    country: 'Pays',
    countryPlaceholder: 'Allemagne',
    email: 'E-mail légal',
    phone: 'Numéro de téléphone',
    contactUrl: 'URL du formulaire de contact',
    contactUrlInvalid:
      'Doit commencer par https:// ou http://. Tout autre lien est omis de la page.',
    contactLabel: 'Texte du lien de contact',
    contactLabelPlaceholder: 'Formulaire de contact',
    vatId: 'Numéro de TVA',
    taxId: 'Numéro fiscal',
    extraInfo: 'Informations complémentaires',
    contactForm: 'Formulaire de contact (/contact)',
    contactFormDesc:
      'Les messages sont stockés sur ce serveur et se lisent sous Messages. Aucun e-mail n’est envoyé.',
    notifyUrl: 'URL de notification (ntfy)',
    notifyUrlInvalid: 'Doit commencer par https:// ou http://.',
    notifyUrlHint:
      'Reçoit une notification fixe « nouveau message », sans rien sur l’expéditeur. Choisissez un nom de topic que personne ne peut deviner.',
    notifyUrlEnvOverride: (variable: string) => `${variable} remplace ce réglage.`,
    retention: 'Supprimer les messages après (jours)',
    privacy: 'Politique de confidentialité (/privacy)',
    privacyDesc: 'Affichée et liée dans le pied de page dès que le texte ci-dessous est enregistré',
  },

  seo: {
    title: 'Référencement (SEO)',
    sub: 'Personnalisez les métadonnées pour les moteurs de recherche, les balises OpenGraph et les règles d’indexation.',
    snippetPreview: 'Aperçu du résultat de recherche Google',
    snippetTitle: 'Mon portfolio photo',
    snippetDesc: 'Une sélection soignée de travaux photographiques.',
    siteUrl: 'URL du site',
    siteUrlHint:
      'Nécessaire pour {sitemap}, le flux et les données structurées — ils sont générés sans requête, l’adresse ne peut donc pas en être déduite. Laissez vide et le sitemap reste vide plutôt que de deviner.',
    siteUrlFromEnv:
      'Actuellement fournie par la variable d’environnement {variable} ({value}). Une valeur saisie ici est prioritaire une fois enregistrée.',
    metaTitle: 'Méta-titre SEO',
    metaTitlePlaceholder: 'Remplace le titre du site par défaut dans les résultats Google',
    titleTemplate: 'Modèle de titre des pages',
    titleTemplateFallback: 'Mon portfolio',
    titleTemplateHint:
      'Modèle pour les pages et les albums. Utilisez {placeholder} à la place du titre de la page.',
    previewLabel: 'Aperçu :',
    previewExample: 'Paysages',
    metaDescription: 'Méta-description SEO',
    metaDescriptionPlaceholder: 'Une sélection soignée de travaux photographiques…',
    crawlerTitle: 'Directives pour les robots d’indexation',
    crawlerSub: 'Contrôlez la façon dont Googlebot et les autres robots indexent votre site.',
    noIndex: 'noindex (masquer dans Google)',
    noIndexDesc: 'Demande aux moteurs de recherche de NE PAS indexer ce site dans leurs résultats',
    noFollow: 'nofollow (ne pas suivre les liens)',
    noFollowDesc: 'Demande aux robots des moteurs de recherche de ne pas suivre les liens sortants',
  },

  security: {
    title: 'Mot de passe du site',
    sub: 'Place tout le site public derrière un mot de passe — utile pendant la construction d’un portfolio, ou pour un folio réservé aux clients.',
    sitePassword: 'Mot de passe du site',
    sitePasswordAria: 'Mot de passe du site',
    sitePasswordPlaceholder: 'Laissez vide pour un site public',
    storedHashed: 'Stocké sous forme de hachage {hash} dans {file}, jamais tel que saisi.',
    envOverride: 'La variable d’environnement {variable} remplace ce champ.',
    adminSeparate:
      'Le panneau d’administration garde son propre mot de passe et n’est jamais derrière cette protection.',
    protectionTitle: 'Protection des images & filigrane',
    protectionSub:
      'Configurez la protection des images, le blocage du clic droit et le filigrane superposé.',
    rightClick: 'Désactiver le menu du clic droit',
    rightClickDesc:
      'Empêche le menu contextuel sur les images du portfolio pour freiner les téléchargements non autorisés',
    imageDrag: 'Désactiver le glisser-déposer des images',
    imageDragDesc: 'Empêche les visiteurs de faire glisser les images hors de la page du portfolio',
    watermarkTitle: 'Filigrane dynamique',
    watermarkSub: 'Superpose un texte de copyright sur les images de la visionneuse.',
    watermarkEnable: 'Activer le filigrane',
    watermarkEnableDesc: 'Superpose un texte de copyright à l’affichage des images du portfolio',
    watermarkText: 'Texte du filigrane',
    position: 'Position',
    positionAria: 'Position du filigrane',
    positionBottomRight: 'En bas à droite',
    positionBottomLeft: 'En bas à gauche',
    positionCenter: 'Au centre',
    opacity: (percent: number) => `Opacité (${percent} %)`,
  },

  about: {
    title: 'Page À propos',
    sub: 'Modifiez le portrait, la biographie et le matériel affichés sur la page À propos. Utilisez Général pour afficher ou masquer la page elle-même.',
    portrait: 'ID du média du portrait',
    portraitPlaceholder: 'UUID du média Immich pour la photo de portrait',
    name: 'Nom',
    namePlaceholder: 'Votre nom',
    location: 'Lieu',
    locationPlaceholder: 'Ville, pays',
    gear: 'Matériel (un par ligne)',
    biography: 'Biographie (Markdown)',
    biographyPlaceholder: 'Photographe basé à…',
    conflict: 'Non enregistré — la page À propos a été modifiée ailleurs.',
  },

  privacy: {
    loadError: (error: string) =>
      `La politique de confidentialité n’a pas pu être chargée (${error}). Rechargez la page pour réessayer.`,
    conflict: 'Non enregistré — la politique a été modifiée ailleurs.',
    saveFailed: (status: number) => `Enregistrement impossible (HTTP ${status}).`,
    saved: 'Politique de confidentialité enregistrée.',
    unreachable: 'Impossible de joindre le serveur.',
    factsTitle: 'Ce que ce site traite',
    factsHint:
      'Déduit de votre configuration actuelle. Une liste de contrôle pour rédiger la politique, pas un texte pour la page.',
    thirdParty: 'tiers',
    body: 'Politique de confidentialité (Markdown)',
    /** Example text in the empty editor; keep the Markdown heading. */
    bodyPlaceholder: '## Responsable du traitement\n\nNom, adresse, e-mail…',
    syntaxHint:
      'Titres avec {heading}, listes avec {list}, {bold} et {link}. Affichée sur /privacy et liée dans le pied de page dès qu’il y a du texte. Les versions précédentes sont conservées sous Sauvegardes.',
    insertHeadings: 'Insérer les titres',
    view: 'Voir /privacy ↗',
    save: 'Enregistrer la politique de confidentialité',
  },

  fields: {
    configure: 'Configurer →',
    locked: 'Verrouillé',
    envLockNote:
      'Défini par {variable} dans l’environnement. Modifiez-le ou supprimez-le à cet endroit ; une modification ici resterait sans effet.',
    columnsPlaceholder: 'Colonnes (valeur du site)',
    columnsAria: 'Colonnes',
    gapPlaceholder: 'Espacement en px (valeur du thème)',
    gapAria: 'Espacement en px',
    passwordPlaceholder: 'Laissez vide pour un accès public',
    passwordProtected: 'Protégé',
    passwordChange: 'Modifier',
    passwordNew: 'Nouveau mot de passe',
    passwordHide: 'Masquer le mot de passe',
    passwordShow: 'Afficher le mot de passe',
    passwordKeep: 'Conserver le mot de passe actuel',
    zoom: 'Zoom sur les photos',
    zoomOn: 'Activé — les visiteurs peuvent zoomer en pleine résolution',
    zoomOff: 'Désactivé',
  },
};
