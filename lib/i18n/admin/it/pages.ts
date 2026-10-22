import type { AdminDictionary } from '../index';

/**
 * Admin → Pages: the page builder (home page hero, standalone albums,
 * subpages, content pages), its drawers and the photo-essay block editor.
 *
 * File names (gallery.yaml, content/pages/), CSS values and units in the
 * strings below are literal — keep them as written.
 */
export const pages: AdminDictionary['pages'] = {
  /** The page header above the builder. */
  header: {
    kicker: 'Contenuti',
    title: 'Pagine',
    description:
      'L’immagine hero della home page, gli album indipendenti, le sottopagine e le pagine di contenuto. Trascina per riordinare; le modifiche vanno online al salvataggio.',
  },

  builder: {
    sessionExpired: 'La tua sessione è scaduta. Accedi di nuovo per continuare.',
    serverAnswered: (status: number) => `Il server ha risposto ${status}.`,
    loadFailed: 'Non è stato possibile caricare la struttura delle pagine.',
    loadFailedNote:
      'Non è stato modificato nulla. Il salvataggio resta disattivato finché non viene caricata, così un editor vuoto non può sovrascrivere la tua galleria.',
    notSavedConflict: 'Non salvato: gallery.yaml è stato modificato altrove.',
    saved: 'Salvato!',
    /** Inserted into "Error: …" (common.errorWith). */
    saveFailed: 'Salvataggio non riuscito',
    saveChanges: 'Salva le modifiche',
    createFailed: 'Impossibile creare la pagina',
    createdInMenu: 'Pagina creata come bozza. Usa «Salva le modifiche» per inserirla nel menu.',
    created: 'Pagina creata come bozza.',
    createOffline: 'Impossibile creare la pagina. Controlla la connessione e riprova.',
    /** Toasts after a removal; each offers `undo`. */
    pageRemoved: 'Pagina rimossa.',
    albumRemoved: 'Album rimosso.',
    albumRemovedFromPage: 'Album rimosso dalla pagina.',
    albumRemovedFromSection: 'Album rimosso dalla sezione.',
    heroRemoved: 'Foto hero rimossa.',
    undo: 'Annulla',
    undoFailed:
      'Impossibile annullare: nel frattempo la struttura delle pagine è cambiata. Non è ancora stato salvato nulla.',
    /**
     * What screen readers call a dragged item. Each label carries its article
     * («la pagina «Viaggi»»), because `pickers.dnd` uses it as the subject or
     * object of a sentence.
     */
    drag: {
      page: (name: string) => `la pagina «${name}»`,
      untitled: 'Senza titolo',
      hero: (n: number) => `la foto hero ${n} della home page`,
      album: (name: string) => `l’album «${name}»`,
      item: 'l’elemento',
    },
    /** The structure list on the left. */
    tree: 'Struttura delle pagine',
    searchLabel: 'Cerca album o sottopagine',
    searchPlaceholder: 'Cerca album o sottopagine...',
    clearSearch: 'Cancella la ricerca',
    homePage: 'Home page',
    heroPhotos: 'Foto hero',
    menu: 'Menu',
    subpagesLive: (live: number, total: number) =>
      `${live} su ${total} ${total === 1 ? 'sottopagina online' : 'sottopagine online'}`,
    noMatches: 'Nessuna voce corrispondente.',
    newSubpage: 'Nuova sottopagina',
    newPage: 'Nuova pagina',
    notInMenu: 'Fuori dal menu',
    offMenuEmpty:
      'Pagine raggiungibili solo tramite il loro link. Trascina qui una pagina per toglierla dal menu.',
    standaloneGroup: 'Album indipendenti',
    onHomePage: 'Nella home page',
    /** The panel for standalone albums. */
    standaloneHeading: 'Album indipendenti',
    addAlbum: '+ Aggiungi album',
    noMatchingStandalone: 'Nessun album indipendente corrispondente.',
    noStandalone: 'Nessun album indipendente. Questi compaiono direttamente nella home page.',
    /** The panel for the home page hero. */
    addHero: 'Aggiungi hero',
    heroPickerTitle: 'Scegli le immagini hero della home page',
    noHero:
      'Nessuna immagine hero configurata. Aggiungi delle foto per mostrare un carosello hero nella home page.',
  },

  /** Seed values for a new subpage or section, written into gallery.yaml. */
  defaults: {
    subpageName: (n: number) => `Nuova sottopagina ${n}`,
    sectionTitle: 'Nuova sezione',
  },

  /** The per-album photo order (Listbox options and the card's badge tooltip). */
  sort: {
    immich: 'Ordine di Immich (predefinito)',
    newest: 'Prima le più recenti',
    oldest: 'Prima le meno recenti',
    filename: 'Nome del file',
    manual: 'Manuale',
  },

  albumCard: {
    reorder: (name: string) => `Riordina ${name}`,
    dragToReorder: 'Trascina per riordinare',
    editDetails: 'Modifica i dettagli',
    removeAlbum: 'Rimuovi l’album',
    passwordProtected: 'Protetto da password',
    customHero: 'Immagine hero personalizzata impostata',
    /** `label` is one of the `sort` labels. */
    photoOrder: (label: string) => `Ordine delle foto: ${label}`,
    /** "foto" is invariable, so one form serves every count. */
    photos: (n: number) => `${n} foto`,
  },

  albumDrawer: {
    heading: 'Modifica i dettagli dell’album',
    close: 'Chiudi i dettagli',
    photos: (n: number) => `${n} foto`,
    /** Shown after the photo count when the title is overridden. */
    original: (name: string) => `Originale: ${name}`,
    titleOverride: 'Titolo personalizzato',
    description: 'Descrizione',
    descriptionPlaceholder: 'Descrizione facoltativa per i visitatori',
    passwordProtection: 'Protezione con password',
    albumPassword: 'Password dell’album',
    downloads: 'Download',
    allowDownloads: 'Consenti il download degli originali',
    allowDownloadsDesc:
      'I visitatori possono scaricare l’intero album o le foto selezionate come ZIP',
    zoomInherit: 'Eredita dalle impostazioni della pagina / del sito',
    zoomHint:
      'Permette ai visitatori di ingrandire una foto nel visualizzatore per controllarne la nitidezza. Gli originali JPEG e AVIF vengono mostrati senza i dati GPS; HEIC e RAW richiedono le anteprime a dimensione piena di Immich. PNG, WebP, GIF e le foto modificate in Immich non vengono mai ingrandite. Vale dove l’album è elencato qui.',
    layoutOverride: 'Layout personalizzato (sperimentale)',
    layoutOverrideAria: 'Layout personalizzato',
    layoutInherit: 'Eredita dalle impostazioni della pagina / globali',
    layouts: {
      masonry: 'Masonry',
      uniform: 'Griglia uniforme',
      showcase: 'Vetrina',
      filmstrip: 'Pellicola',
      editorialFlow: 'Flusso editoriale',
      justified: 'Giustificato (sperimentale)',
    },
    coverFocalPoint: 'Punto focale della copertina (sperimentale)',
    /** "50% 25%" and "top" are CSS values; keep them as written. */
    coverFocalPointPlaceholder:
      'es. "50% 25%" o "top": dove deve ancorarsi il ritaglio della copertina',
    customHero: 'Immagine hero personalizzata',
    heroAlt: 'Immagine hero',
    removeHero: 'Rimuovi l’immagine hero personalizzata',
    defaultCover: 'Si usa la copertina predefinita dell’album',
    pickHeroTitle: (name: string) => `Scegli l’immagine hero per ${name}`,
    changeImage: 'Cambia immagine',
    pickHero: 'Scegli l’immagine hero',
    photoOrder: 'Ordine delle foto',
    manualHint:
      'Le foto fissate vengono per prime, nell’ordine che hai impostato. Tutte le altre seguono nell’ordine dell’album in Immich.',
    immichHint: 'L’ordine di Immich segue l’ordinamento impostato per l’album in Immich.',
    reorderPhotos: 'Riordina le foto',
    reorderPhotosPinned: (n: number) =>
      `Riordina le foto (${n} ${n === 1 ? 'fissata' : 'fissate'})`,
    removeAlbum: 'Rimuovi l’album',
    uuidTitle: 'UUID dell’album Immich',
    copyUuid: 'Copia UUID',
    copyUuidAria: 'Copia l’UUID dell’album Immich',
    done: 'Fatto',
  },

  subpageDrawer: {
    breadcrumb: 'Pagine / Sottopagine',
    untitled: 'Pagina senza titolo',
    /** Accessible name of the Edit / Live Preview switch. */
    view: 'Vista',
    livePreview: 'Anteprima dal vivo',
    openLive: 'Apri la pagina online in una nuova scheda (senza cache)',
    close: 'Chiudi il pannello',
    pageName: 'Nome della pagina (identificativo nell’URL)',
    pageNamePlaceholder: 'es. dubai, viaggi, matrimoni',
    displayTitle: 'Titolo visualizzato (facoltativo)',
    /** Sits in a half-width field; keep it short. */
    displayTitlePlaceholder: 'Come il nome',
    subtitle: 'Sottotitolo',
    subtitlePlaceholder: 'Testo del sottotitolo',
    visibility: 'Visibilità e accesso',
    visibilityOptions: {
      published: {
        title: 'Pubblicata',
        desc: 'Mostrata nel menu dell’intestazione e negli elenchi della home page, raggiungibile tramite URL',
      },
      unlisted: {
        title: 'Non elencata (sperimentale)',
        desc: 'Non compare nei menu né nella home page, ma è raggiungibile con il link diretto',
      },
      disabled: {
        title: 'Disattivata',
        desc: 'Completamente offline: risponde 404 anche se aperta direttamente',
      },
    },
    passwordPlaceholder:
      'Protezione con password (facoltativa): lascia vuoto per l’accesso pubblico',
    pagePassword: 'Password della pagina',
    layoutStyle: 'Stile di layout della pagina',
    layoutStyleAria: 'Stile di layout della pagina',
    /** Options of a <select>: plain text only. */
    layouts: {
      masonry: 'Griglia masonry (altezza dinamica)',
      uniform: 'Griglia uniforme (riquadri quadrati)',
      showcase: 'Vetrina (prima foto in evidenza)',
      filmstrip: 'Pellicola (scorrimento orizzontale)',
      editorialFlow: 'Flusso editoriale',
      essay: 'Saggio fotografico (editor narrativo)',
    },
    zoomInherit: 'Eredita dalle impostazioni del sito',
    zoomHint:
      'Vale per ogni album di questa pagina che non ha una sua impostazione. L’interruttore per tutto il sito è in Impostazioni › Generale.',
    coverGrid: 'Griglia delle copertine degli album',
    coverGridHint:
      'Modifica la disposizione delle copertine degli album in questa pagina; le foto all’interno degli album non cambiano. Lascia vuoto il numero di colonne per seguire l’impostazione della griglia del sito, e vuota la spaziatura per mantenere quella del tema. Sui tablet compaiono al massimo due copertine per riga.',
    photoGrid: 'Griglia delle foto (album di questa pagina)',
    photoGridHint:
      'Come sono disposte le foto dentro ogni album di questa pagina. Lascia vuoti entrambi i campi per seguire Impostazioni › Griglia; un singolo album può comunque modificarlo in gallery.yaml.',
    essayHeading: 'Editor narrativo e del saggio fotografico',
    essayIntro: 'Componi visivamente testo, citazioni e foto larghe o a tutta pagina.',
    essayPickerTitle: 'Seleziona una foto per il saggio fotografico',
    albums: 'Album in questa pagina',
    addAlbum: '+ Aggiungi album',
    noAlbums: 'Ancora nessun album. Fai clic su «+ Aggiungi album» per sceglierne uno da Immich.',
    /** Placeholder and accessible name of a section's title field. */
    sectionTitle: 'Titolo della sezione',
    removeSection: 'Rimuovi la sezione',
    sectionDescPlaceholder: 'Descrizione della sezione (facoltativa)',
    sectionDesc: 'Descrizione della sezione',
    addSection: '+ Aggiungi sezione',
    addLooseAlbum: '+ Aggiungi album fuori sezione',
    deleteSubpage: 'Elimina la sottopagina',
    done: 'Fatto',
  },

  /** The subpage drawer's Live Preview tab. */
  preview: {
    note: 'Mostrata con il preset del tema salvato per il sito, a larghezza desktop. Le modifiche non salvate in questo pannello compaiono qui; quelle al tema compaiono dopo averle salvate in Impostazioni.',
    settingsFailed: (error: string) =>
      `L’anteprima usa la griglia predefinita e l’inglese finché le impostazioni del sito non sono caricate. ${error}`,
  },

  /** Rows and tiles of the structure list. */
  tiles: {
    reorderHero: (n: number) => `Riordina la foto hero ${n}`,
    reorder: (name: string) => `Riordina ${name}`,
    /** Stands in for a subpage without a name in `reorder`. */
    pageFallback: 'la pagina',
    dragToReorder: 'Trascina per riordinare',
    disabledTitle: 'La pagina è disattivata',
    disabled: 'Disattivata',
    unlistedTitle: 'Nascosta dalla navigazione, raggiungibile con il link diretto',
    /** Short state badges in a list row; one word (feminine: «la pagina»). */
    unlisted: 'Nascosta',
    off: 'Spenta',
    missing: 'Mancante',
    draft: 'Bozza',
    /** Tag marking a content page, as opposed to a subpage; one short word. */
    page: 'Pagina',
    passwordProtected: 'Protetta da password',
    password: 'Password',
    editPage: 'Modifica la pagina',
    albums: (n: number) => `${n} album`,
  },

  newPage: {
    title: 'Nuova pagina',
    titleLabel: 'Titolo',
    titlePlaceholder: 'es. Prezzi',
    url: 'Indirizzo',
    /** An example slug: lowercase letters, digits and dashes only. */
    slugPlaceholder: 'prezzi',
    /** Shown as "/slug" while no slug is typed; same rules as above. */
    slugFallback: 'nome-pagina',
    exists: (slug: string) => `Esiste già una pagina «${slug}».`,
    hint: 'Parte vuota e come bozza. Puoi cambiare l’indirizzo in seguito.',
    showInMenu: 'Mostra nel menu',
    showInMenuDesc: 'La aggiunge in fondo al menu; si salva con «Salva le modifiche».',
    creating: 'Creazione…',
    create: 'Crea la pagina',
  },

  pagePanel: {
    noFile: 'In content/pages/ non c’è un file per questa pagina.',
    serverAnswered: (status: number) => `Il server ha risposto ${status}.`,
    couldNotLoad: 'Impossibile caricare.',
    exists: (slug: string) => `Esiste già una pagina «${slug}».`,
    moveTitle: (slug: string) => `Spostare questa pagina su /${slug}?`,
    linksBreak: (slug: string) =>
      `I link a /${slug} smetteranno di funzionare. Non c’è un reindirizzamento automatico.`,
    movePage: 'Sposta la pagina',
    notSavedConflict:
      'Non salvato: la pagina è stata modificata altrove. Le tue modifiche sono ancora qui.',
    saveFailed: 'Impossibile salvare la pagina',
    saved: 'Pagina salvata.',
    saveOffline: 'Impossibile salvare la pagina. Controlla la connessione e riprova.',
    deleteTitle: (name: string) => `Eliminare «${name}»?`,
    deleteMessageInMenu:
      'La pagina viene rimossa anche dal menu in gallery.yaml. Prima si fa il backup di entrambi i file, che si possono ripristinare da Backup.',
    deleteMessage: 'Ne viene conservata una copia, che si può ripristinare da Backup.',
    deletePage: 'Elimina la pagina',
    deleteFailed: 'Impossibile eliminare la pagina',
    deleted: 'Pagina eliminata.',
    deleteOffline: 'Impossibile eliminare la pagina. Controlla la connessione e riprova.',
    loadFailed: 'Non è stato possibile caricare questa pagina.',
    menuStillLists:
      'Il menu la elenca ancora. Disattiva «Mostra nel menu» e salva la struttura per rimuovere la voce.',
    removeFromMenu: 'Rimuovi dal menu',
    openLive: 'Apri la pagina online in una nuova scheda',
    title: 'Titolo',
    url: 'Indirizzo',
    slugHint: 'Confrontato con sottopagine, album, articoli del diario e percorsi predefiniti.',
    showInMenu: 'Mostra nel menu',
    inMenuDesc:
      'Elencata nel menu dell’intestazione. Trascinala nell’elenco della struttura per spostarla.',
    offMenuDesc:
      'Non è nel menu, ma è raggiungibile al suo indirizzo: per le pagine condivise tramite link.',
    /** Follows `inMenuDesc` / `offMenuDesc`. */
    savedWithStructure: 'Si salva con «Salva le modifiche».',
    draft: 'Bozza',
    draftDesc: 'Solo tu puoi vedere una bozza. Resta fuori dal menu e dalla sitemap.',
    password: 'Password (facoltativa)',
    pagePassword: 'Password della pagina',
    seoDescription: 'Descrizione SEO',
    seoPlaceholder: 'Una o due frasi per i motori di ricerca e le anteprime dei link',
    editContent: 'Modifica il contenuto →',
    savePage: 'Salva la pagina',
  },

  /** The photo-essay block editor in a subpage set to "Photo Essay Mode". */
  essay: {
    /** The starting story of an empty essay: a "# heading" and a paragraph. */
    starterTitle: 'Titolo',
    starterBody: 'Scrivi qui la tua storia...',
    /** Text a newly added block starts with. */
    newHeading: 'Titolo della nuova sezione',
    newParagraph: 'Inserisci qui il paragrafo...',
    newQuote: 'Inserisci qui la citazione...',
    toolbar: 'Aggiungi blocco:',
    add: {
      paragraph: '+ Paragrafo',
      heading: '+ Titolo',
      quote: '+ Citazione in evidenza',
      facts: '+ Dati',
      photo: '+ Foto',
      photoPair: '+ Coppia di foto',
      photoGrid: '+ Griglia di foto',
      album: '+ Album',
      map: '+ Mappa',
    },
    empty:
      'Ancora nessun blocco. Usa i pulsanti qui sopra per costruire il tuo saggio fotografico!',
    moveUp: 'Sposta su',
    moveDown: 'Sposta giù',
    deleteBlock: 'Elimina il blocco',
    headingLevel: 'Livello del titolo',
    headingPlaceholder: 'Titolo della sezione...',
    /** `**bold**` and `*italic*` are markdown syntax; keep the asterisks. */
    paragraphPlaceholder: 'Scrivi il paragrafo... (supporta il Markdown **grassetto** e *corsivo*)',
    quotePlaceholder: 'Testo della citazione...',
    authorPlaceholder: '— Autore / fonte (facoltativo)',
    noPhoto: 'Nessuna foto',
    changePhoto: 'Cambia foto',
    selectPhoto: 'Seleziona foto',
    /** Width options of a photo block; the measures are CSS units. */
    contained: 'Contenuta (68ch)',
    wide: 'Larga (1100px)',
    fullbleed: 'A tutta pagina (100vw)',
    assetUuidPlaceholder: 'UUID dell’asset Immich...',
    photoCaption: 'Didascalia della foto (facoltativa)',
    photoN: (n: number) => `Foto ${n}`,
    selectPhotoN: (n: number) => `Seleziona la foto ${n}`,
    uuidN: (n: number) => `UUID ${n}...`,
    swapPhotos: 'Scambia la foto 1 e la foto 2',
    pairCaption: 'Didascalia comune (facoltativa)',
    removePhoto: 'Rimuovi la foto',
    select: 'Seleziona',
    change: 'Cambia',
    addPhoto: 'Aggiungi foto',
    gridCaption: 'Didascalia della griglia (facoltativa)',
    factLabel: 'Etichetta, es. Distanza',
    factValue: 'Valore, es. 21 km',
    removeFact: 'Rimuovi il dato',
    addFact: 'Aggiungi dato',
    albumUuidPlaceholder: 'UUID dell’album Immich (il selettore di album in Pagine mostra gli ID)',
    countPlaceholder: 'Quantità (tutte)',
    count: 'Quantità',
    skipPlaceholder: 'Salta (0)',
    skip: 'Salta',
    layout: 'Disposizione',
    albumLayouts: {
      grid: 'Griglia (righe da tre)',
      pairs: 'Coppie (righe da due)',
      wide: 'Larghe (una per riga)',
    },
    albumCaption: 'Didascalia per la serie (facoltativa)',
    albumHint:
      'Alla visualizzazione della pagina diventa una serie di blocchi foto, nell’ordine dell’album, con prima l’eventuale ordine manuale della galleria. Lascia vuota la quantità per l’album intero.',
    mapCaption: 'Didascalia, es. Busan → Seul (facoltativa)',
    pointLabel: 'Etichetta (facoltativa)',
    latitude: 'Latitudine',
    /** Placeholders of the latitude / longitude fields; keep them short. */
    lat: 'Lat',
    longitude: 'Longitudine',
    lng: 'Long',
    photoUuidPlaceholder: 'UUID della foto...',
    allPhotosItem: 'Tutte le foto geolocalizzate degli album di questa pagina, in ordine',
    removePin: 'Rimuovi il segnaposto',
    invalidPoint:
      'Un punto richiede una latitudine entro ±90 e una longitudine entro ±180; i punti senza coordinate valide non vengono salvati.',
    addPoint: 'Punto',
    addPhotoPin: 'Segnaposto foto',
    addAllPhotos: 'Tutte le foto geolocalizzate',
    connectLine: 'Collega i segnaposto con una linea',
    mapHint:
      'I punti inseriti a mano vengono pubblicati così come sono. I segnaposto delle foto vengono posizionati sulla pagina online in base al GPS della foto, rispettando la precisione della posizione dell’album. Compare solo se la mappa è attiva nelle Impostazioni.',
  },
  collision: {
    invalid: (slug: string) =>
      `«${slug}» non è uno slug valido: usa solo lettere, cifre, «-» e «_».`,
    reserved: (slug: string) => `/${slug} è un percorso predefinito del sito.`,
    subpage: (slug: string) => `/${slug} è già una sottopagina.`,
    album: (slug: string) => `/${slug} è già un album indipendente.`,
    journal: (slug: string) => `Un articolo del diario usa già lo slug «${slug}».`,
  },
};
