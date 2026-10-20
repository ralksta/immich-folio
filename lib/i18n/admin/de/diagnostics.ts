import type { AdminDictionary } from '../index';

/**
 * The diagnostics page (`app/admin/components/DiagnosticsView.tsx`). The doctor's
 * findings themselves are in `doctor.ts`; the alt-text finding is built here,
 * on the page, and lives under `altText`.
 */
export const diagnostics: AdminDictionary['diagnostics'] = {
  /** Groups the checks are filed under. */
  groups: {
    connection: 'Verbindung',
    security: 'Sicherheit',
    content: 'Inhalt',
  },

  /** A finding's level — shown to screen readers and in the copied report. */
  levels: {
    ok: 'OK',
    warn: 'Prüfen',
    error: 'Problem',
  },

  /** Buttons that lead to the fix for a finding. ↗ marks one that opens the docs. */
  fixes: {
    howToSetIt: 'So setzt du es',
    cdnSetup: 'CDN einrichten',
    openSettings: 'Einstellungen öffnen',
    openPages: 'Seiten öffnen',
    openInPages: 'In Seiten öffnen',
    howToFix: 'So behebst du es',
    howToSetUp: 'So richtest du es ein',
    apiKeyPermissions: 'Rechte des API-Schlüssels',
  },

  altText: {
    captionsOffTitle: 'Fotobeschreibungen werden nicht als Alt-Text verwendet',
    captionsOffDetail:
      '„Fotobeschreibung“ ist unter Einstellungen → Allgemein ausgeschaltet, daher hat jedes Foto der Website einen leeren Alt-Text, egal was in Immich steht.',
    /** Appended to the details below, so it starts with a space. */
    unreadable: (n: number) =>
      n === 1
        ? ` ${n} Album konnte nicht gelesen werden und ist nicht mitgezählt.`
        : ` ${n} Alben konnten nicht gelesen werden und sind nicht mitgezählt.`,
    allTitle: (total: number) => `Alle ${total} veröffentlichten Fotos haben einen Alt-Text`,
    /** `unreadable` is the sentence above, or ''. */
    allDetail: (unreadable: string) => `Jedes Foto trägt seine Immich-Beschreibung.${unreadable}`,
    missingTitle: (n: number) =>
      n === 1
        ? `${n} veröffentlichtes Foto hat keinen Alt-Text`
        : `${n} veröffentlichte Fotos haben keinen Alt-Text`,
    missingDetail: (unreadable: string) =>
      `Folio verwendet die Immich-Beschreibung als Alt-Text. Ohne sie sagen Screenreader zu dem Foto nichts an, und Suchmaschinen indexieren nichts.${unreadable}`,
    pendingTitle: 'Alt-Texte werden geprüft…',
    pendingDetail:
      'Jedes veröffentlichte Album wird gelesen; große Bibliotheken brauchen einen Moment.',
    failedTitle: 'Alt-Texte konnten nicht geprüft werden',
    failedDetail:
      'Die Alben wurden nicht geladen. Ist Immich getrennt, liegt es daran — versuche es erneut, sobald die Verbindung wieder steht.',
    coverage: (described: number, total: number, percent: number) =>
      `${described} von ${total} beschrieben · ${percent} %`,
    albumMissing: (missing: number, total: number) => `${missing} von ${total} fehlen`,
    openInImmich: (fileName: string) => `${fileName} — in Immich öffnen`,
    more: (n: number) => `+${n} weitere`,
    showPhotos: 'Fotos anzeigen',
    hidePhotos: 'Fotos ausblenden',
    noteAdd: 'Ergänze die Beschreibung in Immich und klicke dann oben auf Neu laden.',
    /** `{url}` is Immich's address, shown as code. */
    noteExternal: 'Fotos öffnen unter {url}, der externen Domain von Immich.',
    /** `{setting}` is `externalDomain` below, shown in bold. */
    noteInternal:
      'Fotos öffnen unter {url} — der Adresse, unter der Folio Immich erreicht und die dein Browser womöglich nicht öffnen kann. Setze {setting} in Immich (Administration → Settings → Server), dann verwenden die Links diese Adresse.',
    /** The name of the setting in Immich's own (English) interface — keep it in English. */
    externalDomain: 'External domain',
  },

  header: {
    kicker: 'System',
    checking: 'Wird geprüft…',
    allClear: 'Nichts braucht deine Aufmerksamkeit',
    attention: (n: number, total: number) => `${n} von ${total} Prüfungen solltest du dir ansehen`,
    /** `date` is already formatted for the browser's locale. */
    lastRun: (date: string) => `Zuletzt ausgeführt ${date}`,
    running: 'Prüfungen laufen…',
    runAgain: 'Erneut ausführen',
    copyTitle: 'Markdown, fertig zum Einfügen in ein Issue',
    copy: 'Bericht kopieren',
    copied: 'Kopiert',
  },

  errors: {
    failed: 'Diagnose fehlgeschlagen',
    failedStatus: (status: number) => `Diagnose fehlgeschlagen (${status})`,
    copyFailed:
      'Kopieren nicht möglich — dein Browser verweigert den Zugriff auf die Zwischenablage.',
  },

  /** The Markdown report copied to the clipboard. */
  report: {
    heading: 'Immich-Folio-Diagnose',
    version: (version: string) => `Version ${version}`,
  },

  vitals: {
    aria: 'Übersicht',
    immich: 'Immich',
    connected: 'Verbunden',
    disconnected: 'Getrennt',
    config: 'Konfiguration',
    valid: 'Gültig',
    invalid: 'Ungültig',
    notSetUp: 'Nicht eingerichtet',
    backups: 'Backups',
    latest: (date: string) => `zuletzt ${date}`,
    noneYet: 'noch keine',
    version: 'Version',
    available: (version: string) => `${version} verfügbar`,
    upToDate: 'aktuell',
  },

  needsAttention: 'Braucht Aufmerksamkeit',

  storage: {
    title: 'Speicher & Cache',
    backupsTitle: (n: number) =>
      `${n} ${n === 1 ? 'Konfigurations-Backup' : 'Konfigurations-Backups'}`,
    backupsDetail: 'Vor jedem Speichern im Admin-Bereich geschrieben, zehn pro Datei.',
    manageBackups: 'Backups verwalten',
    cacheTitle: (n: number) =>
      `Der Arbeitsspeicher-Cache enthält ${n} ${n === 1 ? 'Eintrag' : 'Einträge'}`,
    cacheDetail:
      'Albumlisten und Foto-Metadaten aus Immich. Leeren macht die nächsten Seitenaufrufe langsamer, sonst nichts.',
    clearing: 'Wird geleert…',
    clearCache: 'Cache leeren',
  },
};
