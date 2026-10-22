import type { AdminDictionary } from '../index';

/**
 * The diagnostics page (`app/admin/components/DiagnosticsView.tsx`). The doctor's
 * findings themselves are in `doctor.ts`; the alt-text finding lives under `altText`.
 */
export const diagnostics: AdminDictionary['diagnostics'] = {
  groups: {
    connection: 'Verbinding',
    security: 'Beveiliging',
    content: 'Inhoud',
  },

  levels: {
    ok: 'OK',
    warn: 'Controleren',
    error: 'Probleem',
  },

  fixes: {
    howToSetIt: 'Zo stel je het in',
    cdnSetup: 'CDN instellen',
    openSettings: 'Instellingen openen',
    openPages: 'Pagina’s openen',
    openInPages: 'Openen in Pagina’s',
    howToFix: 'Zo los je het op',
    howToSetUp: 'Zo richt je het in',
    apiKeyPermissions: 'Rechten van de API-sleutel',
  },

  altText: {
    captionsOffTitle: 'Fotobeschrijvingen worden niet als alt-tekst gebruikt',
    captionsOffDetail:
      '“Fotobeschrijving” staat uit in Instellingen → Algemeen, dus elke foto op de site heeft een lege alt-tekst, wat er in Immich ook staat.',
    /** Appended to the details below, so it starts with a space. */
    unreadable: (n: number) =>
      ` ${n} ${n === 1 ? 'album kon' : 'albums konden'} niet worden gelezen en ${n === 1 ? 'telt' : 'tellen'} niet mee.`,
    allTitle: (total: number) => `Alle ${total} gepubliceerde foto’s hebben alt-tekst`,
    allDetail: (unreadable: string) => `Elke foto heeft zijn Immich-beschrijving.${unreadable}`,
    missingTitle: (n: number) =>
      `${n} gepubliceerde ${n === 1 ? 'foto heeft' : 'foto’s hebben'} geen alt-tekst`,
    missingDetail: (unreadable: string) =>
      `Folio gebruikt de Immich-beschrijving als alt-tekst. Zonder beschrijving melden schermlezers niets en indexeren zoekmachines niets voor de foto.${unreadable}`,
    pendingTitle: 'Alt-tekst controleren…',
    pendingDetail: 'Elk gepubliceerd album wordt gelezen; bij grote bibliotheken duurt dat even.',
    failedTitle: 'Alt-tekst kon niet worden gecontroleerd',
    failedDetail:
      'De albums zijn niet geladen. Als Immich niet verbonden is, ligt het daaraan — probeer het opnieuw zodra het weer bereikbaar is.',
    coverage: (described: number, total: number, percent: number) =>
      `${described} van ${total} beschreven · ${percent}%`,
    albumMissing: (missing: number, total: number) => `${missing} van ${total} ontbreken`,
    openInImmich: (fileName: string) => `${fileName} — openen in Immich`,
    more: (n: number) => `+${n} meer`,
    showPhotos: 'Foto’s tonen',
    hidePhotos: 'Foto’s verbergen',
    noteAdd: 'Voeg de beschrijving toe in Immich en klik daarna op Herladen in de bovenbalk.',
    /** `{url}` is Immich's address, shown as code. */
    noteExternal: 'Foto’s openen op {url}, het externe domein van Immich.',
    /** `{setting}` is `externalDomain` below, shown in bold. */
    noteInternal:
      'Foto’s openen op {url} — het adres waarop Folio Immich bereikt, dat je browser misschien niet kan openen. Stel {setting} in Immich in (Administration → Settings → Server), dan gebruiken de links dat adres.',
    /** The name of the setting in Immich's own (English) interface — keep it in English. */
    externalDomain: 'External domain',
  },

  header: {
    kicker: 'Systeem',
    checking: 'Controleren…',
    allClear: 'Niets vraagt je aandacht',
    attention: (n: number, total: number) =>
      `${n} van ${total} controles ${n === 1 ? 'verdient' : 'verdienen'} een blik`,
    /** `date` is already formatted for the browser's locale. */
    lastRun: (date: string) => `Laatst uitgevoerd ${date}`,
    running: 'De controles worden uitgevoerd…',
    runAgain: 'Opnieuw uitvoeren',
    copyTitle: 'Markdown, klaar om in een issue te plakken',
    copy: 'Rapport kopiëren',
    copied: 'Gekopieerd',
  },

  errors: {
    failed: (reason: string) => `Diagnose mislukt. ${reason}`,
    copyFailed: 'Kopiëren mislukt — je browser weigerde toegang tot het klembord.',
  },

  report: {
    heading: 'Immich Folio-diagnose',
    version: (version: string) => `Versie ${version}`,
  },

  vitals: {
    aria: 'Overzicht',
    immich: 'Immich',
    connected: 'Verbonden',
    disconnected: 'Niet verbonden',
    config: 'Configuratie',
    valid: 'Geldig',
    invalid: 'Ongeldig',
    notSetUp: 'Niet ingesteld',
    backups: 'Back-ups',
    latest: (date: string) => `laatste ${date}`,
    noneYet: 'nog geen',
    version: 'Versie',
    available: (version: string) => `${version} beschikbaar`,
    upToDate: 'actueel',
  },

  needsAttention: 'Aandacht nodig',

  storage: {
    title: 'Opslag & cache',
    backupsTitle: (n: number) => `${n} ${n === 1 ? 'configuratieback-up' : 'configuratieback-ups'}`,
    backupsDetail: 'Gemaakt vóór elke opslag in het beheerpaneel, tien per bestand.',
    manageBackups: 'Back-ups beheren',
    cacheTitle: (n: number) => `Geheugencache bevat ${n} ${n === 1 ? 'item' : 'items'}`,
    cacheDetail:
      'Albumlijsten en fotometadata uit Immich. Legen maakt de volgende paginaweergaven trager, verder niets.',
    clearing: 'Legen…',
    clearCache: 'Cache legen',
  },
};
