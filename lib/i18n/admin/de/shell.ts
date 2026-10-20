import type { AdminDictionary } from '../index';

/**
 * The panel's frame: sign-in, the sidebar, the status dropdown, the floating
 * save bar and the overview at /admin.
 */
export const shell: AdminDictionary['shell'] = {
  gate: {
    loading: 'Admin-Bereich wird geladen',
    disabledTitle: 'Admin-Bereich',
    /** `{env}` is the ADMIN_PASSWORD variable name, set in code. */
    disabledBody:
      'Der Admin-Bereich ist nicht aktiviert. Setze {env} in deinen Umgebungsvariablen, um ihn einzuschalten.',
    sessionExpired: 'Deine Sitzung ist abgelaufen. Melde dich erneut an.',
  },

  login: {
    subtitle: 'Admin-Bereich',
    password: 'Passwort',
    passwordPlaceholder: 'Admin-Passwort eingeben',
    signIn: 'Anmelden',
    signingIn: 'Anmeldung läuft...',
    failed: 'Anmeldung fehlgeschlagen',
    connectionError: 'Verbindungsfehler',
  },

  nav: {
    /** Group headings in the sidebar. */
    groups: {
      content: 'Inhalt',
      visitors: 'Besucher',
      site: 'Website',
      system: 'System',
    },
    overview: 'Übersicht',
    pages: 'Seiten',
    journal: 'Journal',
    messages: 'Nachrichten',
    proofing: 'Kundenauswahl',
    analytics: 'Statistik',
    settings: 'Einstellungen',
    diagnostics: 'Diagnose',
    help: 'Hilfe',
    unread: (n: number) => `${n} ungelesen`,
  },

  sidebar: {
    skipToContent: 'Zum Inhalt springen',
    /** Accessible name of the sidebar landmark. */
    landmark: 'Admin',
    expand: 'Seitenleiste ausklappen',
    collapse: 'Seitenleiste einklappen',
    /** Tooltip on the collapsed sidebar's toggle; keep it to one short word. */
    expandShort: 'Ausklappen',
    brandSub: 'Admin',
    openMenu: 'Menü öffnen',
    closeMenu: 'Menü schließen',
    viewSite: 'Website ansehen',
    viewSiteTitle: 'Website in neuem Tab öffnen (ohne Cache)',
    backups: 'Backups',
    backupsTitle: 'Konfigurations-Backups verwalten & wiederherstellen',
    reload: 'Neu laden',
    reloadTitle: 'Konfiguration neu laden & Cache leeren',
    reloadFailed: (status: number) => `Neuladen fehlgeschlagen (HTTP ${status}).`,
    signOut: 'Abmelden',
  },

  /** The system status dropdown at the foot of the sidebar. */
  status: {
    showTitle: 'Systemstatus anzeigen',
    heading: 'Systemdiagnose',
    refreshTitle: 'Diagnose aktualisieren',
    checking: 'Wird geprüft…',
    /**
     * Shown when the install was never finished. `{wizard}` is a link to the
     * setup wizard, labelled with `setupWizard`.
     */
    missingCredentials:
      'Keine Immich-URL und kein API-Schlüssel konfiguriert. Setze {apiUrl} und {apiKey} oder starte den {wizard}.',
    noGallery:
      'Noch keine {file} — die öffentliche Website hat nichts zu zeigen. Füge unten eine Seite hinzu oder starte den {wizard} (das Einmal-Token steht im Server-Log).',
    setupWizard: 'Einrichtungsassistenten',
    immich: 'Immich-Verbindung',
    connected: 'Verbunden',
    disconnected: 'Getrennt',
    config: 'Konfiguration',
    configValid: 'Gültig',
    configDegraded: 'Eingeschränkt',
    configNotSetUp: 'Nicht eingerichtet',
    backups: 'Konfigurations-Backups',
    backupCount: (n: number) => `${n} ${n === 1 ? 'Backup' : 'Backups'}`,
    latestBackup: 'Letztes Backup',
    cache: 'Arbeitsspeicher-Cache',
    cacheItems: (n: number) => `${n} ${n === 1 ? 'Eintrag' : 'Einträge'}`,
    version: 'Version',
    updateAvailable: (version: string) => `Version ${version} ist verfügbar`,
  },

  /** The status badge's words; the colour is decided alongside (systemHealth.ts). */
  health: {
    checking: 'Wird geprüft...',
    setupIncomplete: 'Einrichtung unvollständig',
    degraded: 'System eingeschränkt',
    needsAttention: 'Prüfung nötig',
    checkDiagnostics: 'Diagnose ansehen',
    ok: 'System OK',
    unknown: 'Status unbekannt',
  },

  /** The spinner and the error-with-retry every admin screen shares. */
  loadState: {
    retry: 'Erneut versuchen',
    loading: 'Wird geladen',
  },

  /**
   * Unsaved edits that came back from the browser's draft store. `restored`
   * and `stale` insert one of `subjects` right after "Änderungen", so each
   * subject carries its own preposition and article ("an den …", "am …").
   */
  draft: {
    subjects: {
      settings: 'an den Einstellungen',
      about: 'an der „Über mich“-Seite',
      privacy: 'an der Datenschutzerklärung',
      pageStructure: 'an der Seitenstruktur',
      page: 'an der Seite',
      entry: 'am Eintrag',
    },
    restored: (subject: string) =>
      `Deine ungespeicherten Änderungen ${subject} wurden wiederhergestellt. Sie sind noch nicht gespeichert.`,
    stale: (subject: string) =>
      `Du hast ältere ungespeicherte Änderungen ${subject}, inzwischen wurde aber anderswo gespeichert. Stellst du sie wieder her, ersetzen sie beim Speichern diese Fassung.`,
    discardChanges: 'Änderungen verwerfen',
    ok: 'OK',
    restore: 'Meine Änderungen wiederherstellen',
    discardThem: 'Verwerfen',
  },

  /**
   * The dialog when a file was saved elsewhere since it was opened. `message`
   * starts with one of `subjects`, so they are phrased in the nominative.
   */
  conflict: {
    subjects: {
      settings: 'Die Einstellungsdatei',
      about: 'Die „Über mich“-Seite',
      privacy: 'Die Datenschutzerklärung',
      pageStructure: 'Die Seitenstruktur (gallery.yaml)',
      page: 'Diese Seite',
      entry: 'Dieser Eintrag',
    },
    title: 'Anderswo geändert',
    message: (subject: string) =>
      `${subject} wurde seit dem Öffnen geändert — in einem anderen Tab, auf einem anderen Gerät, von Hand oder durch das Wiederherstellen eines Backups. Jetzt zu speichern würde diese Änderung ersetzen.`,
    overwrite: 'Trotzdem überschreiben',
    reload: 'Neu laden (meine verwerfen)',
    keepEditing: 'Weiter bearbeiten',
  },

  saveBar: {
    unsaved: 'Ungespeicherte Änderungen',
    preview: '↗ Vorschau',
    previewTitle: 'Website in neuem Tab öffnen (ohne Cache)',
    saving: 'Wird gespeichert...',
  },

  overview: {
    kicker: 'Übersicht',
    /** Greeting by the hour of the admin's clock. */
    goodNight: 'Gute Nacht',
    goodMorning: 'Guten Morgen',
    goodAfternoon: 'Guten Tag',
    goodEvening: 'Guten Abend',
    needsLook: (n: number) =>
      n === 1 ? 'Eine Sache solltest du dir ansehen.' : `${n} Dinge solltest du dir ansehen.`,
    allInOrder: 'Alles in Ordnung.',
    checking: 'Website wird geprüft…',
    viewSite: 'Website ansehen',
    editPages: 'Seiten bearbeiten',
    attention: 'Braucht Aufmerksamkeit',
    unreadMessages: (n: number) => `${n} ungelesene ${n === 1 ? 'Nachricht' : 'Nachrichten'}`,
    /** `names` is a comma-separated list of up to three senders. */
    from: (names: string) => `Von ${names}`,
    open: 'Öffnen',
    calm: 'Nichts wartet. Neue Nachrichten und Probleme erscheinen hier.',
    glance: 'Auf einen Blick',
    pages: 'Seiten',
    switchedOff: (n: number) => `${n} ausgeschaltet`,
    allPublished: 'alle veröffentlicht',
    heroPhotos: 'Hero-Fotos',
    onHomePage: 'auf der Startseite',
    journal: 'Journal',
    drafts: (n: number) => `${n} ${n === 1 ? 'Entwurf' : 'Entwürfe'}`,
    noDrafts: 'keine Entwürfe',
    views7: 'Aufrufe · 7 Tage',
    cookieless: 'ohne Cookies gezählt',
    quickActions: 'Schnellzugriff',
    newEntry: 'Neuer Journal-Eintrag',
    messages: 'Nachrichten',
    theme: 'Design',
    diagnostics: 'Diagnose',
  },
};
