import type { AdminDictionary } from '../index';

/**
 * The panel's frame: sign-in, the sidebar, the status dropdown, the floating
 * save bar and the overview at /admin.
 */
export const shell: AdminDictionary['shell'] = {
  gate: {
    loading: 'Beheerpaneel laden',
    disabledTitle: 'Beheerpaneel',
    /** `{env}` is the ADMIN_PASSWORD variable name, set in code. */
    disabledBody:
      'Het beheerpaneel is niet ingeschakeld. Stel {env} in je omgevingsvariabelen in om het te activeren.',
    sessionExpired: 'Je sessie is verlopen. Meld je opnieuw aan.',
  },

  login: {
    subtitle: 'Beheerpaneel',
    password: 'Wachtwoord',
    passwordPlaceholder: 'Voer het beheerderswachtwoord in',
    signIn: 'Aanmelden',
    signingIn: 'Aanmelden…',
    failed: 'Aanmelden mislukt',
    connectionError: 'Verbindingsfout',
  },

  nav: {
    groups: {
      content: 'Inhoud',
      visitors: 'Bezoekers',
      site: 'Website',
      system: 'Systeem',
    },
    overview: 'Overzicht',
    pages: 'Pagina’s',
    journal: 'Journal',
    messages: 'Berichten',
    proofing: 'Selecties',
    analytics: 'Statistieken',
    settings: 'Instellingen',
    diagnostics: 'Diagnose',
    help: 'Help',
    unread: (n: number) => `${n} ongelezen`,
  },

  sidebar: {
    skipToContent: 'Naar de inhoud',
    landmark: 'Beheer',
    expand: 'Zijbalk uitklappen',
    collapse: 'Zijbalk inklappen',
    /** Tooltip on the collapsed sidebar's toggle; keep it to one short word. */
    expandShort: 'Uitklappen',
    brandSub: 'Beheer',
    openMenu: 'Menu openen',
    closeMenu: 'Menu sluiten',
    viewSite: 'Site bekijken',
    viewSiteTitle: 'Site in een nieuw tabblad openen (cache omzeilen)',
    backups: 'Back-ups',
    backupsTitle: 'Configuratieback-ups beheren en terugzetten',
    reload: 'Herladen',
    reloadTitle: 'Configuratie herladen en cache legen',
    reloadFailed: (status: number) => `Herladen mislukt (HTTP ${status}).`,
    signOut: 'Afmelden',
  },

  status: {
    showTitle: 'Systeemstatus tonen',
    heading: 'Systeemdiagnose',
    refreshTitle: 'Diagnose vernieuwen',
    checking: 'Controleren…',
    missingCredentials:
      'Geen Immich-URL of API-sleutel ingesteld. Stel {apiUrl} en {apiKey} in, of start de {wizard}.',
    noGallery:
      'Nog geen {file} — de openbare site heeft niets te tonen. Voeg hieronder een pagina toe, of start de {wizard} (het eenmalige token staat in het serverlogboek).',
    setupWizard: 'installatiewizard',
    immich: 'Immich-verbinding',
    connected: 'Verbonden',
    disconnected: 'Niet verbonden',
    config: 'Integriteit van de configuratie',
    configValid: 'Geldig',
    configDegraded: 'Beperkt',
    configNotSetUp: 'Niet ingesteld',
    backups: 'Configuratieback-ups',
    backupCount: (n: number) => `${n} ${n === 1 ? 'back-up' : 'back-ups'}`,
    latestBackup: 'Laatste back-up',
    cache: 'Geheugencache',
    cacheItems: (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`,
    version: 'Versie',
    updateAvailable: (version: string) => `Versie ${version} is beschikbaar`,
  },

  health: {
    checking: 'Controleren…',
    setupIncomplete: 'Installatie onvolledig',
    degraded: 'Systeem beperkt',
    needsAttention: 'Aandacht nodig',
    checkDiagnostics: 'Diagnose bekijken',
    ok: 'Systeem OK',
    unknown: 'Status onbekend',
  },

  loadState: {
    retry: 'Opnieuw proberen',
    loading: 'Laden',
  },

  /** Subjects are phrased with "aan" so they fit after "wijzigingen". */
  draft: {
    subjects: {
      settings: 'aan de instellingen',
      about: 'aan de Over-mij-pagina',
      privacy: 'aan de privacyverklaring',
      pageStructure: 'aan de paginastructuur',
      page: 'aan deze pagina',
      entry: 'aan dit verhaal',
    },
    restored: (subject: string) =>
      `Je niet-opgeslagen wijzigingen ${subject} zijn teruggezet. Ze zijn nog niet opgeslagen.`,
    stale: (subject: string) =>
      `Je hebt nog niet-opgeslagen wijzigingen ${subject} van eerder, maar intussen is er elders opgeslagen. Als je ze terugzet, vervangen ze die versie zodra je opslaat.`,
    discardChanges: 'Wijzigingen weggooien',
    ok: 'OK',
    restore: 'Mijn wijzigingen terugzetten',
    discardThem: 'Weggooien',
  },

  conflict: {
    subjects: {
      settings: 'Het instellingenbestand',
      about: 'De Over-mij-pagina',
      privacy: 'De privacyverklaring',
      pageStructure: 'De paginastructuur (gallery.yaml)',
      page: 'Deze pagina',
      entry: 'Dit verhaal',
    },
    title: 'Elders gewijzigd',
    message: (subject: string) =>
      `${subject} is gewijzigd sinds je die opende — in een ander tabblad, op een ander apparaat, met de hand of door het terugzetten van een back-up. Nu opslaan zou die wijziging vervangen.`,
    overwrite: 'Toch overschrijven',
    reload: 'Herladen (mijn wijzigingen weggooien)',
    keepEditing: 'Verder bewerken',
  },

  saveBar: {
    unsaved: 'Niet-opgeslagen wijzigingen',
    preview: '↗ Site bekijken',
    previewTitle: 'Site in een nieuw tabblad openen (cache omzeilen)',
    saving: 'Opslaan…',
  },

  overview: {
    kicker: 'Overzicht',
    goodNight: 'Goedenacht',
    goodMorning: 'Goedemorgen',
    goodAfternoon: 'Goedemiddag',
    goodEvening: 'Goedenavond',
    needsLook: (n: number) =>
      `Er ${n === 1 ? 'is' : 'zijn'} ${n} ${n === 1 ? 'punt' : 'punten'} om naar te kijken.`,
    allInOrder: 'Alles is in orde.',
    checking: 'De site wordt gecontroleerd…',
    viewSite: 'Site bekijken',
    editPages: 'Pagina’s bewerken',
    attention: 'Aandacht nodig',
    unreadMessages: (n: number) => `${n} ongelezen ${n === 1 ? 'bericht' : 'berichten'}`,
    /** `names` is a comma-separated list of up to three senders. */
    from: (names: string) => `Van ${names}`,
    open: 'Openen',
    calm: 'Niets in afwachting. Nieuwe berichten en problemen verschijnen hier.',
    glance: 'In één oogopslag',
    pages: 'Pagina’s',
    switchedOff: (n: number) => `${n} uitgeschakeld`,
    allPublished: 'alle gepubliceerd',
    heroPhotos: 'Hero-foto’s',
    onHomePage: 'op de startpagina',
    journal: 'Journal',
    drafts: (n: number) => `${n} ${n === 1 ? 'concept' : 'concepten'}`,
    noDrafts: 'geen concepten',
    views7: 'Weergaven · 7 dagen',
    cookieless: 'telling zonder cookies',
    quickActions: 'Snelle acties',
    newEntry: 'Nieuw journalverhaal',
    messages: 'Berichten',
    theme: 'Thema',
    diagnostics: 'Diagnose',
  },
};
