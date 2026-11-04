import type { AdminDictionary } from '../index';

/**
 * The panel's frame: sign-in, the sidebar, the status dropdown, the floating
 * save bar and the overview at /admin.
 */
export const shell: AdminDictionary['shell'] = {
  gate: {
    loading: 'Caricamento del pannello di amministrazione',
    disabledTitle: 'Pannello di amministrazione',
    disabledBody:
      'Il pannello di amministrazione non è attivo. Imposta {env} nelle variabili d’ambiente per attivarlo.',
    sessionExpired: 'La tua sessione è scaduta. Accedi di nuovo.',
  },

  login: {
    subtitle: 'Pannello di amministrazione',
    password: 'Password',
    passwordPlaceholder: 'Inserisci la password di amministrazione',
    signIn: 'Accedi',
    signingIn: 'Accesso in corso...',
    failed: 'Accesso non riuscito',
    connectionError: 'Errore di connessione',
  },

  nav: {
    groups: {
      content: 'Contenuti',
      visitors: 'Visitatori',
      site: 'Sito',
      system: 'Sistema',
    },
    overview: 'Panoramica',
    pages: 'Pagine',
    journal: 'Diario',
    messages: 'Messaggi',
    proofing: 'Selezioni',
    analytics: 'Statistiche',
    settings: 'Impostazioni',
    diagnostics: 'Diagnostica',
    help: 'Aiuto',
    unread: (n: number) => `${n} ${n === 1 ? 'non letto' : 'non letti'}`,
  },

  sidebar: {
    skipToContent: 'Vai al contenuto',
    landmark: 'Amministrazione',
    expand: 'Espandi la barra laterale',
    collapse: 'Comprimi la barra laterale',
    /** Tooltip on the collapsed sidebar's toggle; keep it to one short word. */
    expandShort: 'Espandi',
    brandSub: 'Admin',
    openMenu: 'Apri menu',
    closeMenu: 'Chiudi menu',
    viewSite: 'Vedi il sito',
    viewSiteTitle: 'Apri il sito in una nuova scheda (senza cache)',
    backups: 'Backup',
    backupsTitle: 'Gestisci e ripristina i backup della configurazione',
    reload: 'Ricarica',
    reloadTitle: 'Ricarica la configurazione e svuota la cache',
    reloadFailed: (status: number) => `Ricaricamento non riuscito (HTTP ${status}).`,
    signOut: 'Esci',
  },

  status: {
    showTitle: 'Mostra lo stato del sistema',
    heading: 'Diagnostica di sistema',
    refreshTitle: 'Aggiorna la diagnostica',
    checking: 'Verifica in corso…',
    /** `{wizard}` is a link labelled with `setupWizard` (feminine noun). */
    missingCredentials:
      'Nessun URL o chiave API di Immich configurati. Imposta {apiUrl} e {apiKey}, oppure avvia la {wizard}.',
    noGallery:
      'Non c’è ancora un file {file}: il sito pubblico non ha nulla da mostrare. Aggiungi una pagina qui sotto, oppure avvia la {wizard} (il token monouso è stampato nel log del server).',
    setupWizard: 'procedura guidata di configurazione',
    immich: 'Connessione a Immich',
    connected: 'Connesso',
    disconnected: 'Disconnesso',
    config: 'Integrità della configurazione',
    configValid: 'Valida',
    configDegraded: 'Degradata',
    configNotSetUp: 'Non configurata',
    backups: 'Backup della configurazione',
    backupCount: (n: number) => `${n} backup`,
    latestBackup: 'Ultimo backup',
    cache: 'Cache in memoria',
    cacheItems: (n: number) => `${n} ${n === 1 ? 'elemento' : 'elementi'}`,
    version: 'Versione',
    updateAvailable: (version: string) => `È disponibile la versione ${version}`,
  },

  health: {
    checking: 'Verifica in corso...',
    setupIncomplete: 'Configurazione incompleta',
    degraded: 'Sistema degradato',
    needsAttention: 'Richiede attenzione',
    checkDiagnostics: 'Controlla la diagnostica',
    ok: 'Sistema OK',
    unknown: 'Stato sconosciuto',
  },

  loadState: {
    retry: 'Riprova',
    loading: 'Caricamento',
  },

  /**
   * Unsaved edits that came back from the browser's draft store. The subjects
   * carry the articulated preposition ("alle impostazioni") that `restored`
   * and `stale` need after "modifiche".
   */
  draft: {
    subjects: {
      settings: 'alle impostazioni',
      about: 'alla pagina «Chi sono»',
      privacy: 'all’informativa sulla privacy',
      pageStructure: 'alla struttura delle pagine',
      page: 'alla pagina',
      entry: 'all’articolo',
    },
    restored: (subject: string) =>
      `Le tue modifiche non salvate ${subject} sono state ripristinate. Non sono ancora salvate.`,
    stale: (subject: string) =>
      `Hai modifiche non salvate ${subject} di una sessione precedente, ma nel frattempo il file è stato salvato altrove. Se le ripristini, al salvataggio sostituiranno quella versione.`,
    discardChanges: 'Scarta le modifiche',
    ok: 'OK',
    restore: 'Ripristina le mie modifiche',
    discardThem: 'Scartale',
  },

  /**
   * The dialog when a file was saved elsewhere since it was opened. `message`
   * starts with one of `subjects`; the sentence is phrased so it needs no
   * gender agreement with them.
   */
  conflict: {
    subjects: {
      settings: 'Il file delle impostazioni',
      about: 'La pagina «Chi sono»',
      privacy: 'L’informativa sulla privacy',
      pageStructure: 'La struttura delle pagine (gallery.yaml)',
      page: 'Questa pagina',
      entry: 'Questo articolo',
    },
    title: 'Modificato altrove',
    message: (subject: string) =>
      `${subject} contiene modifiche fatte da quando ci stai lavorando — in un’altra scheda, su un altro dispositivo, a mano o con il ripristino di un backup. Salvando ora sostituiresti quelle modifiche.`,
    overwrite: 'Sovrascrivi comunque',
    reload: 'Ricarica (scarta le mie)',
    keepEditing: 'Continua a modificare',
  },

  fetch: {
    loadFailed: (status: number, detail: string) =>
      detail
        ? `Impossibile caricare (HTTP ${status}): ${detail}.`
        : `Impossibile caricare (HTTP ${status}).`,
    unreachable: 'Impossibile raggiungere il server.',
  },

  notifications: {
    dismiss: 'Chiudi',
  },

  saveBar: {
    unsaved: 'Modifiche non salvate',
    discard: 'Annulla modifiche',
    preview: '↗ Anteprima del sito',
    previewTitle: 'Apri il sito in una nuova scheda (senza cache)',
    saving: 'Salvataggio...',
  },

  overview: {
    kicker: 'Panoramica',
    goodNight: 'Buonanotte',
    goodMorning: 'Buongiorno',
    goodAfternoon: 'Buon pomeriggio',
    goodEvening: 'Buonasera',
    needsLook: (n: number) =>
      n === 1 ? `C’è ${n} cosa da controllare.` : `Ci sono ${n} cose da controllare.`,
    allInOrder: 'È tutto in ordine.',
    checking: 'Controllo del sito in corso…',
    viewSite: 'Vedi il sito',
    editPages: 'Modifica le pagine',
    attention: 'Richiede attenzione',
    unreadMessages: (n: number) => `${n} ${n === 1 ? 'messaggio non letto' : 'messaggi non letti'}`,
    /** `names` is a comma-separated list of up to three senders. */
    from: (names: string) => `Da ${names}`,
    open: 'Apri',
    calm: 'Nulla in attesa. Qui compaiono i nuovi messaggi e i problemi.',
    glance: 'In breve',
    pages: 'Pagine',
    switchedOff: (n: number) => `${n} ${n === 1 ? 'disattivata' : 'disattivate'}`,
    allPublished: 'tutte pubblicate',
    heroPhotos: 'Foto hero',
    onHomePage: 'nella home page',
    journal: 'Diario',
    drafts: (n: number) => `${n} ${n === 1 ? 'bozza' : 'bozze'}`,
    noDrafts: 'nessuna bozza',
    views7: 'Visualizzazioni · 7 giorni',
    cookieless: 'conteggio senza cookie',
    quickActions: 'Azioni rapide',
    newEntry: 'Nuovo articolo del diario',
    messages: 'Messaggi',
    theme: 'Tema',
    diagnostics: 'Diagnostica',
  },
};
