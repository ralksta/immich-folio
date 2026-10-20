import type { AdminDictionary } from '../index';

/**
 * Settings (`/admin/settings/<section>`): the editor shell, each section, the
 * privacy policy editor in Legal, and the shared form fields in
 * `app/admin/components/fields/` that other areas reuse.
 *
 * `{name}` placeholders are filled with markup by `rich()` — usually a
 * `<code>` element holding a file name or an environment variable, which stays
 * as it is in every language.
 */
export const settings: AdminDictionary['settings'] = {
  editor: {
    sections: {
      general: 'Generale',
      theme: 'Tema',
      grid: 'Griglia',
      footer: 'Piè di pagina',
      legal: 'Note legali',
      seo: 'SEO',
      security: 'Sicurezza e protezione',
      about: 'Chi sono',
    },
    kicker: 'Sito',
    title: 'Impostazioni',
    description: 'Le modifiche salvate valgono subito per il sito, senza riavvio.',
    saveChanges: 'Salva le modifiche',
    sessionExpired: 'La tua sessione è scaduta. Accedi di nuovo per continuare.',
    serverAnswered: (status: number) => `Il server ha risposto ${status}.`,
    loadFailed: 'Non è stato possibile caricare le impostazioni.',
    loadErrorTitle: 'Impossibile caricare le impostazioni.',
    loadErrorBody:
      'Non è stato modificato nulla. Il salvataggio resta disattivato finché non vengono caricate, così un modulo vuoto non può sovrascrivere la tua configurazione.',
    conflict: 'Non salvato: le impostazioni sono state modificate altrove.',
    saved: 'Salvato!',
    saveFailed: 'Salvataggio non riuscito',
  },

  general: {
    title: 'Impostazioni generali del sito',
    sub: 'Configura l’identità del sito, la lingua e le funzioni principali.',
    siteTitle: 'Titolo del sito',
    siteTitleHint:
      'Compare nell’intestazione, nella scheda del browser e nelle anteprime dei link.',
    /** `title` is what the site shows instead; `fromEnv` when SITE_TITLE supplied it. */
    siteTitleEmpty: (title: string, fromEnv: boolean) =>
      `Vuoto, quindi il sito mostra «${title}»${fromEnv ? ', da SITE_TITLE' : ''}.`,
    subtitle: 'Sottotitolo',
    subtitlePlaceholder: 'Un diario visivo',
    language: 'Lingua',
    /** {locales}: comma-separated language codes; {htmlLang}: the `<html lang>` attribute. */
    languageHint:
      'L’interfaccia per i visitatori è tradotta in {locales}. Le altre lingue impostano comunque {htmlLang} e il formato delle date, ma mostrano l’interfaccia in inglese. Il pannello di amministrazione ha una sua impostazione della lingua, qui sotto.',
    adminLanguage: 'Lingua del pannello di amministrazione',
    adminLanguageSame: 'Uguale alla lingua del sito',
    adminLanguageHint:
      'La lingua di questo pannello di amministrazione. Cambia dopo il salvataggio delle impostazioni.',

    featuresTitle: 'Funzioni e moduli del portfolio',
    featuresSub:
      'Pagine facoltative, cosa il sito rivela delle tue foto e cosa conta delle visite.',
    modules: 'Moduli',
    modulesDesc: 'Ognuno aggiunge una pagina o un controllo per i visitatori.',
    aboutPage: 'Pagina «Chi sono»',
    aboutPageDesc: 'Ritratto, biografia e attrezzatura su /about',
    map: 'Mappa',
    mapDesc: 'I luoghi delle foto su una mappa del mondo su /map',
    proofing: 'Selezione del cliente',
    proofingDesc: 'I visitatori segnano col cuore, filtrano ed esportano una selezione di foto',
    zoom: 'Zoom delle foto',
    zoomDesc:
      'I visitatori ingrandiscono una foto alla risoluzione piena (1:1) per controllarne la nitidezza. Pagine e album possono modificare questa impostazione',
    proofingEmail: 'E-mail per le selezioni',
    proofingEmailPlaceholder:
      'Per impostazione predefinita, l’e-mail di contatto del piè di pagina',
    proofingEmailHint:
      'Dove «Invia e-mail al fotografo» manda una selezione. In mancanza si usa l’e-mail di contatto del piè di pagina; se nessuna delle due è impostata, il pulsante è nascosto.',

    privacyGroup: 'Cosa sanno di te i visitatori',
    privacyGroupDesc: 'Cosa rivela ogni foto e cosa viene conteggiato di una visita.',
    privacyGroupChip: 'visibile ai visitatori',
    photoMetadata: 'Metadati delle foto',
    /** Parts of the one-line summary under "Photo metadata", joined with " · ". */
    metadataSummary: {
      camera: 'Fotocamera e obiettivo',
      exposure: 'Esposizione',
      location: 'Luogo',
      description: 'Descrizione',
      none: 'Nulla di pubblicato: il visualizzatore nasconde il pannello informazioni',
    },
    details: 'Dettagli',
    exifCamera: 'Fotocamera e obiettivo',
    exifCameraDesc: 'Corpo macchina, obiettivo e lunghezza focale',
    exifSettings: 'Impostazioni di esposizione',
    exifSettingsDesc: 'Diaframma, tempo di scatto e ISO',
    exifLocation: 'Luogo',
    exifLocationDesc: 'Città e paese dai dati GPS della foto',
    exifCaption: 'Descrizione della foto',
    exifCaptionDesc: 'La descrizione scritta in Immich',
    gridHover: 'Riepilogo al passaggio sulla griglia',
    gridHoverDesc: 'Fotocamera e obiettivo sopra la foto, non solo nel visualizzatore',
    gridHoverNeedsCamera: 'Richiede «Fotocamera e obiettivo»',
    analytics: 'Statistiche',
    analyticsDesc: 'Conteggio delle visualizzazioni senza cookie, salvato solo sul tuo server',

    favicon: 'Favicon',
    faviconAlt: 'Favicon attuale',
    faviconUpload: 'Carica icona',
    faviconUploadFailed: 'Caricamento non riuscito',
    faviconResetFailed: 'Ripristino non riuscito',
    faviconResetTitle: 'Ripristinare la favicon?',
    faviconResetMessage: 'L’icona caricata viene eliminata e si torna a usare quella predefinita.',
    faviconHint:
      'SVG, PNG, ICO o JPEG, max 512 kB. Salvata nel volume dei contenuti. Ripristina riporta l’icona predefinita.',
  },

  theme: {
    title: 'Preset del tema e modalità colore',
    sub: 'Scegli un preset tipografico e visualizzalo in modalità chiara o scura.',
    visitorMode: 'Modalità predefinita per i visitatori',
    visitorModeAria: 'Modalità predefinita per i visitatori',
    modeDark: 'Scura',
    modeLight: 'Chiara',
    modeAuto: 'Segui il sistema del visitatore',
    visitorModeHint:
      'Cosa vede chi visita il sito per la prima volta. Il selettore chiaro/scuro nell’intestazione del sito permette comunque di scegliere, e la scelta viene ricordata sul suo dispositivo. L’anteprima qui sotto è solo tua e non cambia questa impostazione.',
    preset: 'Preset',
    /** Under each preset card: font, corner radius and photo frame. */
    presetSpecs: (font: string, radius: number, frame: string) =>
      `${font} · raggio ${radius} · ${frame}`,
    colorMode: 'Modalità colore',
    /** {editorial}, {minimal}, {classic}: preset names, set in bold. */
    colorModeHint:
      'Preset come {editorial}, {minimal} e {classic} hanno sfondi caldi chiari/crema in modalità chiara e antracite in modalità scura.',
    lightMode: 'Modalità chiara (crema / beige)',
    darkMode: 'Modalità scura (antracite)',
    accentTitle: 'Colore d’accento',
    accentSub: 'Scegli un colore d’accento per link, pulsanti ed evidenziazioni.',
    swatches: {
      studioRed: 'Rosso studio',
      editorialGold: 'Oro editoriale',
      emerald: 'Smeraldo',
      sapphire: 'Zaffiro',
      violet: 'Viola',
      white: 'Bianco monocromo',
      black: 'Nero ossidiana',
    },
    accentAria: 'Colore d’accento',
    accentHexAria: 'Colore d’accento (esadecimale)',
    frameTitle: 'Cornice e layout delle foto',
    frameSub: 'Personalizza i bordi delle immagini e il layout della sezione hero.',
    photoFrame: 'Cornice delle foto',
    photoFrames: {
      none: { label: 'Nessuna', desc: 'Immagine a filo con bordi netti' },
      passepartout: { label: 'Passe-partout', desc: 'Il classico bordo da galleria' },
      shadow: { label: 'Ombra', desc: 'Ombra morbida, come sospesa' },
    },
    heroStyle: 'Stile hero',
    heroStyles: {
      split: { label: 'Diviso', desc: 'Titolo e foto affiancati' },
      fullbleed: { label: 'A tutta pagina', desc: 'Banner a tutta larghezza, da bordo a bordo' },
      minimal: { label: 'Minimale', desc: 'Titolo centrato con foto discreta' },
      stacked: { label: 'Sovrapposto', desc: 'Titolo posato direttamente sulla foto' },
      typographic: { label: 'Tipografico', desc: 'Testata a caratteri grandi, senza foto' },
      mosaic: { label: 'Mosaico', desc: 'Collage dinamico di foto' },
      cover: {
        label: 'Copertina (sperimentale)',
        desc: 'Schermata iniziale a tutto schermo con un solo link «Entra»',
      },
    },
    lookTitle: 'Aspetto e movimento',
    lookSub: 'Effetti e piccoli controlli su ogni pagina.',
    transitions: 'Transizioni tra le pagine',
    transitionsDesc: 'Una breve dissolvenza tra una pagina e l’altra',
    scrollToTop: 'Pulsante «Torna su»',
    scrollToTopDesc: 'Una freccia fluttuante sulle pagine lunghe',
    grain: 'Grana della pellicola',
    grainDesc: 'Rumore analogico sullo sfondo',
    headerDot: 'Punto d’accento nell’intestazione',
    headerDotDesc: 'Un punto accanto al titolo della sezione attiva',
  },

  grid: {
    title: 'Griglia e layout',
    sub: 'Configura le colonne della galleria fotografica e le proporzioni delle miniature.',
    layout: 'Algoritmo di layout',
    layouts: {
      masonry: { label: 'Masonry', desc: 'Colonne sfalsate dinamiche, in stile Pinterest' },
      uniform: { label: 'Griglia uniforme', desc: 'Griglia pulita con proporzioni uguali' },
      showcase: { label: 'Vetrina', desc: 'Foto in evidenza alternate a riquadri più piccoli' },
      filmstrip: {
        label: 'Pellicola',
        desc: 'Striscia orizzontale scorrevole, come una pellicola',
      },
      'editorial-flow': {
        label: 'Flusso editoriale',
        desc: 'Impaginazione da rivista con foto di dimensioni diverse',
      },
      justified: {
        label: 'Giustificato (sperimentale)',
        desc: 'Righe di uguale altezza che riempiono tutta la larghezza',
      },
    },
    aspectRatio: 'Proporzioni',
    /** Keyed by the ratio value written to settings.yaml. */
    aspectRatios: {
      '1': { label: 'Quadrato (1:1)', desc: 'Ritagli quadrati 1:1' },
      '3/2': {
        label: 'Orizzontale (3:2)',
        desc: 'Il formato orizzontale classico delle reflex 35 mm',
      },
      '2/3': { label: 'Verticale (2:3)', desc: 'Orientamento verticale da ritratto' },
      '16/9': { label: 'Cinema (16:9)', desc: 'Formato panoramico cinematografico 16:9' },
      auto: { label: 'Originale automatico', desc: 'Proporzioni originali, senza ritaglio' },
    },
    spacingTitle: 'Spaziatura e colonne',
    spacingSub:
      'Regola il numero di colonne e la spaziatura della griglia. Il numero di colonne vale anche per le copertine degli album in una sottopagina; la loro spaziatura resta quella del tema, a meno che una pagina non la modifichi.',
    columns: (min: number, max: number) => `Colonne (${min} - ${max})`,
    gap: 'Spaziatura (px)',
  },

  footer: {
    title: 'Piè di pagina e link social',
    sub: 'Mostra nel piè di pagina il nome, Instagram, l’e-mail e il sito web.',
    brandName: 'Nome nel piè di pagina',
    brandNamePlaceholder: 'La mia fotografia',
    instagram: 'URL di Instagram',
    email: 'E-mail di contatto',
    website: 'Sito web personale',
    navTitle: 'Link di navigazione nell’intestazione (sperimentale)',
    navSub:
      'Link esterni mostrati dopo le tue pagine nel menu dell’intestazione. Sono ammessi solo URL http(s); si aprono in una nuova scheda.',
    linkLabel: 'Etichetta',
    linkLabelPlaceholder: 'Negozio',
    linkUrl: 'Indirizzo',
    removeLink: 'Rimuovi link',
    addLink: '+ Aggiungi link esterno',
  },

  legal: {
    title: 'Note legali e Impressum',
    sub: 'Configura la pagina di informazioni legali richiesta dalla legge tedesca Digitale-Dienste-Gesetz (DDG).',
    view: 'Vedi /impressum ↗',
    enable: 'Attiva la pagina Impressum (/impressum)',
    enableDesc: 'Genera /impressum e la collega automaticamente nel piè di pagina',
    heading: 'Titolo',
    headingHint:
      'Lascia vuoto per la riga § 5 DDG nella lingua del sito. Impostalo se si applica un’altra legge, per esempio § 5 ECG in Austria.',
    name: 'Nome completo / ragione sociale',
    address: 'Via e numero civico',
    zipCity: 'CAP e città',
    country: 'Paese',
    countryPlaceholder: 'Germania',
    email: 'E-mail legale',
    phone: 'Numero di telefono',
    contactUrl: 'URL del modulo di contatto',
    contactUrlInvalid:
      'Deve iniziare con https:// o http://. Qualsiasi altro link viene omesso dalla pagina.',
    contactLabel: 'Testo del link di contatto',
    contactLabelPlaceholder: 'Modulo di contatto',
    vatId: 'Partita IVA',
    taxId: 'Codice fiscale',
    extraInfo: 'Ulteriori informazioni',
    contactForm: 'Modulo di contatto (/contact)',
    contactFormDesc:
      'I messaggi vengono salvati su questo server e si leggono in Messaggi. Non viene inviata alcuna e-mail.',
    notifyUrl: 'URL di notifica (ntfy)',
    notifyUrlInvalid: 'Deve iniziare con https:// o http://.',
    notifyUrlHint:
      'Riceve una notifica push fissa «nuovo messaggio», senza nulla sul mittente. Scegli un nome di topic che nessuno possa indovinare.',
    /** `variable` is the environment variable's name. */
    notifyUrlEnvOverride: (variable: string) => `${variable} ha la precedenza su questo campo.`,
    retention: 'Elimina i messaggi dopo (giorni)',
    privacy: 'Informativa sulla privacy (/privacy)',
    privacyDesc: 'Mostrata e collegata nel piè di pagina dopo aver salvato il testo qui sotto',
  },

  seo: {
    title: 'Ottimizzazione per i motori di ricerca (SEO)',
    sub: 'Personalizza i metadati per i motori di ricerca, i tag OpenGraph e le regole di indicizzazione.',
    snippetPreview: 'Anteprima del risultato su Google',
    /** Stand-ins in the search preview while the fields are empty. */
    snippetTitle: 'Il mio portfolio fotografico',
    snippetDesc: 'Una selezione curata di lavori fotografici.',
    siteUrl: 'URL del sito',
    /** {sitemap}: the file name sitemap.xml. */
    siteUrlHint:
      'Serve per {sitemap}, il feed e i dati strutturati: vengono generati senza una richiesta, quindi l’indirizzo non si può ricavare da essa. Se resta vuoto, la sitemap rimane vuota invece di tirare a indovinare.',
    /** {variable}: SITE_URL; {value}: the URL it holds. */
    siteUrlFromEnv:
      'Attualmente fornito dalla variabile d’ambiente {variable} ({value}). Un valore inserito qui ha la precedenza dopo il salvataggio.',
    metaTitle: 'Meta title SEO',
    metaTitlePlaceholder: 'Sostituisce il titolo del sito nei risultati di ricerca di Google',
    titleTemplate: 'Modello del titolo delle sottopagine',
    titleTemplateFallback: 'Il mio portfolio',
    /** {placeholder}: the literal `%s`. */
    titleTemplateHint:
      'Modello per sottopagine e album. Usa {placeholder} come segnaposto per il titolo della pagina.',
    previewLabel: 'Anteprima:',
    previewExample: 'Paesaggi',
    metaDescription: 'Meta description SEO',
    metaDescriptionPlaceholder: 'Una selezione curata di lavori fotografici...',
    crawlerTitle: 'Direttive per i crawler',
    crawlerSub: 'Controlla come Googlebot e gli altri crawler indicizzano il tuo sito.',
    noIndex: 'noindex (nascondi da Google)',
    noIndexDesc: 'Chiede ai motori di ricerca di NON indicizzare questo sito nei risultati',
    noFollow: 'nofollow (non seguire i link)',
    noFollowDesc: 'Chiede ai crawler dei motori di ricerca di non seguire i link in uscita',
  },

  security: {
    title: 'Password del sito',
    sub: 'Protegge l’intero sito pubblico con una sola password: utile mentre un portfolio è ancora in costruzione, o per un folio mostrato solo ai clienti.',
    sitePassword: 'Password del sito',
    sitePasswordAria: 'Password del sito',
    sitePasswordPlaceholder: 'Lascia vuoto per un sito pubblico',
    /** {hash}: the `scrypt:…` prefix; {file}: settings.yaml. */
    storedHashed: 'Salvata in {file} come hash {hash}, mai così come è stata digitata.',
    /** {variable}: SITE_PASSWORD. */
    envOverride: 'La variabile d’ambiente {variable} ha la precedenza su questo campo.',
    adminSeparate:
      'Il pannello di amministrazione ha una sua password e non sta mai dietro questa protezione.',
    protectionTitle: 'Protezione delle immagini e filigrana',
    protectionSub:
      'Configura le regole di protezione delle immagini, il blocco del clic destro e la filigrana.',
    rightClick: 'Disattiva il menu del clic destro',
    rightClickDesc:
      'Impedisce il menu contestuale sulle immagini del portfolio per ostacolare i download non autorizzati',
    imageDrag: 'Disattiva il trascinamento delle immagini',
    imageDragDesc: 'Impedisce ai visitatori di trascinare le immagini fuori dalla pagina',
    watermarkTitle: 'Filigrana dinamica',
    watermarkSub: 'Sovrappone un testo di copyright alle immagini nel visualizzatore.',
    watermarkEnable: 'Attiva la filigrana',
    watermarkEnableDesc: 'Sovrappone il testo di copyright alle immagini del portfolio',
    watermarkText: 'Testo della filigrana',
    position: 'Posizione',
    positionAria: 'Posizione della filigrana',
    positionBottomRight: 'In basso a destra',
    positionBottomLeft: 'In basso a sinistra',
    positionCenter: 'Al centro',
    opacity: (percent: number) => `Opacità (${percent}%)`,
  },

  about: {
    title: 'Pagina «Chi sono»',
    sub: 'Modifica il ritratto, la biografia e l’attrezzatura mostrati nella pagina «Chi sono». Usa Generale per mostrare o nascondere la pagina stessa.',
    portrait: 'ID asset del ritratto',
    portraitPlaceholder: 'UUID dell’asset Immich per la foto del ritratto',
    name: 'Nome',
    namePlaceholder: 'Il tuo nome',
    location: 'Luogo',
    locationPlaceholder: 'Città, Paese',
    gear: 'Attrezzatura (una per riga)',
    biography: 'Biografia (Markdown)',
    biographyPlaceholder: 'Fotografo con base a...',
    loadFailed: 'Non è stato possibile caricare la pagina «Chi sono».',
    conflict: 'Non salvato: la pagina «Chi sono» è stata modificata altrove.',
  },

  privacy: {
    loadFailed: 'Impossibile caricare.',
    /** `error` is a short technical reason, e.g. "HTTP 500". */
    loadError: (error: string) =>
      `Non è stato possibile caricare l’informativa sulla privacy (${error}). Ricarica la pagina per riprovare.`,
    conflict: 'Non salvato: l’informativa è stata modificata altrove.',
    saveFailed: (status: number) => `Impossibile salvare (HTTP ${status}).`,
    saved: 'Informativa sulla privacy salvata.',
    unreachable: 'Impossibile raggiungere il server.',
    factsTitle: 'Cosa tratta questo sito',
    factsHint:
      'Ricavato dalla tua configurazione attuale. Una lista di controllo per scrivere l’informativa, non testo per la pagina.',
    thirdParty: 'terze parti',
    body: 'Informativa sulla privacy (Markdown)',
    /** Example text in the empty editor; keep the Markdown heading. */
    bodyPlaceholder: '## Titolare del trattamento\n\nNome, indirizzo, e-mail…',
    /** {heading}, {list}, {bold}, {link}: Markdown syntax examples in code style. */
    syntaxHint:
      'Titoli con {heading}, elenchi con {list}, {bold} e {link}. Mostrata su /privacy e collegata nel piè di pagina quando c’è del testo. Le versioni precedenti restano in Backup.',
    insertHeadings: 'Inserisci i titoli',
    view: 'Vedi /privacy ↗',
    save: 'Salva l’informativa sulla privacy',
  },

  fields: {
    configure: 'Configura →',
    locked: 'Bloccato',
    /** {variable}: the environment variable's name. */
    envLockNote:
      'Impostato da {variable} nell’ambiente. Modificalo o rimuovilo lì: le modifiche qui non avrebbero effetto.',
    columnsPlaceholder: 'Colonne (predefinite del sito)',
    columnsAria: 'Colonne',
    gapPlaceholder: 'Spaziatura in px (predefinita del tema)',
    gapAria: 'Spaziatura in px',
    passwordPlaceholder: 'Lascia vuoto per l’accesso pubblico',
    passwordProtected: 'Protetto',
    passwordChange: 'Cambia',
    passwordNew: 'Nuova password',
    passwordHide: 'Nascondi password',
    passwordShow: 'Mostra password',
    passwordKeep: 'Mantieni la password attuale',
    zoom: 'Zoom delle foto',
    zoomOn: 'Attivo: i visitatori possono ingrandire alla risoluzione piena',
    zoomOff: 'Disattivo',
  },
};
