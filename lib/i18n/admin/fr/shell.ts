import type { AdminDictionary } from '../index';

// CLDR: French puts 0 in the singular, unlike English.
const isOne = (n: number) => n <= 1;

/**
 * The panel's frame: sign-in, the sidebar, the status dropdown, the floating
 * save bar and the overview at /admin.
 */
export const shell: AdminDictionary['shell'] = {
  gate: {
    loading: 'Chargement du panneau d’administration',
    disabledTitle: 'Panneau d’administration',
    disabledBody:
      'Le panneau d’administration n’est pas activé. Définissez {env} dans vos variables d’environnement pour l’activer.',
    sessionExpired: 'Votre session a expiré. Reconnectez-vous.',
  },

  login: {
    subtitle: 'Panneau d’administration',
    password: 'Mot de passe',
    passwordPlaceholder: 'Saisissez le mot de passe administrateur',
    signIn: 'Se connecter',
    signingIn: 'Connexion…',
    failed: 'Échec de la connexion',
    connectionError: 'Erreur de connexion',
  },

  nav: {
    groups: {
      content: 'Contenu',
      visitors: 'Visiteurs',
      site: 'Site',
      system: 'Système',
    },
    overview: 'Vue d’ensemble',
    pages: 'Pages',
    journal: 'Journal',
    messages: 'Messages',
    proofing: 'Sélections',
    analytics: 'Statistiques',
    settings: 'Paramètres',
    diagnostics: 'Diagnostics',
    help: 'Aide',
    unread: (n: number) => `${n} ${isOne(n) ? 'non lu' : 'non lus'}`,
  },

  sidebar: {
    skipToContent: 'Aller au contenu',
    landmark: 'Administration',
    expand: 'Déplier la barre latérale',
    collapse: 'Replier la barre latérale',
    /** Tooltip on the collapsed sidebar's toggle; keep it to one short word. */
    expandShort: 'Déplier',
    brandSub: 'Admin',
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
    viewSite: 'Voir le site',
    viewSiteTitle: 'Ouvrir le site dans un nouvel onglet (sans cache)',
    backups: 'Sauvegardes',
    backupsTitle: 'Gérer et restaurer les sauvegardes de configuration',
    reload: 'Recharger',
    reloadTitle: 'Recharger la configuration et vider le cache',
    reloadFailed: (status: number) => `Échec du rechargement (HTTP ${status}).`,
    signOut: 'Se déconnecter',
  },

  status: {
    showTitle: 'Afficher l’état du système',
    heading: 'Diagnostic du système',
    refreshTitle: 'Actualiser le diagnostic',
    checking: 'Vérification…',
    /** `{wizard}` is `setupWizard` below, hence the elided article "l’". */
    missingCredentials:
      'Aucune URL Immich ni clé API configurée. Définissez {apiUrl} et {apiKey}, ou lancez l’{wizard}.',
    noGallery:
      'Pas encore de {file} — le site public n’a rien à montrer. Ajoutez une page ci-dessous, ou lancez l’{wizard} (le jeton à usage unique est affiché dans le journal du serveur).',
    setupWizard: 'assistant d’installation',
    immich: 'Connexion à Immich',
    connected: 'Connecté',
    disconnected: 'Déconnecté',
    config: 'Intégrité de la configuration',
    configValid: 'Valide',
    configDegraded: 'Dégradée',
    configNotSetUp: 'Non configurée',
    backups: 'Sauvegardes de configuration',
    backupCount: (n: number) => `${n} ${isOne(n) ? 'sauvegarde' : 'sauvegardes'}`,
    latestBackup: 'Dernière sauvegarde',
    cache: 'Cache en mémoire',
    cacheItems: (n: number) => `${n} ${isOne(n) ? 'élément' : 'éléments'}`,
    version: 'Version',
    updateAvailable: (version: string) => `La version ${version} est disponible`,
  },

  health: {
    checking: 'Vérification…',
    setupIncomplete: 'Installation incomplète',
    degraded: 'Système dégradé',
    needsAttention: 'Attention requise',
    checkDiagnostics: 'Voir le diagnostic',
    ok: 'Système OK',
    unknown: 'État inconnu',
  },

  loadState: {
    retry: 'Réessayer',
    loading: 'Chargement',
  },

  /**
   * `subjects` carry their preposition and article ("aux paramètres") so they
   * read after "apportées" in `restored` and `stale`.
   */
  draft: {
    subjects: {
      settings: 'aux paramètres',
      about: 'à la page À propos',
      privacy: 'à la politique de confidentialité',
      pageStructure: 'à la structure des pages',
      page: 'à la page',
      entry: 'à l’article',
    },
    restored: (subject: string) =>
      `Vos modifications non enregistrées apportées ${subject} ont été restaurées. Elles ne sont pas encore enregistrées.`,
    stale: (subject: string) =>
      `Vous avez des modifications non enregistrées apportées ${subject} lors d’une session précédente, mais le contenu a été enregistré ailleurs depuis. Les restaurer remplacera cette version lors de l’enregistrement.`,
    discardChanges: 'Abandonner les modifications',
    ok: 'OK',
    restore: 'Restaurer mes modifications',
    discardThem: 'Les abandonner',
  },

  /** `subjects` start the `message` sentence; "a changé" avoids gender agreement. */
  conflict: {
    subjects: {
      settings: 'Le fichier des paramètres',
      about: 'La page À propos',
      privacy: 'La politique de confidentialité',
      pageStructure: 'La structure des pages (gallery.yaml)',
      page: 'Cette page',
      entry: 'Cet article',
    },
    title: 'Modifié ailleurs',
    message: (subject: string) =>
      `${subject} a changé depuis son ouverture — dans un autre onglet, sur un autre appareil, à la main ou par la restauration d’une sauvegarde. Enregistrer maintenant remplacerait ce changement.`,
    overwrite: 'Écraser quand même',
    reload: 'Recharger (abandonner les miennes)',
    keepEditing: 'Continuer la modification',
  },

  fetch: {
    loadFailed: (status: number, detail: string) =>
      detail
        ? `Échec du chargement (HTTP ${status}) : ${detail}.`
        : `Échec du chargement (HTTP ${status}).`,
    unreachable: 'Impossible de joindre le serveur.',
  },

  notifications: {
    dismiss: 'Fermer',
  },

  saveBar: {
    unsaved: 'Modifications non enregistrées',
    preview: '↗ Aperçu du site',
    previewTitle: 'Ouvrir le site dans un nouvel onglet (sans cache)',
    saving: 'Enregistrement…',
  },

  overview: {
    kicker: 'Vue d’ensemble',
    goodNight: 'Bonne nuit',
    goodMorning: 'Bonjour',
    goodAfternoon: 'Bon après-midi',
    goodEvening: 'Bonsoir',
    needsLook: (n: number) =>
      isOne(n) ? `${n} point mérite un coup d’œil.` : `${n} points méritent un coup d’œil.`,
    allInOrder: 'Tout est en ordre.',
    checking: 'Vérification du site…',
    viewSite: 'Voir le site',
    editPages: 'Modifier les pages',
    attention: 'À traiter',
    unreadMessages: (n: number) => `${n} ${isOne(n) ? 'message non lu' : 'messages non lus'}`,
    from: (names: string) => `De ${names}`,
    open: 'Ouvrir',
    calm: 'Rien en attente. Les nouveaux messages et les problèmes s’affichent ici.',
    glance: 'En un coup d’œil',
    pages: 'Pages',
    /** Counts pages (feminine). */
    switchedOff: (n: number) => `${n} ${isOne(n) ? 'désactivée' : 'désactivées'}`,
    allPublished: 'toutes publiées',
    heroPhotos: 'Photos d’accueil',
    onHomePage: 'sur la page d’accueil',
    journal: 'Journal',
    drafts: (n: number) => `${n} ${isOne(n) ? 'brouillon' : 'brouillons'}`,
    noDrafts: 'aucun brouillon',
    views7: 'Vues · 7 jours',
    cookieless: 'comptage sans cookies',
    quickActions: 'Actions rapides',
    newEntry: 'Nouvel article du journal',
    messages: 'Messages',
    theme: 'Thème',
    diagnostics: 'Diagnostics',
  },
};
