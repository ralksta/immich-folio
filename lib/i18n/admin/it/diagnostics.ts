import type { AdminDictionary } from '../index';

/**
 * The diagnostics page (`app/admin/components/DiagnosticsView.tsx`). The doctor's
 * findings themselves are in `doctor.ts`; the alt-text finding is built here,
 * on the page, and lives under `altText`.
 */
export const diagnostics: AdminDictionary['diagnostics'] = {
  groups: {
    connection: 'Connessione',
    security: 'Sicurezza',
    content: 'Contenuti',
  },

  levels: {
    ok: 'OK',
    warn: 'Da verificare',
    error: 'Problema',
  },

  fixes: {
    howToSetIt: 'Come impostarlo',
    cdnSetup: 'Configurazione della CDN',
    openSettings: 'Apri le impostazioni',
    openPages: 'Apri le pagine',
    openInPages: 'Apri in Pagine',
    howToFix: 'Come risolvere',
    howToSetUp: 'Come configurarlo',
    apiKeyPermissions: 'Permessi della chiave API',
  },

  altText: {
    captionsOffTitle: 'Le descrizioni delle foto non vengono usate come testo alternativo',
    captionsOffDetail:
      '«Descrizione della foto» è disattivata in Impostazioni → Generale, quindi ogni foto del sito ha un testo alternativo vuoto, qualunque cosa contenga Immich.',
    /** Appended to the details below, so it starts with a space. */
    unreadable: (n: number) =>
      ` ${n} album non ${n === 1 ? 'è stato letto e non viene contato' : 'sono stati letti e non vengono contati'}.`,
    allTitle: (total: number) => `Tutte le ${total} foto pubblicate hanno un testo alternativo`,
    /** `unreadable` is the sentence above, or ''. */
    allDetail: (unreadable: string) => `Ogni foto ha la sua descrizione da Immich.${unreadable}`,
    missingTitle: (n: number) =>
      `${n} ${n === 1 ? 'foto pubblicata non ha' : 'foto pubblicate non hanno'} un testo alternativo`,
    missingDetail: (unreadable: string) =>
      `Folio usa la descrizione di Immich come testo alternativo. Senza descrizione, gli screen reader non annunciano nulla e i motori di ricerca non indicizzano nulla per la foto.${unreadable}`,
    pendingTitle: 'Verifica del testo alternativo…',
    pendingDetail:
      'Lettura di tutti gli album pubblicati; con librerie grandi ci vuole un momento.',
    failedTitle: 'Impossibile verificare il testo alternativo',
    failedDetail:
      'Gli album non sono stati caricati. Se Immich è disconnesso, il motivo è questo: riprova quando torna disponibile.',
    coverage: (described: number, total: number, percent: number) =>
      `${described} su ${total} con descrizione · ${percent}%`,
    albumMissing: (missing: number, total: number) => `${missing} su ${total} senza descrizione`,
    openInImmich: (fileName: string) => `${fileName} — apri in Immich`,
    more: (n: number) => `+${n} altre`,
    showPhotos: 'Mostra le foto',
    hidePhotos: 'Nascondi le foto',
    noteAdd: 'Aggiungi la descrizione in Immich, poi premi Ricarica nella barra in alto.',
    /** `{url}` is Immich's address, shown as code. */
    noteExternal: 'Le foto si aprono su {url}, il dominio esterno di Immich.',
    /** `{setting}` is `externalDomain` below, shown in bold. */
    noteInternal:
      'Le foto si aprono su {url}, l’indirizzo con cui Folio raggiunge Immich, che il tuo browser potrebbe non riuscire ad aprire. Imposta {setting} in Immich (Administration → Settings → Server) e i link useranno quello.',
    /** The name of the setting in Immich's own (English) interface — keep it in English. */
    externalDomain: 'External domain',
  },

  header: {
    kicker: 'Sistema',
    checking: 'Verifica in corso…',
    allClear: 'Nulla richiede la tua attenzione',
    attention: (n: number, total: number) =>
      `${n} ${n === 1 ? 'controllo' : 'controlli'} su ${total} ${n === 1 ? 'merita' : 'meritano'} un’occhiata`,
    /** `date` is already formatted for the browser's locale. */
    lastRun: (date: string) => `Ultima esecuzione ${date}`,
    running: 'Esecuzione dei controlli…',
    runAgain: 'Esegui di nuovo',
    copyTitle: 'Markdown, pronto da incollare in una issue',
    copy: 'Copia il report',
    copied: 'Copiato',
  },

  errors: {
    failed: 'Diagnostica non riuscita',
    failedStatus: (status: number) => `Diagnostica non riuscita (${status})`,
    copyFailed: 'Impossibile copiare: il browser ha negato l’accesso agli appunti.',
  },

  report: {
    heading: 'Diagnostica di Immich Folio',
    version: (version: string) => `Versione ${version}`,
  },

  vitals: {
    aria: 'Panoramica',
    immich: 'Immich',
    connected: 'Connesso',
    disconnected: 'Disconnesso',
    config: 'Configurazione',
    valid: 'Valida',
    invalid: 'Non valida',
    notSetUp: 'Non configurata',
    backups: 'Backup',
    latest: (date: string) => `ultimo ${date}`,
    noneYet: 'ancora nessuno',
    version: 'Versione',
    available: (version: string) => `${version} disponibile`,
    upToDate: 'aggiornato',
  },

  needsAttention: 'Richiede attenzione',

  storage: {
    title: 'Archiviazione e cache',
    backupsTitle: (n: number) => `${n} backup della configurazione`,
    backupsDetail: 'Scritti prima di ogni salvataggio dall’amministrazione, dieci per file.',
    manageBackups: 'Gestisci i backup',
    cacheTitle: (n: number) =>
      `La cache in memoria contiene ${n} ${n === 1 ? 'elemento' : 'elementi'}`,
    cacheDetail:
      'Elenchi degli album e metadati delle foto da Immich. Svuotarla rende più lente le prossime visualizzazioni di pagina, nient’altro.',
    clearing: 'Svuotamento…',
    clearCache: 'Svuota la cache',
  },
};
