import type { AdminDictionary } from '../index';

// CLDR: French puts 0 in the singular, unlike English.
const isOne = (n: number) => n <= 1;

/**
 * The diagnostics page (`app/admin/components/DiagnosticsView.tsx`). The doctor's
 * findings themselves are in `doctor.ts`; the alt-text finding is built here,
 * on the page, and lives under `altText`.
 */
export const diagnostics: AdminDictionary['diagnostics'] = {
  groups: {
    connection: 'Connexion',
    security: 'Sécurité',
    content: 'Contenu',
  },

  levels: {
    ok: 'OK',
    warn: 'À vérifier',
    error: 'Problème',
  },

  fixes: {
    howToSetIt: 'Comment le définir',
    cdnSetup: 'Configurer le CDN',
    openSettings: 'Ouvrir les paramètres',
    openPages: 'Ouvrir les pages',
    openInPages: 'Ouvrir dans Pages',
    howToFix: 'Comment corriger',
    howToSetUp: 'Comment le configurer',
    apiKeyPermissions: 'Permissions de la clé API',
  },

  altText: {
    captionsOffTitle: 'Les descriptions des photos ne servent pas de texte alternatif',
    captionsOffDetail:
      '« Description de la photo » est désactivé dans Paramètres → Général, donc chaque photo du site a un texte alternatif vide, quel que soit le contenu d’Immich.',
    /** Appended to the details below, so it starts with a space. */
    unreadable: (n: number) =>
      isOne(n)
        ? ` ${n} album n’a pas pu être lu et n’est pas compté.`
        : ` ${n} albums n’ont pas pu être lus et ne sont pas comptés.`,
    allTitle: (total: number) => `Toutes les photos publiées (${total}) ont un texte alternatif`,
    allDetail: (unreadable: string) => `Chaque photo porte sa description Immich.${unreadable}`,
    missingTitle: (n: number) =>
      isOne(n)
        ? `${n} photo publiée n’a pas de texte alternatif`
        : `${n} photos publiées n’ont pas de texte alternatif`,
    missingDetail: (unreadable: string) =>
      `Folio utilise la description Immich comme texte alternatif. Sans elle, les lecteurs d’écran n’annoncent rien et les moteurs de recherche n’indexent rien pour la photo.${unreadable}`,
    pendingTitle: 'Vérification des textes alternatifs…',
    pendingDetail: 'Lecture de chaque album publié ; les grandes photothèques prennent un moment.',
    failedTitle: 'Les textes alternatifs n’ont pas pu être vérifiés',
    failedDetail:
      'Les albums ne se sont pas chargés. Si Immich est déconnecté, c’est la raison — réessayez quand il sera de retour.',
    coverage: (described: number, total: number, percent: number) =>
      `${described} sur ${total} ${isOne(described) ? 'décrite' : 'décrites'} · ${percent} %`,
    albumMissing: (missing: number, total: number) =>
      `${missing} sur ${total} ${isOne(missing) ? 'manquante' : 'manquantes'}`,
    openInImmich: (fileName: string) => `${fileName} — ouvrir dans Immich`,
    more: (n: number) => `+${n} ${isOne(n) ? 'autre' : 'autres'}`,
    showPhotos: 'Afficher les photos',
    hidePhotos: 'Masquer les photos',
    noteAdd:
      'Ajoutez la description dans Immich, puis cliquez sur Recharger dans la barre supérieure.',
    noteExternal: 'Les photos s’ouvrent sur {url}, le domaine externe d’Immich.',
    /** The menu path is Immich's own English UI. */
    noteInternal:
      'Les photos s’ouvrent sur {url} — l’adresse à laquelle Folio joint Immich, que votre navigateur ne pourra peut-être pas ouvrir. Définissez {setting} dans Immich (Administration → Settings → Server) et les liens utiliseront cette adresse.',
    /** The name of the setting in Immich's own (English) interface — kept in English. */
    externalDomain: 'External domain',
  },

  header: {
    kicker: 'Système',
    checking: 'Vérification…',
    allClear: 'Rien ne requiert votre attention',
    attention: (n: number, total: number) =>
      isOne(n)
        ? `${n} contrôle sur ${total} mérite un coup d’œil`
        : `${n} contrôles sur ${total} méritent un coup d’œil`,
    lastRun: (date: string) => `Dernière exécution : ${date}`,
    running: 'Exécution des contrôles…',
    runAgain: 'Relancer',
    copyTitle: 'Markdown, prêt à coller dans un ticket',
    copy: 'Copier le rapport',
    copied: 'Copié',
  },

  errors: {
    failed: (reason: string) => `Échec du diagnostic. ${reason}`,
    copyFailed: 'Copie impossible — votre navigateur a refusé l’accès au presse-papiers.',
  },

  report: {
    heading: 'Diagnostic Immich Folio',
    version: (version: string) => `Version ${version}`,
  },

  vitals: {
    aria: 'Vue d’ensemble',
    immich: 'Immich',
    connected: 'Connecté',
    disconnected: 'Déconnecté',
    config: 'Configuration',
    valid: 'Valide',
    invalid: 'Non valide',
    notSetUp: 'Non configurée',
    backups: 'Sauvegardes',
    latest: (date: string) => `dernière : ${date}`,
    noneYet: 'aucune pour l’instant',
    version: 'Version',
    available: (version: string) => `${version} disponible`,
    upToDate: 'à jour',
  },

  needsAttention: 'À traiter',

  storage: {
    title: 'Stockage & cache',
    backupsTitle: (n: number) =>
      `${n} ${isOne(n) ? 'sauvegarde de configuration' : 'sauvegardes de configuration'}`,
    backupsDetail: 'Écrites avant chaque enregistrement dans l’administration, dix par fichier.',
    manageBackups: 'Gérer les sauvegardes',
    cacheTitle: (n: number) =>
      `Le cache en mémoire contient ${n} ${isOne(n) ? 'élément' : 'éléments'}`,
    cacheDetail:
      'Listes d’albums et métadonnées des photos venant d’Immich. Le vider ralentit les prochains affichages de pages, rien de plus.',
    clearing: 'Vidage…',
    clearCache: 'Vider le cache',
  },
};
