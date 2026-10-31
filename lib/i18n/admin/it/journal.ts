import type { AdminDictionary } from '../index';

/**
 * The journal studio: the entry list, the create dialog, the block editor
 * (also used for content pages), its settings and the live preview.
 */
export const journal: AdminDictionary['journal'] = {
  studio: {
    /** The page header's kicker. */
    kicker: 'Contenuti',
    title: 'Diario',
    description:
      'Articoli del diario, appunti sul campo e lunghi racconti, scritti con un’anteprima dal vivo.',
    newEntry: 'Nuovo articolo del diario',
    emptyTitle: 'Ancora nessun articolo nel diario',
    emptyText:
      'Crea il tuo primo articolo per condividere un diario di viaggio o un reportage di matrimonio.',
    createFirst: 'Crea il primo articolo',
    /** Reading time on an entry card. */
    readingTime: (minutes: number) => `${minutes} min`,
    draft: 'Bozza',
    published: 'Pubblicato',
    /** Shown on a card when the entry has a password. */
    password: 'Password',
    editInStudio: 'Modifica nello studio',
    viewLive: 'Vedi la pagina online',
    /** The delete button's tooltip and the confirm dialog's button. */
    deleteEntry: 'Elimina l’articolo',
    deleteTitle: (name: string) => `Eliminare «${name}»?`,
    deleteMessage: 'Ne viene conservata una copia, che si può ripristinare da Backup.',
    deleteFailed: 'Impossibile eliminare l’articolo del diario',
    deleteError: 'Impossibile eliminare l’articolo del diario. Controlla la connessione e riprova.',
    createFailed: 'Impossibile creare l’articolo del diario',
    createError: 'Impossibile creare l’articolo del diario. Controlla la connessione e riprova.',
    albumsError: 'Impossibile caricare gli album. Controlla la connessione a Immich e riprova.',

    create: {
      title: 'Crea un nuovo articolo del diario',
      titleLabel: 'Titolo',
      titlePlaceholder: 'es. Spedizione a Capo Nord',
      slugLabel: 'Indirizzo (slug)',
      slugPlaceholder: 'es. spedizione-capo-nord',
      /** `slug` is the entry's slug, or `slugFallback` while it is empty. */
      slugHint: (slug: string) => `Sarà raggiungibile su /journal/${slug}`,
      slugFallback: 'nome-articolo',
      startFrom: 'Parti da',
      startFromLabel: 'Punto di partenza dell’articolo',
      tabTemplates: 'Modelli',
      tabAlbums: 'Album',
      blank: 'Vuoto',
      blankDescription: 'Inizia con un editor vuoto.',
      loadingAlbums: 'Caricamento degli album...',
      changeAlbum: 'Cambia album',
      selectAlbum: 'Seleziona un album',
      choosePhotos: 'Scegli le foto',
      choosePhotosSelected: (n: number) =>
        `Scegli le foto (${n} ${n === 1 ? 'selezionata' : 'selezionate'})`,
      selectedPhotos: 'Foto selezionate',
      albumNote: 'All’articolo verranno aggiunte solo le foto che selezioni da questo album.',
      pickerTitle: 'Scegli le foto da questo album',
      creating: 'Creazione...',
      submit: 'Crea e apri lo studio',
    },
  },

  /**
   * The names and descriptions of the starting templates, by template id
   * (`lib/journalTemplates.ts`). The blocks a template inserts stay as written.
   */
  templates: {
    wedding: {
      name: 'Matrimonio',
      description:
        'Data e luogo in apertura, una foto d’apertura, una frase dalle promesse, la festa come griglia.',
    },
    hiking: {
      name: 'Escursionismo / Outdoor',
      description:
        'Distanza e dislivello come dati, il sentiero come griglia, il percorso su una mappa.',
    },
    travel: {
      name: 'Viaggio',
      description: 'Il viaggio su una mappa, poi una tappa per sezione con due foto ciascuna.',
    },
    birthday: {
      name: 'Compleanno / Famiglia',
      description:
        'Quasi niente testo: l’intero album come griglia e un’inquadratura a tutta pagina.',
    },
    'portrait-session': {
      name: 'Servizio di ritratto',
      description:
        'Singole inquadrature larghe con spazio per respirare, e una frase con le sue parole.',
    },
    'behind-the-scenes': {
      name: 'Dietro le quinte',
      description: 'Preparazione e scatto come coppia, poi il risultato finale per chiudere.',
    },
    pets: {
      name: 'Animali domestici',
      description: 'Coppie spontanee, un ritratto ravvicinato pieno di personalità.',
    },
    'new-series': {
      name: 'Nuova serie',
      description:
        'Si apre con una dichiarazione, poi coppie di foto e testo che presentano il progetto.',
    },
  },

  /** The editor of one entry, also used for content pages. */
  editor: {
    loadFailedFallback: 'Non è stato possibile caricare l’articolo.',
    conflictKept: 'Non salvato: è stato modificato altrove. Le tue modifiche sono ancora qui.',
    saveFailed: 'Salvataggio non riuscito',
    saveErrorEntry: 'Impossibile salvare l’articolo. Controlla la connessione e riprova.',
    saveErrorPage: 'Impossibile salvare la pagina. Controlla la connessione e riprova.',
    openingEntry: 'Apertura dello studio del diario...',
    openingPage: 'Apertura dell’editor della pagina...',
    loadFailedEntry: 'Non è stato possibile caricare questo articolo.',
    loadFailedPage: 'Non è stato possibile caricare questa pagina.',
    albumListFailed: (error: string) => `Elenco degli album: ${error}`,
    loadFailedNote:
      'Non è stato modificato nulla. Il salvataggio resta disattivato finché non viene caricato, così un editor vuoto non può sovrascriverlo.',
    backToEntries: 'Torna agli articoli',
    backToPages: 'Torna alle pagine',
    /** The top bar's back button. */
    allEntries: '← Tutti gli articoli',
    pages: '← Pagine',
    storyTitlePlaceholder: 'Titolo dell’articolo...',
    storyTitleLabel: 'Titolo dell’articolo',
    pageTitlePlaceholder: 'Titolo della pagina...',
    pageTitleLabel: 'Titolo della pagina',
    modeLabel: 'Modalità dell’editor',
    modeBlocks: 'Blocchi visivi',
    modeMarkdown: 'Markdown grezzo',
    storySettings: 'Impostazioni dell’articolo',
    pageSettings: 'Impostazioni della pagina',
    publish: 'Pubblica',
    unpublish: 'Ritira',
    publishTitle: 'Pubblica la pagina e salvala subito',
    unpublishTitle: 'Riporta la pagina a bozza e salvala subito',
    /** Link to the published page. */
    live: 'Online',
    saving: 'Salvataggio...',
    saveChanges: 'Salva le modifiche',
    saved: 'Salvato',
    markdownPlaceholder: 'Scrivi qui in Markdown...',
    addBlock: 'Aggiungi blocco:',
    addText: '+ Testo',
    addHeading: '+ Titolo',
    addQuote: '+ Citazione',
    addFacts: '+ Dati',
    addPhoto: '+ Foto',
    addPhotos: '+ Più foto',
    addPair: '+ Coppia di foto',
    addGrid: '+ Griglia di foto',
    addAlbum: '+ Album',
    addMap: '+ Mappa',
    moveUp: 'Sposta su il blocco',
    moveDown: 'Sposta giù il blocco',
    deleteBlock: 'Elimina il blocco',
    resize: 'Ridimensiona editor e anteprima',
  },

  /** Titles of the photo picker, by what it is opened for. */
  pickerTitles: {
    storyPhoto: 'Seleziona una foto per l’articolo',
    photos: 'Aggiungi foto (un blocco per foto)',
    pair: 'Seleziona le foto per la coppia',
    pairPhoto: (n: number) => `Seleziona la foto n. ${n} della coppia`,
    grid: 'Seleziona le foto per la griglia',
    gridPhoto: (n: number) => `Seleziona la foto n. ${n} della griglia`,
    mapPhoto: 'Seleziona una foto da posizionare sulla mappa',
    cover: 'Seleziona la foto di copertina',
  },

  /**
   * The text a new block starts with. It is written into the entry, so it is
   * in the panel's language at the time the block is added.
   */
  blockDefaults: {
    heading: 'Nuovo titolo',
    paragraph: 'Inserisci qui il testo del paragrafo...',
    quote: 'Inserisci il testo della citazione...',
  },

  /** The fields of each block type. */
  blocks: {
    headingLevel: 'Livello del titolo',
    text: 'Testo',
    /** Keep the Markdown markers (`**`, `*`, `[…](…)`) as they are. */
    textPlaceholder: 'Testo (**grassetto**, *corsivo*, [link](https://…))',
    quotePlaceholder: 'Testo della citazione...',
    authorPlaceholder: 'Autore della citazione (facoltativo)',
    legacyRef: (ref: string) =>
      `Il riferimento «${ref}» è una vecchia posizione nell’album, non una foto. Non comparirà nella pagina pubblicata: scegli una foto qui sotto.`,
    legacyRefs: (refs: string[]) =>
      `I riferimenti «${refs.join('», «')}» sono vecchie posizioni nell’album, non foto. Non compariranno nella pagina pubblicata: scegli delle foto qui sotto.`,
    changePhoto: 'Cambia foto',
    pickPhoto: 'Scegli una foto',
    /** An empty photo tile. */
    pick: '+ Scegli',
    photoLayout: 'Layout della foto',
    layoutContained: 'Contenuta (larghezza della colonna)',
    layoutWide: 'Larga (larghezza estesa)',
    layoutFullbleed: 'A tutta pagina (da bordo a bordo)',
    changePhotoButton: 'Cambia foto',
    captionPlaceholder: 'Didascalia (facoltativa)',
    changePairPhoto: (n: number) => `Cambia la foto ${n} della coppia`,
    pickPairPhoto: (n: number) => `Scegli la foto ${n} della coppia`,
    pickPairSlot: (n: number) => `+ Scegli la foto n. ${n}`,
    pickBoth: 'Scegli entrambe le foto',
    pairCaptionPlaceholder: 'Didascalia comune della coppia (facoltativa)',
    /** Alt text of a picked photo's thumbnail. */
    thumb: 'Miniatura',
    pickGridSlot: (n: number) => `+ Scegli n. ${n}`,
    removePhoto: (n: number) => `Rimuovi la foto n. ${n}`,
    addPhoto: 'Aggiungi foto',
    pickSeveral: 'Scegline diverse',
    gridHint: 'Tre o più foto, disposte in righe da tre.',
    gridCaptionPlaceholder: 'Didascalia comune della griglia (facoltativa)',
    factLabelPlaceholder: 'Etichetta, es. Distanza',
    factValuePlaceholder: 'Valore, es. 21 km',
    removeFact: (n: number) => `Rimuovi il dato n. ${n}`,
    addFact: 'Aggiungi dato',
    changeAlbum: 'Cambia album',
    pickAlbum: 'Scegli un album',
    albumPhotoCount: (n: number) => `${n} foto nell’album`,
    albumLoading: 'caricamento…',
    count: 'Quantità',
    /** Placeholder of the empty Count field: every photo. */
    countAll: 'tutte',
    skip: 'Salta',
    layout: 'Disposizione',
    albumLayoutGrid: 'Griglia (righe da tre)',
    albumLayoutPairs: 'Coppie (righe da due)',
    albumLayoutWide: 'Larghe (una per riga)',
    albumCaptionPlaceholder: 'Didascalia per la serie (facoltativa)',
    albumHint:
      'Le foto seguono l’ordine dell’album (prima viene l’eventuale ordine manuale della galleria). Quantità e Salta ne scelgono una parte; lascia vuota la quantità per averle tutte.',
    mapOff:
      'La mappa è disattivata in Impostazioni → Generale. Questo blocco non verrà mostrato finché non la attivi.',
    mapCaptionPlaceholder: 'Didascalia, es. Busan → Seul (facoltativa)',
    pointLabelPlaceholder: 'Etichetta (facoltativa)',
    /** Short placeholders of the coordinate fields. */
    lat: 'Lat',
    latitude: 'Latitudine',
    lng: 'Long',
    longitude: 'Longitudine',
    pickPhotoTile: '+ Scegli una foto',
    allPhotosItem: 'Tutte le foto geolocalizzate di questo articolo, in ordine',
    movePinUp: 'Sposta su il segnaposto',
    movePinDown: 'Sposta giù il segnaposto',
    removePin: 'Rimuovi il segnaposto',
    invalidCoordinates:
      'Un punto richiede una latitudine entro ±90 e una longitudine entro ±180. I punti senza coordinate valide non vengono salvati.',
    addPoint: 'Punto',
    addPhotoPin: 'Segnaposto foto',
    addAllPhotos: 'Tutte le foto geolocalizzate',
    connectLine: 'Collega i segnaposto con una linea',
    mapHint:
      'I punti inseriti a mano compaiono subito nell’anteprima. I segnaposto delle foto vengono posizionati sulla pagina online in base al GPS della foto, rispettando la precisione della posizione dell’album.',
  },

  storySettings: {
    title: 'Impostazioni e metadati dell’articolo',
    subtitle: 'Sottotitolo',
    subtitlePlaceholder: 'es. Appunti dal nostro viaggio d’inverno',
    author: 'Autore',
    authorPlaceholder: 'es. Marco',
    date: 'Data di pubblicazione',
    cover: 'Foto di copertina',
    coverAlt: 'Copertina',
    chooseCover: 'Scegli la copertina',
    password: 'Protezione con password (facoltativa)',
    draft: 'Mantieni come bozza (nascosto dall’elenco pubblico /journal)',
    done: 'Fatto',
  },

  pageSettings: {
    title: 'Impostazioni della pagina',
    description: 'Descrizione SEO',
    descriptionPlaceholder: 'Una o due frasi per i motori di ricerca e le anteprime dei link',
    draft: 'Bozza',
    draftDescription: 'Solo tu puoi vedere una bozza, che resta fuori dal menu e dalla sitemap.',
    password: 'Password (facoltativa)',
    passwordLabel: 'Password della pagina',
    note: 'Le impostazioni si salvano con la pagina. L’indirizzo e la posizione nel menu si impostano in Pagine.',
  },

  preview: {
    label: 'Anteprima del tema in tempo reale',
    widthLabel: 'Larghezza dell’anteprima',
    desktop: 'Desktop',
    mobile: 'Smartphone',
  },
};
