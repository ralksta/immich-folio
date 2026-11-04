import type { AdminDictionary } from '../index';

// CLDR: French puts 0 in the singular, unlike English.
const isOne = (n: number) => n <= 1;

/**
 * The sidebar's "Visitors" group: the contact form inbox, client proofing
 * links and the view counts.
 */
export const visitors: AdminDictionary['visitors'] = {
  /** The page header's kicker above each of the three screens. */
  kicker: 'Visiteurs',
  refresh: 'Actualiser',

  messages: {
    title: 'Messages',
    unread: (n: number) => `${n} ${isOne(n) ? 'non lu' : 'non lus'}`,
    description: (days: number) =>
      `Envoyés via le formulaire de contact sur /contact. Stockés sur ce serveur et supprimés au bout de ${days} ${isOne(days) ? 'jour' : 'jours'}.`,
    /** `{link}` is a link labelled with `formOffLink`. */
    formOff: 'Le formulaire de contact est désactivé, aucun nouveau message n’arrive donc. {link}.',
    formOffLink: 'Activez-le dans Paramètres → Mentions légales',
    noNotify:
      'Aucune notification n’est configurée, les nouveaux messages n’apparaissent donc qu’ici. {link}.',
    noNotifyLink: 'Ajoutez une URL ntfy dans Paramètres → Mentions légales',
    empty: 'Aucun message.',
    /** Read out after the sender's name by screen readers. */
    unreadMarker: ' (non lu)',
    reply: 'Répondre par e-mail',
    markUnread: 'Marquer comme non lu',
    delete: 'Supprimer',
    deleteTitle: (name: string) => `Supprimer le message de ${name} ?`,
    deleteMessage: 'Il est supprimé de ce serveur et ne peut pas être restauré.',
    deleteFailed: (status: number) => `Échec de la suppression (HTTP ${status}).`,
    /** The reply mail's subject line, prefilled in the owner's mail client. */
    replySubject: 'Re : votre message',
    /** Introduces the quoted original in the reply mail. */
    replyQuote: (name: string) => `${name} a écrit :`,
  },

  /** Each card is a client's selection (feminine: "créée", "envoyée"). */
  proofing: {
    title: 'Sélection client',
    description:
      'Un lien privé par client. Les choix sont enregistrés au fur et à mesure ; vous les voyez ici une fois la sélection envoyée.',
    /** `{env}` is the PROOFING_WEBHOOK_URL variable name. */
    webhookTip:
      'Astuce : définissez {env} pour être averti (Discord, Slack, Gotify, n8n, …) lorsqu’un client envoie sa sélection.',
    empty: 'Aucun lien client pour le moment.',
    states: {
      open: 'Ouverte',
      submitted: 'Envoyée',
      expired: 'Expirée',
    },
    downloads: {
      none: 'Aucun téléchargement',
      selection: 'Sélection en ZIP',
      album: 'Album complet en ZIP',
    },
    create: {
      title: 'Nouveau lien client',
      client: 'Client',
      clientPlaceholder: 'Camille & Louis',
      album: 'Album',
      chooseAlbum: 'Choisissez un album Immich…',
      loadingAlbums: 'Chargement des albums…',
      validUntil: 'Valable jusqu’au (facultatif)',
      downloads: 'Téléchargements',
      limit: 'Limite de téléchargements (facultatif)',
      unlimited: 'Illimité',
      creating: 'Création…',
      submit: 'Créer le lien',
    },
    card: {
      albumMissing: 'Album introuvable dans Immich',
      /** `of` is null when the album's size is unknown. */
      selected: (n: number, of: number | null) => {
        const word = isOne(n) ? 'sélectionnée' : 'sélectionnées';
        return of === null ? `${n} ${word}` : `${n} sur ${of} ${word}`;
      },
      created: (date: string) => `créée le ${date}`,
      validUntil: (date: string) => `valable jusqu’au ${date}`,
      /** `limit` is null when downloads are unlimited. */
      downloadsUsed: (used: number, limit: number | null) => {
        const word = isOne(used) ? 'utilisé' : 'utilisés';
        return limit === null ? `${used} ${word}` : `${used} / ${limit} ${word}`;
      },
      submitted: (date: string) => `envoyée le ${date}`,
      copied: 'Copié',
      copyLink: 'Copier le lien',
      /** Label of the browser prompt shown when the clipboard is unavailable. */
      copyPrompt: 'Copier :',
      open: 'Ouvrir',
      selection: 'Sélection',
      lightroomTitle:
        'Noms de fichiers sans extension, séparés par des virgules — à coller dans le filtre de nom de fichier de Lightroom ou de Capture One pour retrouver aussi les fichiers RAW',
      copyLightroom: 'Copier les noms de fichiers (Lightroom)',
      reopen: 'Rouvrir pour modification',
      resetDownloads: 'Réinitialiser les téléchargements',
      deleteLink: 'Supprimer le lien',
      deleteConfirm: (client: string) =>
        `Supprimer le lien de ${client} ? Il cesse de fonctionner immédiatement.`,
      noPicks: 'Aucune photo sélectionnée pour le moment.',
    },
  },

  analytics: {
    title: 'Statistiques',
    description:
      'Comptage des pages vues sans cookies, conservé sur ce serveur. Aucune donnée personnelle n’est collectée.',
    /** `{title}` is `disabledTitle`, shown bold; `{where}` is `disabledWhere`, in italics. */
    disabled:
      '{title} Aucune nouvelle vue n’est enregistrée. Vous pouvez réactiver le suivi à tout moment sous {where}.',
    disabledTitle: 'Le suivi des statistiques est actuellement désactivé.',
    disabledWhere: 'Paramètres → Général',
    totalViews: 'Total des pages vues',
    lifetime: 'Cumul depuis le début',
    activeDays: 'Jours actifs suivis',
    daysRecorded: 'Jours enregistrés',
    devices: 'Ordinateur ou mobile',
    deviceSplit: 'Répartition par appareil',
    dailyTrend: 'Évolution quotidienne du trafic (14 derniers jours)',
    /** Tooltip on one bar of the chart. */
    dayViews: (date: string, n: number) => `${date} : ${n} ${isOne(n) ? 'vue' : 'vues'}`,
    noViews:
      'Aucune page vue enregistrée pour le moment. Visitez les pages du portfolio pour lancer le suivi !',
    topPages: 'Pages les plus visitées',
    noPages: 'Aucune page enregistrée pour le moment.',
    pageViews: (n: number) => `${n} ${isOne(n) ? 'vue' : 'vues'}`,
  },
};
