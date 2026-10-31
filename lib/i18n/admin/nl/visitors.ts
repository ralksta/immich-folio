import type { AdminDictionary } from '../index';

/**
 * The sidebar's "Visitors" group: the contact form inbox, client proofing
 * links and the view counts.
 */
export const visitors: AdminDictionary['visitors'] = {
  /** The page header's kicker above each of the three screens. */
  kicker: 'Bezoekers',
  refresh: 'Vernieuwen',

  messages: {
    title: 'Berichten',
    unread: (n: number) => `${n} ongelezen`,
    description: (days: number) =>
      `Verstuurd via het contactformulier op /contact. Opgeslagen op deze server en na ${days} ${days === 1 ? 'dag' : 'dagen'} verwijderd.`,
    /** `{link}` is a link labelled with `formOffLink`. */
    formOff: 'Het contactformulier staat uit, dus er komen geen nieuwe berichten binnen. {link}.',
    formOffLink: 'Zet het aan onder Instellingen → Juridisch',
    noNotify: 'Er is geen melding ingesteld, dus nieuwe berichten verschijnen alleen hier. {link}.',
    noNotifyLink: 'Voeg een ntfy-URL toe onder Instellingen → Juridisch',
    empty: 'Geen berichten.',
    /** Read out after the sender's name by screen readers. */
    unreadMarker: ' (ongelezen)',
    reply: 'Per e-mail antwoorden',
    markUnread: 'Als ongelezen markeren',
    delete: 'Verwijderen',
    deleteTitle: (name: string) => `Het bericht van ${name} verwijderen?`,
    deleteMessage: 'Het wordt van deze server verwijderd en kan niet worden teruggezet.',
    deleteFailed: (status: number) => `Verwijderen mislukt (HTTP ${status}).`,
    /** The reply mail's subject line, prefilled in the owner's mail client. */
    replySubject: 'Re: je bericht',
    /** Introduces the quoted original in the reply mail. */
    replyQuote: (name: string) => `${name} schreef:`,
  },

  proofing: {
    title: 'Klantselectie',
    description:
      'Een privélink per klant. Keuzes worden meteen opgeslagen; je ziet ze hier zodra de klant de selectie verstuurt.',
    /** `{env}` is the PROOFING_WEBHOOK_URL variable name. */
    webhookTip:
      'Tip: stel {env} in om een melding te krijgen (Discord, Slack, Gotify, n8n, …) wanneer een klant een selectie verstuurt.',
    empty: 'Nog geen klantlinks.',
    states: {
      open: 'Open',
      submitted: 'Verstuurd',
      expired: 'Verlopen',
    },
    downloads: {
      none: 'Geen downloads',
      selection: 'Selectie als ZIP',
      album: 'Heel album als ZIP',
    },
    create: {
      title: 'Nieuwe klantlink',
      client: 'Klant',
      clientPlaceholder: 'Sanne & Bram',
      album: 'Album',
      chooseAlbum: 'Kies een Immich-album…',
      loadingAlbums: 'Albums laden…',
      validUntil: 'Geldig tot (optioneel)',
      downloads: 'Downloads',
      limit: 'Downloadlimiet (optioneel)',
      unlimited: 'Onbeperkt',
      creating: 'Aanmaken…',
      submit: 'Link aanmaken',
    },
    card: {
      albumMissing: 'Album niet gevonden in Immich',
      /** `of` is null when the album's size is unknown. */
      selected: (n: number, of: number | null) =>
        of === null ? `${n} geselecteerd` : `${n} van ${of} geselecteerd`,
      created: (date: string) => `aangemaakt op ${date}`,
      validUntil: (date: string) => `geldig tot ${date}`,
      /** `limit` is null when downloads are unlimited. */
      downloadsUsed: (used: number, limit: number | null) =>
        limit === null ? `${used} gebruikt` : `${used} / ${limit} gebruikt`,
      submitted: (date: string) => `verstuurd op ${date}`,
      copied: 'Gekopieerd',
      copyLink: 'Link kopiëren',
      /** Label of the browser prompt shown when the clipboard is unavailable. */
      copyPrompt: 'Kopiëren:',
      open: 'Openen',
      selection: 'Selectie',
      lightroomTitle:
        'Bestandsnamen zonder extensie, gescheiden door komma’s — plak ze in het bestandsnaamfilter van Lightroom of Capture One om ook de RAW-bestanden te vinden',
      copyLightroom: 'Bestandsnamen kopiëren (Lightroom)',
      reopen: 'Heropenen voor wijzigingen',
      resetDownloads: 'Downloads resetten',
      deleteLink: 'Link verwijderen',
      deleteConfirm: (client: string) =>
        `De link voor ${client} verwijderen? Die werkt dan meteen niet meer.`,
      noPicks: 'Nog geen foto’s geselecteerd.',
    },
  },

  analytics: {
    title: 'Statistieken',
    description:
      'Paginatellingen zonder cookies, bewaard op deze server. Er worden geen persoonsgegevens verzameld.',
    /** `{title}` is `disabledTitle`, shown bold; `{where}` is `disabledWhere`, in italics. */
    disabled:
      '{title} Er worden geen nieuwe weergaven van bezoekers geregistreerd. Je kunt het tellen altijd weer inschakelen onder {where}.',
    disabledTitle: 'Het bijhouden van statistieken staat momenteel uit.',
    disabledWhere: 'Instellingen → Algemeen',
    totalViews: 'Totaal aantal paginaweergaven',
    lifetime: 'Totaal sinds het begin',
    activeDays: 'Bijgehouden actieve dagen',
    daysRecorded: 'Geregistreerde dagen',
    devices: 'Desktop vs. mobiel',
    deviceSplit: 'Verdeling over apparaten',
    dailyTrend: 'Dagelijks verkeer (laatste 14 dagen)',
    /** Tooltip on one bar of the chart. */
    dayViews: (date: string, n: number) => `${date}: ${n} ${n === 1 ? 'weergave' : 'weergaven'}`,
    noViews:
      'Nog geen paginaweergaven geregistreerd. Bezoek pagina’s van je portfolio om het tellen te starten!',
    topPages: 'Meest bezochte pagina’s',
    noPages: 'Nog geen pagina’s geregistreerd.',
    pageViews: (n: number) => `${n} ${n === 1 ? 'weergave' : 'weergaven'}`,
  },
};
