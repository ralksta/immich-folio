import type { AdminDictionary } from '../index';

/**
 * The sidebar's "Visitors" group: the contact form inbox, client proofing
 * links and the view counts.
 */
export const visitors: AdminDictionary['visitors'] = {
  /** The page header's kicker above each of the three screens. */
  kicker: 'Visitatori',
  refresh: 'Aggiorna',

  messages: {
    title: 'Messaggi',
    unread: (n: number) => `${n} ${n === 1 ? 'non letto' : 'non letti'}`,
    description: (days: number) =>
      `Inviati tramite il modulo di contatto su /contact. Salvati su questo server ed eliminati dopo ${days} ${days === 1 ? 'giorno' : 'giorni'}.`,
    /** `{link}` is a link labelled with `formOffLink`. */
    formOff: 'Il modulo di contatto è disattivato, quindi non arrivano nuovi messaggi. {link}.',
    formOffLink: 'Attivalo in Impostazioni → Note legali',
    noNotify:
      'Non è configurata alcuna notifica, quindi i nuovi messaggi compaiono solo qui. {link}.',
    noNotifyLink: 'Aggiungi un URL ntfy in Impostazioni → Note legali',
    empty: 'Nessun messaggio.',
    /** Read out after the sender's name by screen readers. */
    unreadMarker: ' (non letto)',
    reply: 'Rispondi via e-mail',
    markUnread: 'Segna come non letto',
    delete: 'Elimina',
    deleteTitle: (name: string) => `Eliminare il messaggio di ${name}?`,
    deleteMessage: 'Viene rimosso da questo server e non può essere ripristinato.',
    deleteFailed: (status: number) => `Eliminazione non riuscita (HTTP ${status}).`,
    /** The reply mail's subject line, prefilled in the owner's mail client. */
    replySubject: 'Re: il tuo messaggio',
    /** Introduces the quoted original in the reply mail. */
    replyQuote: (name: string) => `${name} ha scritto:`,
  },

  proofing: {
    title: 'Selezioni dei clienti',
    description:
      'Un link privato per ogni cliente. Le scelte vengono salvate man mano; le vedi qui quando il cliente invia la selezione.',
    /** `{env}` is the PROOFING_WEBHOOK_URL variable name. */
    webhookTip:
      'Suggerimento: imposta {env} per ricevere una notifica (Discord, Slack, Gotify, n8n, …) quando un cliente invia la selezione.',
    empty: 'Ancora nessun link per i clienti.',
    /** The link's state (masculine: «il link»). */
    states: {
      open: 'Aperto',
      submitted: 'Inviato',
      expired: 'Scaduto',
    },
    downloads: {
      none: 'Nessun download',
      selection: 'Selezione in ZIP',
      album: 'Album intero in ZIP',
    },
    create: {
      title: 'Nuovo link per un cliente',
      client: 'Cliente',
      clientPlaceholder: 'Anna e Luca',
      album: 'Album',
      chooseAlbum: 'Scegli un album di Immich…',
      loadingAlbums: 'Caricamento degli album…',
      validUntil: 'Valido fino al (facoltativo)',
      downloads: 'Download',
      limit: 'Limite di download (facoltativo)',
      unlimited: 'Illimitati',
      creating: 'Creazione…',
      submit: 'Crea link',
    },
    card: {
      albumMissing: 'Album non trovato in Immich',
      /** `of` is null when the album's size is unknown. */
      selected: (n: number, of: number | null) =>
        `${of === null ? n : `${n} su ${of}`} ${n === 1 ? 'selezionata' : 'selezionate'}`,
      created: (date: string) => `creato il ${date}`,
      validUntil: (date: string) => `valido fino al ${date}`,
      /** `limit` is null when downloads are unlimited. */
      downloadsUsed: (used: number, limit: number | null) =>
        `${limit === null ? used : `${used} / ${limit}`} ${used === 1 ? 'usato' : 'usati'}`,
      submitted: (date: string) => `inviato il ${date}`,
      copied: 'Copiato',
      copyLink: 'Copia link',
      /** Label of the browser prompt shown when the clipboard is unavailable. */
      copyPrompt: 'Copia:',
      open: 'Apri',
      selection: 'Selezione',
      lightroomTitle:
        'Nomi dei file senza estensione, separati da virgole: incollali nel filtro per nome file di Lightroom o di Capture One per trovare anche i file RAW',
      copyLightroom: 'Copia i nomi dei file (Lightroom)',
      reopen: 'Riapri per modifiche',
      resetDownloads: 'Azzera i download',
      deleteLink: 'Elimina link',
      deleteConfirm: (client: string) =>
        `Eliminare il link per ${client}? Smette subito di funzionare.`,
      noPicks: 'Ancora nessuna foto selezionata.',
    },
  },

  analytics: {
    title: 'Statistiche',
    description:
      'Conteggio delle pagine senza cookie, salvato su questo server. Non viene raccolto alcun dato personale.',
    /** `{title}` is `disabledTitle`, shown bold; `{where}` is `disabledWhere`, in italics. */
    disabled:
      '{title} Non vengono registrate nuove visualizzazioni. Puoi riattivare il conteggio in qualsiasi momento in {where}.',
    disabledTitle: 'Il conteggio delle statistiche è disattivato.',
    disabledWhere: 'Impostazioni → Generale',
    totalViews: 'Visualizzazioni totali',
    lifetime: 'Totale complessivo',
    activeDays: 'Giorni con visite',
    daysRecorded: 'Giorni registrati',
    devices: 'Desktop e mobile',
    deviceSplit: 'Ripartizione per dispositivo',
    dailyTrend: 'Andamento giornaliero (ultimi 14 giorni)',
    /** Tooltip on one bar of the chart. */
    dayViews: (date: string, n: number) =>
      `${date}: ${n} ${n === 1 ? 'visualizzazione' : 'visualizzazioni'}`,
    noViews:
      'Ancora nessuna visualizzazione registrata. Visita le pagine del portfolio per avviare il conteggio.',
    topPages: 'Pagine più visitate',
    noPages: 'Ancora nessuna pagina registrata.',
    pageViews: (n: number) => `${n} ${n === 1 ? 'visualizzazione' : 'visualizzazioni'}`,
  },
};
