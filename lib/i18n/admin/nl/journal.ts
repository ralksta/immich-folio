import type { AdminDictionary } from '../index';

/**
 * The journal studio: the entry list, the create dialog, the block editor
 * (also used for content pages), its settings and the live preview.
 */
export const journal: AdminDictionary['journal'] = {
  studio: {
    /** The page header's kicker. */
    kicker: 'Inhoud',
    title: 'Journal',
    description: 'Verhalen, veldnotities en lange fotoessays, geschreven met een livevoorbeeld.',
    newEntry: 'Nieuw journalverhaal',
    emptyTitle: 'Nog geen journalverhalen',
    emptyText: 'Maak je eerste verhaal om reisverslagen of trouwreportages te delen.',
    createFirst: 'Eerste verhaal maken',
    /** Reading time on an entry card. */
    readingTime: (minutes: number) => `${minutes} min lezen`,
    draft: 'Concept',
    published: 'Gepubliceerd',
    /** Shown on a card when the entry has a password. */
    password: 'Wachtwoord',
    editInStudio: 'Bewerken in de studio',
    viewLive: 'Live pagina bekijken',
    /** The delete button's tooltip and the confirm dialog's button. */
    deleteEntry: 'Verhaal verwijderen',
    deleteTitle: (name: string) => `“${name}” verwijderen?`,
    deleteMessage: 'Er wordt een kopie bewaard, die je onder Back-ups kunt terugzetten.',
    deleteFailed: 'Verwijderen van het journalverhaal mislukt',
    deleteError:
      'Het journalverhaal kon niet worden verwijderd. Controleer de verbinding en probeer het opnieuw.',
    createFailed: 'Aanmaken van het journalverhaal mislukt',
    createError:
      'Het journalverhaal kon niet worden aangemaakt. Controleer de verbinding en probeer het opnieuw.',
    albumsError:
      'De albums konden niet worden geladen. Controleer de verbinding met Immich en probeer het opnieuw.',

    create: {
      title: 'Nieuw journalverhaal maken',
      titleLabel: 'Titel',
      titlePlaceholder: 'bijv. Expeditie Noordkaap',
      slugLabel: 'URL-slug',
      slugPlaceholder: 'bijv. expeditie-noordkaap',
      /** `slug` is the entry's slug, or `slugFallback` while it is empty. */
      slugHint: (slug: string) => `Komt beschikbaar op /journal/${slug}`,
      slugFallback: 'slug',
      startFrom: 'Beginnen met',
      startFromLabel: 'Startpunt van het journalverhaal',
      tabTemplates: 'Sjablonen',
      tabAlbums: 'Albums',
      blank: 'Leeg',
      blankDescription: 'Begin met een lege editor.',
      loadingAlbums: 'Albums laden…',
      changeAlbum: 'Ander album kiezen',
      selectAlbum: 'Album kiezen',
      choosePhotos: 'Foto’s kiezen',
      choosePhotosSelected: (n: number) => `Foto’s kiezen (${n} geselecteerd)`,
      selectedPhotos: 'Geselecteerde foto’s',
      albumNote:
        'Alleen de foto’s die je uit dit album selecteert, worden aan het journalverhaal toegevoegd.',
      pickerTitle: 'Foto’s uit dit album kiezen',
      creating: 'Aanmaken…',
      submit: 'Aanmaken & studio openen',
    },
  },

  /**
   * The names and descriptions of the starting templates, by template id
   * (`lib/journalTemplates.ts`). The blocks a template inserts stay as written.
   */
  templates: {
    wedding: {
      name: 'Bruiloft',
      description:
        'Datum en locatie vooraan, één hero-foto, een zin uit de geloften, het feest als raster.',
    },
    hiking: {
      name: 'Wandelen / buiten',
      description:
        'Afstand en hoogteverschil als feiten, het pad als raster, de route op een kaart.',
    },
    travel: {
      name: 'Reizen',
      description: 'De reis op een kaart, daarna één sectie per halte met elk twee foto’s.',
    },
    birthday: {
      name: 'Verjaardag / familie',
      description: 'Bijna geen tekst — het hele album als raster en één paginabreed beeld.',
    },
    'portrait-session': {
      name: 'Portretsessie',
      description: 'Losse brede beelden met ruimte om te ademen, en een zin in hun eigen woorden.',
    },
    'behind-the-scenes': {
      name: 'Achter de schermen',
      description: 'Opbouw en shoot als paar, daarna het eindresultaat om mee af te sluiten.',
    },
    pets: {
      name: 'Huisdieren',
      description: 'Spontane paren, één close-upportret vol karakter.',
    },
    'new-series': {
      name: 'Nieuwe serie',
      description:
        'Opent met een statement, daarna paren van foto en tekst die het project voorstellen.',
    },
  },

  /** The editor of one entry, also used for content pages. */
  editor: {
    sessionExpired: 'Je sessie is verlopen. Meld je opnieuw aan om verder te gaan.',
    serverAnswered: (status: number) => `De server antwoordde met ${status}.`,
    loadFailedFallback: 'Het verhaal kon niet worden geladen.',
    conflictKept: 'Niet opgeslagen — het is elders gewijzigd. Je wijzigingen staan er nog.',
    saveFailed: 'Opslaan mislukt',
    saveErrorEntry:
      'Het verhaal kon niet worden opgeslagen. Controleer de verbinding en probeer het opnieuw.',
    saveErrorPage:
      'De pagina kon niet worden opgeslagen. Controleer de verbinding en probeer het opnieuw.',
    openingEntry: 'Journalstudio openen…',
    openingPage: 'Pagina-editor openen…',
    loadFailedEntry: 'Dit verhaal kon niet worden geladen.',
    loadFailedPage: 'Deze pagina kon niet worden geladen.',
    albumListFailed: (error: string) => `Albumlijst: ${error}`,
    loadFailedNote:
      'Er is niets gewijzigd. Opslaan blijft uitgeschakeld tot het geladen is, zodat een lege editor het niet kan overschrijven.',
    backToEntries: 'Terug naar de verhalen',
    backToPages: 'Terug naar de pagina’s',
    /** The top bar's back button. */
    allEntries: '← Alle verhalen',
    pages: '← Pagina’s',
    storyTitlePlaceholder: 'Titel van het verhaal…',
    storyTitleLabel: 'Titel van het verhaal',
    pageTitlePlaceholder: 'Paginatitel…',
    pageTitleLabel: 'Paginatitel',
    modeLabel: 'Editormodus',
    modeBlocks: 'Visuele blokken',
    modeMarkdown: 'Ruwe Markdown',
    storySettings: 'Verhaalinstellingen',
    pageSettings: 'Pagina-instellingen',
    publish: 'Publiceren',
    unpublish: 'Publicatie intrekken',
    publishTitle: 'De pagina publiceren en nu opslaan',
    unpublishTitle: 'De pagina weer een concept maken en nu opslaan',
    /** Link to the published page. */
    live: 'Live',
    saving: 'Opslaan…',
    saveChanges: 'Wijzigingen opslaan',
    saved: 'Opgeslagen',
    markdownPlaceholder: 'Schrijf hier Markdown…',
    addBlock: 'Blok toevoegen:',
    addText: '+ Tekst',
    addHeading: '+ Kop',
    addQuote: '+ Citaat',
    addFacts: '+ Feiten',
    addPhoto: '+ Foto',
    addPhotos: '+ Foto’s',
    addPair: '+ Fotopaar',
    addGrid: '+ Fotoraster',
    addAlbum: '+ Album',
    addMap: '+ Kaart',
    moveUp: 'Blok omhoog',
    moveDown: 'Blok omlaag',
    deleteBlock: 'Blok verwijderen',
    resize: 'Breedte van editor en voorbeeld aanpassen',
  },

  /** Titles of the photo picker, by what it is opened for. */
  pickerTitles: {
    storyPhoto: 'Foto voor het verhaal kiezen',
    photos: 'Foto’s toevoegen (elk een eigen blok)',
    pair: 'Foto’s voor het paar kiezen',
    pairPhoto: (n: number) => `Foto ${n} voor het paar kiezen`,
    grid: 'Foto’s voor het raster kiezen',
    gridPhoto: (n: number) => `Foto ${n} voor het raster kiezen`,
    mapPhoto: 'Kies een foto om op de kaart te plaatsen',
    cover: 'Omslagfoto kiezen',
  },

  /**
   * The text a new block starts with. It is written into the entry, so it is
   * in the panel's language at the time the block is added.
   */
  blockDefaults: {
    heading: 'Nieuwe kop',
    paragraph: 'Typ hier een alinea…',
    quote: 'Typ het citaat…',
  },

  /** The fields of each block type. */
  blocks: {
    headingLevel: 'Kopniveau',
    text: 'Tekst',
    /** Keep the Markdown markers (`**`, `*`, `[…](…)`) as they are. */
    textPlaceholder: 'Tekst (**vet**, *cursief*, [link](https://…))',
    quotePlaceholder: 'Citaattekst…',
    authorPlaceholder: 'Auteur of bron (optioneel)',
    legacyRef: (ref: string) =>
      `Verwijzing “${ref}” is een verouderde albumpositie, geen foto. Die verschijnt niet op de gepubliceerde pagina — kies hieronder een foto.`,
    legacyRefs: (refs: string[]) =>
      `Verwijzingen “${refs.join('”, “')}” zijn verouderde albumposities, geen foto’s. Die verschijnen niet op de gepubliceerde pagina — kies hieronder foto’s.`,
    changePhoto: 'Foto wijzigen',
    pickPhoto: 'Kies een foto',
    /** An empty photo tile. */
    pick: '+ Kiezen',
    photoLayout: 'Fotoweergave',
    layoutContained: 'Tekstbreedte (kolombreedte)',
    layoutWide: 'Breed (verbrede breedte)',
    layoutFullbleed: 'Paginabreed (van rand tot rand)',
    changePhotoButton: 'Foto wijzigen',
    captionPlaceholder: 'Bijschrift (optioneel)',
    changePairPhoto: (n: number) => `Foto ${n} van het paar wijzigen`,
    pickPairPhoto: (n: number) => `Foto ${n} van het paar kiezen`,
    pickPairSlot: (n: number) => `+ Foto ${n} kiezen`,
    pickBoth: 'Beide foto’s kiezen',
    pairCaptionPlaceholder: 'Gezamenlijk bijschrift voor het paar (optioneel)',
    /** Alt text of a picked photo's thumbnail. */
    thumb: 'Miniatuur',
    pickGridSlot: (n: number) => `+ Nr. ${n} kiezen`,
    removePhoto: (n: number) => `Foto ${n} verwijderen`,
    addPhoto: 'Foto toevoegen',
    pickSeveral: 'Meerdere kiezen',
    gridHint: 'Drie of meer foto’s, ingedeeld in rijen van drie.',
    gridCaptionPlaceholder: 'Gezamenlijk bijschrift voor het raster (optioneel)',
    factLabelPlaceholder: 'Label, bijv. Afstand',
    factValuePlaceholder: 'Waarde, bijv. 21 km',
    removeFact: (n: number) => `Feit ${n} verwijderen`,
    addFact: 'Feit toevoegen',
    changeAlbum: 'Ander album kiezen',
    pickAlbum: 'Album kiezen',
    albumPhotoCount: (n: number) => `${n} ${n === 1 ? 'foto' : 'foto’s'} in het album`,
    albumLoading: 'laden…',
    count: 'Aantal',
    /** Placeholder of the empty Count field: every photo. */
    countAll: 'alle',
    skip: 'Overslaan',
    layout: 'Opmaak',
    albumLayoutGrid: 'Raster (rijen van drie)',
    albumLayoutPairs: 'Paren (rijen van twee)',
    albumLayoutWide: 'Breed (één per rij)',
    albumCaptionPlaceholder: 'Bijschrift voor de reeks (optioneel)',
    albumHint:
      'De foto’s volgen de volgorde van het album (een handmatige volgorde in de galerij gaat voor). Met aantal en overslaan kies je een deel; laat aantal leeg voor alle foto’s.',
    mapOff:
      'De kaart staat uit onder Instellingen → Algemeen. Dit blok wordt pas getoond zodra die is ingeschakeld.',
    mapCaptionPlaceholder: 'Bijschrift, bijv. Busan → Seoul (optioneel)',
    pointLabelPlaceholder: 'Label (optioneel)',
    /** Short placeholders of the coordinate fields. */
    lat: 'Breedte',
    latitude: 'Breedtegraad',
    lng: 'Lengte',
    longitude: 'Lengtegraad',
    pickPhotoTile: '+ Foto kiezen',
    allPhotosItem: 'Alle foto’s met locatie uit dit verhaal, op volgorde',
    movePinUp: 'Speld omhoog',
    movePinDown: 'Speld omlaag',
    removePin: 'Speld verwijderen',
    invalidCoordinates:
      'Een punt heeft een breedtegraad binnen ±90 en een lengtegraad binnen ±180 nodig. Punten zonder geldige coördinaten worden niet opgeslagen.',
    addPoint: 'Punt',
    addPhotoPin: 'Fotospeld',
    addAllPhotos: 'Alle foto’s met locatie',
    connectLine: 'Spelden met een lijn verbinden',
    mapHint:
      'Getypte punten verschijnen meteen in het voorbeeld. Fotospelden worden op de live pagina geplaatst op basis van de gps-gegevens van de foto, binnen de locatieprecisie van het album.',
  },

  storySettings: {
    title: 'Verhaalinstellingen & metadata',
    subtitle: 'Ondertitel',
    subtitlePlaceholder: 'bijv. Veldnotities van onze winterreis',
    author: 'Auteur',
    authorPlaceholder: 'bijv. Ralf',
    date: 'Publicatiedatum',
    cover: 'Omslagfoto',
    coverAlt: 'Omslag',
    chooseCover: 'Omslag kiezen',
    password: 'Wachtwoordbeveiliging (optioneel)',
    draft: 'Als concept bewaren (verborgen in de openbare /journal-lijst)',
    done: 'Klaar',
  },

  pageSettings: {
    title: 'Pagina-instellingen',
    description: 'SEO-beschrijving',
    descriptionPlaceholder: 'Een of twee zinnen voor zoekmachines en linkvoorbeelden',
    draft: 'Concept',
    draftDescription: 'Alleen jij ziet een concept, en het blijft buiten het menu en de sitemap.',
    password: 'Wachtwoord (optioneel)',
    passwordLabel: 'Paginawachtwoord',
    note: 'Instellingen worden met de pagina opgeslagen. De URL en de plaats in het menu stel je in onder Pagina’s.',
  },

  preview: {
    label: 'Themavoorbeeld in realtime',
    widthLabel: 'Breedte van het voorbeeld',
    desktop: 'Desktop',
    mobile: 'Mobiel',
  },
};
