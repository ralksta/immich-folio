import type { AdminDictionary } from '../index';

/**
 * Config doctor findings (`lib/admin/doctor.ts`, `app/api/admin/doctor/route.ts`),
 * one group per check. Built on the server and shown on /admin/diagnostics.
 *
 * Environment variable names, YAML keys, file paths and header names stay as
 * written in every language — they are what the operator has to type.
 */
export const doctor: AdminDictionary['doctor'] = {
  authSecret: {
    missingTitle: 'AUTH_SECRET non è impostato',
    missingDetail:
      'I token degli asset e tutti i cookie di autenticazione sono firmati con un segreto rigenerato a ogni ' +
      'riavvio, quindi link e accessi smettono di funzionare ogni volta che il server si riavvia. Imposta AUTH_SECRET ' +
      'su una stringa casuale lunga.',
    shortTitle: (length: number) => `AUTH_SECRET è lungo solo ${length} caratteri`,
    shortDetail: (min: number) =>
      `Usa almeno ${min} caratteri casuali: è la chiave dietro ogni token degli asset e ogni cookie di autenticazione.`,
    okTitle: 'AUTH_SECRET è impostato',
    okDetail: (length: number) => `${length} caratteri.`,
  },

  proxyHops: {
    noProxyTitle: 'Nessun reverse proxy rilevato',
    noProxyInconclusiveDetail:
      'L’unica voce di X-Forwarded-For è quella che Next inserisce per una richiesta diretta, il che corrisponde a TRUSTED_PROXY_HOPS=0.',
    noProxyDetail:
      'Questa richiesta è arrivata senza X-Forwarded-For, in linea con TRUSTED_PROXY_HOPS=0.',
    notSeenTitle: (configured: number) =>
      `TRUSTED_PROXY_HOPS è ${configured}, ma questa richiesta non mostra alcun proxy`,
    notSeenDetail:
      'O hai raggiunto il pannello di amministrazione direttamente mentre il traffico pubblico passa da un proxy, ' +
      'e allora va bene così, oppure il valore è troppo alto e tutti i visitatori condividono un unico contatore del rate limit.',
    unsetTitle: (seen: number) =>
      `È stata rilevata una catena di ${seen} proxy, ma TRUSTED_PROXY_HOPS è 0`,
    unsetDetail: (seen: number) =>
      'L’IP del client viene letto da un header che il client stesso può impostare, quindi il rate limit si può aggirare ' +
      `falsificandolo. Imposta TRUSTED_PROXY_HOPS su ${seen} (solo nginx, Traefik o Caddy = 1).`,
    tooHighTitle: (configured: number, seen: number) =>
      `TRUSTED_PROXY_HOPS è ${configured}, ma ${
        seen === 1 ? `è stato rilevato solo ${seen} hop` : `sono stati rilevati solo ${seen} hop`
      } di proxy`,
    tooHighDetail: (seen: number) =>
      'La posizione letta si trova prima dell’inizio della catena, quindi l’IP del client ricade su ' +
      `qualcosa di inaffidabile. Questa richiesta suggerisce ${seen}.`,
    tooLowTitle: (configured: number, seen: number) =>
      `TRUSTED_PROXY_HOPS è ${configured}, ma è stata rilevata una catena di ${seen} hop di proxy`,
    tooLowDetail: (seen: number) =>
      'L’IP del client viene letto da una posizione ancora all’interno della catena di proxy, non dal vero client: ' +
      `tutti i visitatori dietro quell’hop possono condividere un unico contatore del rate limit. Questa richiesta suggerisce ${seen}.`,
    okTitle: (configured: number) =>
      `TRUSTED_PROXY_HOPS=${configured} corrisponde alla catena osservata`,
    okDetail: (seen: number) =>
      `X-Forwarded-For conteneva ${seen} ${seen === 1 ? 'voce' : 'voci'} in questa richiesta.`,
  },

  cdn: {
    passwordTitle: 'CDN_URL è impostato, ma le foto vengono servite da questo server',
    passwordDetail:
      'Il sito è protetto da password e una CDN consegnerebbe le foto in cache a chiunque abbia un ' +
      'link, quindi la modalità CDN resta disattivata. Rimuovi la password del sito o elimina CDN_URL.',
    noHopsTitle: 'La modalità CDN è attiva, ma TRUSTED_PROXY_HOPS è 0',
    noHopsDetail: (cdnUrl: string) =>
      `Le foto vengono servite tramite ${cdnUrl} e, senza TRUSTED_PROXY_HOPS, il rate limit ` +
      'conta il nodo edge della CDN invece del visitatore. Impostalo sul numero di proxy davanti ' +
      'all’app, CDN compresa.',
    okTitle: 'La modalità CDN è attiva',
    okDetail: (cdnUrl: string) => `Foto e video vengono serviti tramite ${cdnUrl}.`,
  },

  albumIds: {
    noneTitle: 'Nessun album configurato',
    noneDetail: 'gallery.yaml non elenca alcun album, quindi la galleria non ha nulla da mostrare.',
    missingTitle: (missing: number, total: number) =>
      `${missing} ID di album su ${total} non esistono in Immich`,
    /** `ids` is a comma-separated list of album IDs. */
    missingDetail: (ids: string) =>
      `Quelle pagine restano vuote senza alcun avviso. Controlla in gallery.yaml: ${ids}`,
    okTitle: (total: number) => `Tutti i ${total} ID di album sono validi`,
    okDetail: 'Ogni album di gallery.yaml esiste in Immich.',
  },

  albumsShared: {
    okTitle: 'Ogni album pubblicato è condiviso in Immich',
    okDetail: 'Non è pubblicato nulla che Immich consideri ancora privato.',
    warnTitle: (n: number) =>
      `${n} album ${n === 1 ? 'pubblicato non è condiviso' : 'pubblicati non sono condivisi'} in Immich`,
    /** `names` is a comma-separated list of album names. */
    warnDetail: (names: string) =>
      'Vengono comunque mostrati ai visitatori: decide l’elenco degli album consentiti in gallery.yaml. ' +
      `Vale la pena controllare, se non era voluto: ${names}`,
  },

  downloadMetadata: {
    okTitle: 'I download escono senza GPS',
    okDetail: (albums: number) =>
      `Ogni originale ${albums === 1 ? 'nell’album di download' : `nei ${albums} album di download`} è in JPEG, HEIC, AVIF, MP4 o MOV e viene servito senza la posizione.`,
    warnTitle: (files: number) =>
      `${files} ${files === 1 ? 'originale scaricabile mantiene' : 'originali scaricabili mantengono'} tutti i metadati`,
    /** `located`: how many of the files Immich has GPS for (0 = say nothing). `albums`: "Name (3), …". */
    warnDetail: (located: number, albums: string) =>
      'I file RAW, DNG, PNG, TIFF e WebP e i video diversi da MP4 e MOV vengono serviti esattamente come sono salvati, con eventuali ' +
      `coordinate GPS${located ? ` (Immich ha una posizione per ${located} di essi)` : ''}. ` +
      'Disattiva i download o rimuovi questi file se la loro posizione deve restare privata: ' +
      albums,
  },

  zoomRenditions: {
    okTitle: 'Immich ha anteprime a dimensione piena per lo zoom',
    okDetail: (photos: number) =>
      `${photos} foto HEIC, RAW o simili negli album con zoom ${photos === 1 ? 'viene ingrandita' : 'vengono ingrandite'} tramite la versione a dimensione piena di Immich, senza la posizione.`,
    missingTitle: (photos: number) =>
      `${photos} foto non ${photos === 1 ? 'può essere ingrandita' : 'possono essere ingrandite'}: Immich non ha un’anteprima a dimensione piena`,
    /** `albums`: "Name (3), …". The menu path is Immich's own English UI — keep it in English. */
    missingDetail: (albums: string) =>
      'HEIC, RAW e gli altri formati che un browser non sa mostrare vengono ingranditi tramite la versione a dimensione piena ' +
      'di Immich, e Immich non ne ha (verificata una foto a campione). I visitatori vedono il pulsante dello zoom e poi ' +
      '«non disponibile». In Immich, attiva Administration › Settings › Image Settings › Full-size ' +
      'image (JPEG), poi esegui il job Generate Thumbnails per gli asset mancanti. Album: ' +
      albums,
    formatTitle: (photos: number) =>
      `${photos} foto non ${photos === 1 ? 'può essere ingrandita' : 'possono essere ingrandite'}: il formato a dimensione piena di Immich non è JPEG`,
    /** `contentType` is empty when Immich did not name one. */
    formatDetail: (contentType: string, albums: string) =>
      `Immich genera le sue anteprime a dimensione piena come ${contentType || 'un tipo sconosciuto'}, e ` +
      'lo zoom serve solo versioni JPEG: i loro metadati di posizione vengono rimossi in uscita, cosa che ' +
      'Folio non sa fare per WebP. Imposta Administration › Settings › Image Settings › Full-size image ' +
      '› Format su JPEG, poi esegui il job Generate Thumbnails. Album: ' +
      albums,
  },

  albumSlugs: {
    /** Where a set of albums shares one URL prefix — the top level of the site… */
    contextStandalone: 'album di gallery.yaml',
    /** …or a subpage. */
    contextSubpage: (name: string) => `sottopagina «${name}»`,
    collision: (context: string, names: string[], slug: string) =>
      `${context}: «${names.join('» e «')}» puntano tutti a /${slug}`,
    errorTitle: (n: number) =>
      `${n} ${n === 1 ? 'collisione trovata' : 'collisioni trovate'} tra gli slug degli album`,
    /** `collisions` is the `collision` lines joined with "; ". */
    errorDetail: (collisions: string) =>
      'In una collisione, ogni album dopo il primo non è raggiungibile al proprio URL e le sue ' +
      `impostazioni vengono prese da quello precedente. ${collisions}`,
    okTitle: 'Nessuna collisione tra gli slug degli album',
    okDetail: 'Ogni album raggiungibile con lo stesso prefisso URL ha uno slug distinto.',
  },

  passwords: {
    /** Where a password lives, listed in the findings below. */
    labelSite: 'Password del sito',
    labelSubpage: (slug: string) => `Sottopagina ${slug}`,
    labelAlbum: (slug: string) => `Album ${slug}`,
    labelJournal: (slug: string) => `Diario ${slug}`,
    bcryptTitle: (n: number) => `${n} password ${n === 1 ? 'usa' : 'usano'} ancora bcrypt`,
    bcryptDetail: (labels: string) =>
      'Il supporto per bcrypt è stato rimosso, quindi nessuno può più sbloccarle. Sostituiscile una volta con il testo in chiaro, ' +
      `accedi e incolla l’hash scrypt: dal log: ${labels}`,
    plaintextTitle: (n: number) =>
      `${n} password ${n === 1 ? 'è salvata' : 'sono salvate'} in chiaro`,
    plaintextDetail: (labels: string) =>
      'Chi legge il file legge la password. Salvare una volta la pagina, l’articolo o l’impostazione ' +
      'nel pannello di amministrazione la memorizza come hash; per un file modificato a mano, accedi una volta e incolla ' +
      `l’hash scrypt: stampato nel log del server: ${labels}`,
    noneTitle: 'Nessuna password configurata',
    noneDetail: 'Nulla su questo sito è protetto da password.',
    okTitle: (n: number) => `Tutte le ${n} password sono salvate come hash`,
    okDetail: 'Ogni password configurata usa un hash scrypt:.',
  },

  legal: {
    /** Impressum fields, listed after `missing`. */
    fieldName: 'nome',
    fieldAddress: 'indirizzo',
    fieldZipCity: 'CAP e città',
    missing: (fields: string) => `Manca: ${fields}.`,
    noEmail: 'Nessun indirizzo e-mail; il § 5 DDG ne richiede uno.',
    badContactUrl: 'L’URL del modulo di contatto viene ignorato perché non inizia con http(s)://.',
    emailOnly:
      'L’e-mail è l’unico canale di contatto. Aggiungi un numero di telefono, un URL per il modulo di contatto, oppure attiva il modulo di contatto integrato.',
    gapsTitle: (n: number) =>
      `${n === 1 ? `Nell’Impressum manca ${n} dato` : `Nell’Impressum mancano ${n} dati`}`,
    okTitle: 'L’Impressum è completo',
    okDetail: 'Nome, indirizzo, e-mail e un secondo canale di contatto sono impostati.',
  },

  contact: {
    noNotifyTitle: 'I messaggi del modulo di contatto non avvisano nessuno',
    noNotifyDetail:
      'I nuovi messaggi compaiono solo in Messaggi nel pannello di amministrazione. Imposta un URL ntfy per saperlo.',
    badUrlTitle: 'L’URL di notifica dei contatti viene ignorato',
    badUrlDetail: 'Non inizia con http(s)://, quindi non viene inviata alcuna notifica.',
    okTitle: 'Il modulo di contatto ti avvisa',
    okDetail: 'Ogni nuovo messaggio genera una notifica.',
  },

  settingValues: {
    /** Names of the settings `validateSettingValues` checks. */
    labels: {
      url: 'URL del sito',
      themeAccent: 'colore d’accento',
      themeRadius: 'raggio degli angoli',
      gridColumns: 'colonne della griglia',
      gridGap: 'spaziatura della griglia',
      retentionDays: 'conservazione dei messaggi',
      navLinks: 'link dell’intestazione',
    },
    okTitle: 'Le impostazioni vengono usate così come sono scritte',
    okDetail:
      'URL del sito, tema, griglia, conservazione dei messaggi e link dell’intestazione in settings.yaml sono tutti validi.',
    oneIgnoredTitle: (name: string) => `L’impostazione «${name}» viene ignorata`,
    manyIgnoredTitle: (n: number) => `${n} impostazioni vengono ignorate`,
    ignoredDetail: (names: string) =>
      `settings.yaml contiene un valore che il sito non può usare per: ${names}. ` +
      'Il sito usa al suo posto un valore predefinito o il valore consentito più vicino. Apri l’impostazione per vedere cosa si aspetta.',
  },

  privacy: {
    okTitle: 'L’informativa sulla privacy è pubblicata',
    okDetail: 'Mostrata su /privacy e collegata nel piè di pagina.',
    missingTitle: 'Non c’è un’informativa sulla privacy',
    switchedOffDetail:
      'Il testo esiste, ma la pagina della privacy è disattivata, quindi /privacy risponde 404.',
    noTextDetail:
      'L’Impressum è attivo, ma /privacy non ha testo. Impostazioni → Note legali elenca cosa tratta questo sito, come punto di partenza.',
  },

  writable: {
    errorTitle: (n: number) =>
      `${n} ${n === 1 ? 'percorso dei contenuti non è scrivibile' : 'percorsi dei contenuti non sono scrivibili'}`,
    errorDetail: (paths: string) =>
      'Il salvataggio dal pannello di amministrazione non riuscirà, e nemmeno i backup. Controlla il proprietario del ' +
      `volume montato: ${paths}`,
    okTitle: 'content/ è scrivibile',
    okDetail: 'Configurazione, diario e backup possono essere salvati.',
  },

  immichApi: {
    notConfiguredTitle: 'Nessun URL o chiave API di Immich configurati',
    notConfiguredDetail:
      'Imposta IMMICH_API_URL e IMMICH_API_KEY, oppure avvia la procedura guidata di configurazione su /install.',
    failedTitle: (failed: number, total: number) =>
      `${failed} chiamate a Immich su ${total} non sono riuscite`,
    failedDetail: (endpoints: string) =>
      `Controlla IMMICH_API_URL e la chiave API. Non riescono: ${endpoints}`,
    okTitle: 'Immich risponde a ogni chiamata di Folio',
  },

  contentPages: {
    takenTitle: (n: number) =>
      `${n} ${n === 1 ? 'pagina di contenuto ha' : 'pagine di contenuto hanno'} uno slug già occupato`,
    /** `reasons`: one sentence per page, in English (from lib/pages). `missing`: '' or a list. */
    takenDetail: (reasons: string, missing: string) =>
      reasons +
      ' Rinomina la pagina in Pagine perché i visitatori possano raggiungerla.' +
      (missing ? ` Il menu elenca anche pagine mancanti: ${missing}.` : ''),
    missingTitle: (n: number) =>
      `Il menu elenca ${n} ${n === 1 ? 'pagina mancante' : 'pagine mancanti'}`,
    missingDetail: (list: string) =>
      `gallery.yaml fa riferimento a ${list}, ma content/pages/ non contiene un file del genere. ` +
      'Il menu salta la voce; rimuovi il riferimento o crea la pagina.',
    okTitle: (n: number) =>
      `${n} ${n === 1 ? 'pagina di contenuto' : 'pagine di contenuto'}, tutti gli slug liberi`,
    okDetail: (inMenu: number) => `${inMenu} nel menu.`,
  },
};
