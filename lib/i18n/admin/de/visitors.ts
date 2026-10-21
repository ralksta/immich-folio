import type { AdminDictionary } from '../index';

/**
 * The sidebar's "Visitors" group: the contact form inbox, client proofing
 * links and the view counts.
 */
export const visitors: AdminDictionary['visitors'] = {
  /** The page header's kicker above each of the three screens. */
  kicker: 'Besucher',
  refresh: 'Aktualisieren',

  messages: {
    title: 'Nachrichten',
    unread: (n: number) => `${n} ungelesen`,
    description: (days: number) =>
      `Über das Kontaktformular unter /contact gesendet. Auf diesem Server gespeichert und nach ${days} ${days === 1 ? 'Tag' : 'Tagen'} gelöscht.`,
    /** `{link}` is a link labelled with `formOffLink`. */
    formOff: 'Das Kontaktformular ist ausgeschaltet, es kommen keine neuen Nachrichten an. {link}.',
    formOffLink: 'Unter Einstellungen → Rechtliches einschalten',
    noNotify: 'Keine Benachrichtigung eingerichtet, neue Nachrichten erscheinen nur hier. {link}.',
    noNotifyLink: 'Unter Einstellungen → Rechtliches eine ntfy-URL hinterlegen',
    empty: 'Keine Nachrichten.',
    /** Read out after the sender's name by screen readers. */
    unreadMarker: ' (ungelesen)',
    reply: 'Per E-Mail antworten',
    markUnread: 'Als ungelesen markieren',
    delete: 'Löschen',
    deleteTitle: (name: string) => `Die Nachricht von ${name} löschen?`,
    deleteMessage: 'Sie wird von diesem Server entfernt und lässt sich nicht wiederherstellen.',
    deleteFailed: (status: number) => `Löschen fehlgeschlagen (HTTP ${status}).`,
    /** The reply mail's subject line, prefilled in the owner's mail client. */
    replySubject: 'Re: deine Nachricht',
    /** Introduces the quoted original in the reply mail. */
    replyQuote: (name: string) => `${name} schrieb:`,
  },

  proofing: {
    title: 'Kundenauswahl',
    description:
      'Ein privater Link pro Kunde. Die Auswahl wird laufend gespeichert; hier siehst du sie, sobald sie abgeschickt wurde.',
    /** `{env}` is the PROOFING_WEBHOOK_URL variable name. */
    webhookTip:
      'Tipp: Setze {env}, um benachrichtigt zu werden (Discord, Slack, Gotify, n8n, …), wenn ein Kunde seine Auswahl abschickt.',
    empty: 'Noch keine Kundenlinks.',
    states: {
      open: 'Offen',
      submitted: 'Abgeschickt',
      expired: 'Abgelaufen',
    },
    downloads: {
      none: 'Keine Downloads',
      selection: 'Auswahl als ZIP',
      album: 'Ganzes Album als ZIP',
    },
    create: {
      title: 'Neuer Kundenlink',
      client: 'Kunde',
      clientPlaceholder: 'Anna & Ben',
      album: 'Album',
      chooseAlbum: 'Immich-Album wählen…',
      loadingAlbums: 'Alben werden geladen…',
      validUntil: 'Gültig bis (optional)',
      downloads: 'Downloads',
      limit: 'Download-Limit (optional)',
      unlimited: 'Unbegrenzt',
      creating: 'Wird erstellt…',
      submit: 'Link erstellen',
    },
    card: {
      albumMissing: 'Album in Immich nicht gefunden',
      /** `of` is null when the album's size is unknown. */
      selected: (n: number, of: number | null) =>
        of === null ? `${n} ausgewählt` : `${n} von ${of} ausgewählt`,
      created: (date: string) => `erstellt am ${date}`,
      validUntil: (date: string) => `gültig bis ${date}`,
      /** `limit` is null when downloads are unlimited. */
      downloadsUsed: (used: number, limit: number | null) =>
        limit === null ? `${used} genutzt` : `${used} / ${limit} genutzt`,
      submitted: (date: string) => `abgeschickt am ${date}`,
      copied: 'Kopiert',
      copyLink: 'Link kopieren',
      /** Label of the browser prompt shown when the clipboard is unavailable. */
      copyPrompt: 'Kopieren:',
      open: 'Öffnen',
      selection: 'Auswahl',
      lightroomTitle:
        'Dateinamen ohne Endung, kommagetrennt — in den Dateinamenfilter von Lightroom oder Capture One einfügen, um auch die RAW-Dateien zu finden',
      copyLightroom: 'Dateinamen kopieren (Lightroom)',
      reopen: 'Für Änderungen wieder öffnen',
      resetDownloads: 'Downloads zurücksetzen',
      deleteLink: 'Link löschen',
      deleteConfirm: (client: string) =>
        `Den Link für ${client} löschen? Er funktioniert danach sofort nicht mehr.`,
      noPicks: 'Noch keine Fotos ausgewählt.',
    },
  },

  analytics: {
    title: 'Statistik',
    description:
      'Seitenaufrufe ohne Cookies gezählt und auf diesem Server gespeichert. Es werden keine personenbezogenen Daten erfasst.',
    /** `{title}` is `disabledTitle`, shown bold; `{where}` is `disabledWhere`, in italics. */
    disabled:
      '{title} Neue Besucheraufrufe werden nicht erfasst. Du kannst die Zählung jederzeit unter {where} wieder einschalten.',
    disabledTitle: 'Die Statistik ist derzeit ausgeschaltet.',
    disabledWhere: 'Einstellungen → Allgemein',
    totalViews: 'Seitenaufrufe gesamt',
    lifetime: 'Seit Beginn der Zählung',
    activeDays: 'Erfasste Tage',
    daysRecorded: 'Tage mit Aufrufen',
    devices: 'Desktop vs. Mobil',
    deviceSplit: 'Verteilung nach Gerät',
    dailyTrend: 'Aufrufe pro Tag (letzte 14 Tage)',
    /** Tooltip on one bar of the chart. */
    dayViews: (date: string, n: number) => `${date}: ${n} ${n === 1 ? 'Aufruf' : 'Aufrufe'}`,
    noViews:
      'Noch keine Seitenaufrufe erfasst. Besuche Seiten deines Portfolios, um die Zählung zu starten!',
    topPages: 'Meistbesuchte Seiten & Unterseiten',
    noPages: 'Noch keine Seiten erfasst.',
    pageViews: (n: number) => `${n} ${n === 1 ? 'Aufruf' : 'Aufrufe'}`,
  },
};
