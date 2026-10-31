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
    kicker: 'Inhoud',
    title: 'Pagina’s',
    description:
      'De hero van de startpagina, losse albums, subpagina’s en inhoudspagina’s. Sleep om te herschikken; wijzigingen staan online zodra ze zijn opgeslagen.',
  },

  builder: {
    /** A subpage the server would refuse: it has no albums and no sections. */
    pageNeedsAlbum: (pages: string) =>
      `${pages} heeft minstens één album nodig. Voeg er een toe of verwijder de pagina.`,
    albumListFailed: (error: string) =>
      `De Immich-albums zijn niet geladen, daarom is de albumkiezer leeg. ${error}`,
    pageListFailed: (error: string) =>
      `De inhoudspagina’s zijn niet geladen; hun menu-items blijven zoals ze zijn. ${error}`,
    loadFailed: 'De paginastructuur kon niet worden geladen.',
    loadFailedNote:
      'Er is niets gewijzigd. Opslaan blijft uitgeschakeld tot die geladen is, zodat een lege editor je galerij niet kan overschrijven.',
    notSavedConflict: 'Niet opgeslagen — gallery.yaml is elders gewijzigd.',
    saved: 'Opgeslagen!',
    /** Inserted into "Error: …" (common.errorWith). */
    saveFailed: 'Opslaan mislukt',
    saveChanges: 'Wijzigingen opslaan',
    createFailed: 'Aanmaken van de pagina mislukt',
    createdInMenu:
      'Pagina als concept aangemaakt. Kies Wijzigingen opslaan om die in het menu te zetten.',
    created: 'Pagina als concept aangemaakt.',
    createOffline:
      'De pagina kon niet worden aangemaakt. Controleer de verbinding en probeer het opnieuw.',
    /** Toasts after a removal; each offers `undo`. */
    pageRemoved: 'Pagina verwijderd.',
    albumRemoved: 'Album verwijderd.',
    albumRemovedFromPage: 'Album van de pagina verwijderd.',
    albumRemovedFromSection: 'Album uit de sectie verwijderd.',
    heroRemoved: 'Hero-foto verwijderd.',
    undo: 'Ongedaan maken',
    undoFailed:
      'Ongedaan maken lukt niet: de paginastructuur is intussen gewijzigd. Er is nog niets opgeslagen.',
    /** What screen readers call a dragged item ("Picked up page "Travel"."). */
    drag: {
      page: (name: string) => `pagina “${name}”`,
      untitled: 'Naamloos',
      hero: (n: number) => `hero-foto ${n} van de startpagina`,
      album: (name: string) => `album “${name}”`,
      item: 'onderdeel',
    },
    /** The structure list on the left. */
    tree: 'Paginastructuur',
    searchLabel: 'Albums of subpagina’s zoeken',
    searchPlaceholder: 'Albums of subpagina’s zoeken…',
    clearSearch: 'Zoekopdracht wissen',
    homePage: 'Startpagina',
    heroPhotos: 'Hero-foto’s',
    menu: 'Menu',
    subpagesLive: (live: number, total: number) =>
      `${live} van ${total} ${total === 1 ? 'subpagina' : 'subpagina’s'} online`,
    noMatches: 'Geen overeenkomende items.',
    newSubpage: 'Nieuwe subpagina',
    newPage: 'Nieuwe pagina',
    notInMenu: 'Niet in het menu',
    offMenuEmpty:
      'Pagina’s die alleen via hun link bereikbaar zijn. Sleep een pagina hierheen om die uit het menu te halen.',
    standaloneGroup: 'Losse albums',
    onHomePage: 'Op de startpagina',
    /** The panel for standalone albums. */
    standaloneHeading: 'Losse albums',
    addAlbum: '+ Album toevoegen',
    noMatchingStandalone: 'Geen overeenkomende losse albums gevonden.',
    noStandalone: 'Geen losse albums. Die verschijnen direct op de startpagina.',
    /** The panel for the home page hero. */
    addHero: 'Hero-foto toevoegen',
    heroPickerTitle: 'Hero-foto’s voor de startpagina kiezen',
    noHero:
      'Geen hero-foto’s ingesteld. Voeg foto’s toe om een hero-carrousel op de startpagina te tonen.',
  },

  /** Seed values for a new subpage or section, written into gallery.yaml. */
  defaults: {
    subpageName: (n: number) => `Nieuwe subpagina ${n}`,
    sectionTitle: 'Nieuwe sectie',
  },

  /** The per-album photo order (Listbox options and the card's badge tooltip). */
  sort: {
    immich: 'Immich-volgorde (standaard)',
    newest: 'Nieuwste eerst',
    oldest: 'Oudste eerst',
    filename: 'Bestandsnaam',
    manual: 'Handmatig',
  },

  albumCard: {
    unlisted: 'Niet vermeld los album',
    reorder: (name: string) => `${name} herschikken`,
    dragToReorder: 'Sleep om te herschikken',
    editDetails: 'Details bewerken',
    removeAlbum: 'Album verwijderen',
    passwordProtected: 'Met wachtwoord beveiligd',
    customHero: 'Eigen hero-foto ingesteld',
    /** `label` is one of the `sort` labels. */
    photoOrder: (label: string) => `Fotovolgorde: ${label}`,
    /** English deliberately says "photos" for every count here. */
    photos: (n: number) => `${n} ${n === 1 ? 'foto' : 'foto’s'}`,
  },

  albumDrawer: {
    link: 'Link',
    linkHint:
      'Dit is het adres dat bezoekers gebruiken. Laat de slug leeg om hem uit de titel af te leiden.',
    randomLink: 'Willekeurige link',
    copyLink: 'Link kopiëren',
    linkCopied: 'Gekopieerd',
    visibility: 'Zichtbaarheid',
    unlisted: 'Niet vermeld',
    unlistedDesc:
      'Alleen bereikbaar via een directe link — niet in het menu, op de homepage, in de sitemap of op de kaart. De URL is raadbaar; voeg een wachtwoord toe voor alles wat privé moet blijven.',
    listedDesc:
      'Wordt net als elk ander los album getoond in het menu, op de homepage en in de sitemap.',
    heading: 'Albumdetails bewerken',
    close: 'Details sluiten',
    photos: (n: number) => `${n} ${n === 1 ? 'foto' : 'foto’s'}`,
    /** Shown after the photo count when the title is overridden. */
    original: (name: string) => `Origineel: ${name}`,
    titleOverride: 'Afwijkende titel',
    description: 'Beschrijving',
    descriptionPlaceholder: 'Optionele beschrijving voor bezoekers',
    passwordProtection: 'Wachtwoordbeveiliging',
    albumPassword: 'Albumwachtwoord',
    downloads: 'Downloads',
    allowDownloads: 'Downloaden van originelen toestaan',
    allowDownloadsDesc:
      'Bezoekers kunnen het hele album of hun geselecteerde foto’s als ZIP downloaden',
    zoomInherit: 'Overnemen van pagina- / site-instellingen',
    zoomHint:
      'Laat bezoekers in de fotoviewer inzoomen op een foto om de scherpte te controleren. JPEG- en AVIF-originelen worden zonder gps-gegevens getoond; HEIC en RAW hebben de versies op volledige grootte van Immich nodig. PNG, WebP, GIF en in Immich bewerkte foto’s worden nooit gezoomd. Geldt waar het album hier wordt vermeld.',
    layoutOverride: 'Afwijkende opmaak (experimenteel)',
    layoutOverrideAria: 'Afwijkende opmaak',
    layoutInherit: 'Overnemen van pagina- / algemene instellingen',
    layouts: {
      masonry: 'Masonry',
      uniform: 'Gelijkmatig raster',
      showcase: 'Etalage',
      filmstrip: 'Filmstrook',
      editorialFlow: 'Redactionele stroom',
      justified: 'Uitgevuld (experimenteel)',
    },
    coverFocalPoint: 'Brandpunt van de omslag (experimenteel)',
    /** "50% 25%" and "top" are CSS values; keep them as written. */
    coverFocalPointPlaceholder:
      'bijv. “50% 25%” of “top” — waar de uitsnede van de omslag aan vastzit',
    customHero: 'Eigen hero-foto',
    heroAlt: 'Hero-foto',
    removeHero: 'Eigen hero-foto verwijderen',
    defaultCover: 'Standaard albumomslag in gebruik',
    pickHeroTitle: (name: string) => `Hero-foto kiezen voor ${name}`,
    changeImage: 'Foto wijzigen',
    pickHero: 'Hero-foto kiezen',
    photoOrder: 'Fotovolgorde',
    manualHint:
      'Vastgezette foto’s komen eerst, in de volgorde die jij instelt. De rest volgt in de Immich-volgorde van het album.',
    immichHint: 'De Immich-volgorde volgt de eigen sorteerinstelling van het album in Immich.',
    reorderPhotos: 'Foto’s herschikken',
    reorderPhotosPinned: (n: number) => `Foto’s herschikken (${n} vastgezet)`,
    removeAlbum: 'Album verwijderen',
    uuidTitle: 'UUID van het Immich-album',
    copyUuid: 'UUID kopiëren',
    copyUuidAria: 'UUID van het Immich-album kopiëren',
    done: 'Klaar',
  },

  subpageDrawer: {
    breadcrumb: 'Pagina’s / Subpagina’s',
    untitled: 'Naamloze pagina',
    /** Accessible name of the Edit / Live Preview switch. */
    view: 'Weergave',
    livePreview: 'Livevoorbeeld',
    openLive: 'Live pagina in een nieuw tabblad openen (cache omzeilen)',
    close: 'Paneel sluiten',
    pageName: 'Paginanaam (URL-aanduiding)',
    pageNamePlaceholder: 'bijv. dubai, reizen, bruiloften',
    displayTitle: 'Weergavetitel (optioneel)',
    /** Sits in a half-width field; keep it short. */
    displayTitlePlaceholder: 'Als paginanaam',
    subtitle: 'Ondertitel',
    subtitlePlaceholder: 'Ondertiteltekst',
    visibility: 'Zichtbaarheid & toegang',
    visibilityOptions: {
      published: {
        title: 'Gepubliceerd',
        desc: 'Getoond in het menu in de kop en in de lijsten op de startpagina, bereikbaar via de URL',
      },
      unlisted: {
        title: 'Verborgen (experimenteel)',
        desc: 'Niet getoond in menu’s of op de startpagina, maar bereikbaar via een directe link',
      },
      disabled: {
        title: 'Uitgeschakeld',
        desc: 'Helemaal offline — geeft 404, ook bij rechtstreeks openen',
      },
    },
    passwordPlaceholder: 'Wachtwoordbeveiliging (optioneel) — laat leeg voor openbare toegang',
    pagePassword: 'Paginawachtwoord',
    layoutStyle: 'Opmaakstijl van de pagina',
    layoutStyleAria: 'Opmaakstijl van de pagina',
    /** Options of a <select>: plain text only. */
    layouts: {
      masonry: 'Masonry-raster (dynamische hoogte)',
      uniform: 'Gelijkmatig raster (vierkante tegels)',
      showcase: 'Etalage (eerste foto uitgelicht)',
      filmstrip: 'Filmstrook (horizontaal scrollen)',
      editorialFlow: 'Redactionele stroom',
      essay: 'Fotoessaymodus (verhaaleditor)',
    },
    zoomInherit: 'Overnemen van de site-instellingen',
    zoomHint:
      'Geldt voor elk album op deze pagina dat geen eigen instelling heeft. De schakelaar voor de hele site staat onder Instellingen › Algemeen.',
    coverGrid: 'Raster van albumomslagen',
    coverGridHint:
      'Bepaalt hoe de albumomslagen op deze pagina worden ingedeeld — de foto’s in de albums blijven ongewijzigd. Laat het aantal kolommen leeg om de rasterinstelling van de site te volgen, en de tussenruimte leeg om de eigen tussenruimte van het thema te houden. Op tabletbreedte staan er hooguit twee omslagen per rij.',
    photoGrid: 'Fotoraster (albums op deze pagina)',
    photoGridHint:
      'Hoe de foto’s in elk album op deze pagina worden ingedeeld. Laat beide leeg om Instellingen › Raster te volgen; een afzonderlijk album kan dit in gallery.yaml nog steeds overschrijven.',
    essayHeading: 'Verhaal- & fotoessaybouwer',
    essayIntro: 'Stel tekst, citaten en paginabrede of brede foto’s visueel samen.',
    essayPickerTitle: 'Foto voor het fotoessay kiezen',
    albums: 'Albums op deze pagina',
    addAlbum: '+ Album toevoegen',
    noAlbums:
      'Nog geen albums toegevoegd. Klik op + Album toevoegen om er een uit Immich te kiezen.',
    /** Placeholder and accessible name of a section's title field. */
    sectionTitle: 'Titel van de sectie',
    removeSection: 'Sectie verwijderen',
    sectionDescPlaceholder: 'Beschrijving van de sectie (optioneel)',
    sectionDesc: 'Beschrijving van de sectie',
    addSection: '+ Sectie toevoegen',
    addLooseAlbum: '+ Los album toevoegen',
    deleteSubpage: 'Subpagina verwijderen',
    done: 'Klaar',
  },

  /** The subpage drawer's Live Preview tab. */
  preview: {
    note: 'Weergegeven met de opgeslagen themavoorinstelling van de site, op desktopbreedte. Niet-opgeslagen wijzigingen in dit paneel zie je hier; themawijzigingen pas zodra ze in Instellingen zijn opgeslagen.',
    settingsFailed: (error: string) =>
      `De voorvertoning gebruikt het standaardraster en Engels tot de site-instellingen geladen zijn. ${error}`,
  },

  /** Rows and tiles of the structure list. */
  tiles: {
    reorderHero: (n: number) => `Hero-foto ${n} herschikken`,
    reorder: (name: string) => `${name} herschikken`,
    /** Stands in for a subpage without a name in `reorder`. */
    pageFallback: 'pagina',
    dragToReorder: 'Sleep om te herschikken',
    disabledTitle: 'Pagina is uitgeschakeld',
    disabled: 'Uitgeschakeld',
    unlistedTitle: 'Verborgen in de navigatie, bereikbaar via een directe link',
    /** Short state badges in a list row; one word. */
    unlisted: 'Verborgen',
    off: 'Uit',
    missing: 'Ontbreekt',
    draft: 'Concept',
    /** Tag marking a content page, as opposed to a subpage; one short word. */
    page: 'Pagina',
    passwordProtected: 'Met wachtwoord beveiligd',
    password: 'Wachtwoord',
    editPage: 'Pagina bewerken',
    albums: (n: number) => `${n} ${n === 1 ? 'album' : 'albums'}`,
  },

  newPage: {
    title: 'Nieuwe pagina',
    titleLabel: 'Titel',
    titlePlaceholder: 'bijv. Tarieven',
    url: 'URL',
    /** An example slug: lowercase letters, digits and dashes only. */
    slugPlaceholder: 'tarieven',
    /** Shown as "/slug" while no slug is typed; same rules as above. */
    slugFallback: 'slug',
    exists: (slug: string) => `Er bestaat al een pagina “${slug}”.`,
    hint: 'Begint leeg en als concept. Je kunt de URL later wijzigen.',
    showInMenu: 'In het menu tonen',
    showInMenuDesc: 'Zet de pagina achteraan in het menu; opgeslagen met “Wijzigingen opslaan”.',
    creating: 'Aanmaken…',
    create: 'Pagina aanmaken',
  },

  pagePanel: {
    noFile: 'Er is geen bestand voor deze pagina in content/pages/.',
    exists: (slug: string) => `Er bestaat al een pagina “${slug}”.`,
    moveTitle: (slug: string) => `Deze pagina verplaatsen naar /${slug}?`,
    linksBreak: (slug: string) =>
      `Links naar /${slug} werken dan niet meer. Er is geen automatische doorverwijzing.`,
    movePage: 'Pagina verplaatsen',
    notSavedConflict:
      'Niet opgeslagen — de pagina is elders gewijzigd. Je wijzigingen staan er nog.',
    saveFailed: 'Opslaan van de pagina mislukt',
    saved: 'Pagina opgeslagen.',
    saveOffline:
      'De pagina kon niet worden opgeslagen. Controleer de verbinding en probeer het opnieuw.',
    deleteTitle: (name: string) => `“${name}” verwijderen?`,
    deleteMessageInMenu:
      'De pagina wordt ook uit het menu in gallery.yaml verwijderd. Van beide bestanden wordt eerst een back-up gemaakt, die je onder Back-ups kunt terugzetten.',
    deleteMessage: 'Er wordt een kopie bewaard, die je onder Back-ups kunt terugzetten.',
    deletePage: 'Pagina verwijderen',
    deleteFailed: 'Verwijderen van de pagina mislukt',
    deleted: 'Pagina verwijderd.',
    deleteOffline:
      'De pagina kon niet worden verwijderd. Controleer de verbinding en probeer het opnieuw.',
    loadFailed: 'Deze pagina kon niet worden geladen.',
    menuStillLists:
      'Het menu vermeldt de pagina nog. Zet “In het menu tonen” uit en sla de structuur op om het item te verwijderen.',
    removeFromMenu: 'Uit het menu verwijderen',
    openLive: 'De live pagina in een nieuw tabblad openen',
    title: 'Titel',
    url: 'URL',
    slugHint: 'Gecontroleerd tegen subpagina’s, albums, journalverhalen en ingebouwde routes.',
    showInMenu: 'In het menu tonen',
    inMenuDesc:
      'Staat in het menu in de kop. Sleep de pagina in de structuurlijst om die te verplaatsen.',
    offMenuDesc:
      'Niet in het menu, maar bereikbaar via de URL — voor pagina’s die je per link deelt.',
    /** Follows `inMenuDesc` / `offMenuDesc`. */
    savedWithStructure: 'Opgeslagen met “Wijzigingen opslaan”.',
    draft: 'Concept',
    draftDesc: 'Alleen jij ziet een concept. Het blijft buiten het menu en de sitemap.',
    password: 'Wachtwoord (optioneel)',
    pagePassword: 'Paginawachtwoord',
    seoDescription: 'SEO-beschrijving',
    seoPlaceholder: 'Een of twee zinnen voor zoekmachines en linkvoorbeelden',
    editContent: 'Inhoud bewerken →',
    savePage: 'Pagina opslaan',
  },

  /** The photo-essay block editor in a subpage set to "Photo Essay Mode". */
  essay: {
    /** The starting story of an empty essay: a "# heading" and a paragraph. */
    starterTitle: 'Titel',
    starterBody: 'Schrijf hier je verhaal…',
    /** Text a newly added block starts with. */
    newHeading: 'Nieuwe sectiekop',
    newParagraph: 'Typ hier een alinea…',
    newQuote: 'Typ hier het citaat…',
    toolbar: 'Verhaalblok toevoegen:',
    add: {
      paragraph: '+ Alinea',
      heading: '+ Kop',
      quote: '+ Uitgelicht citaat',
      facts: '+ Feiten',
      photo: '+ Foto',
      photoPair: '+ Fotopaar',
      photoGrid: '+ Fotoraster',
      album: '+ Album',
      map: '+ Kaart',
    },
    empty: 'Nog geen verhaalblokken. Bouw je fotoessay met de knoppen hierboven!',
    moveUp: 'Omhoog',
    moveDown: 'Omlaag',
    deleteBlock: 'Blok verwijderen',
    headingLevel: 'Kopniveau',
    headingPlaceholder: 'Sectiekop…',
    /** `**bold**` and `*italic*` are markdown syntax; keep the asterisks. */
    paragraphPlaceholder: 'Schrijf een alinea… (Markdown met **vet** en *cursief* werkt)',
    quotePlaceholder: 'Citaattekst…',
    authorPlaceholder: '— Auteur / bron (optioneel)',
    noPhoto: 'Geen foto',
    changePhoto: 'Foto wijzigen',
    selectPhoto: 'Foto kiezen',
    /** Width options of a photo block; the measures are CSS units. */
    contained: 'Tekstbreedte (68ch)',
    wide: 'Breed (1100px)',
    fullbleed: 'Paginabreed (100vw)',
    assetUuidPlaceholder: 'Immich-asset-UUID…',
    photoCaption: 'Fotobijschrift (optioneel)',
    photoN: (n: number) => `Foto ${n}`,
    selectPhotoN: (n: number) => `Foto ${n} kiezen`,
    uuidN: (n: number) => `UUID van foto ${n}…`,
    swapPhotos: 'Foto 1 en foto 2 omwisselen',
    pairCaption: 'Gezamenlijk bijschrift (optioneel)',
    removePhoto: 'Foto verwijderen',
    select: 'Kiezen',
    change: 'Wijzigen',
    addPhoto: 'Foto toevoegen',
    gridCaption: 'Bijschrift van het raster (optioneel)',
    factLabel: 'Label, bijv. Afstand',
    factValue: 'Waarde, bijv. 21 km',
    removeFact: 'Feit verwijderen',
    addFact: 'Feit toevoegen',
    albumUuidPlaceholder: 'UUID van het Immich-album (de albumkiezer onder Pagina’s toont de ID’s)',
    countPlaceholder: 'Aantal (alle)',
    count: 'Aantal',
    skipPlaceholder: 'Overslaan (0)',
    skip: 'Overslaan',
    layout: 'Opmaak',
    albumLayouts: {
      grid: 'Raster (rijen van drie)',
      pairs: 'Paren (rijen van twee)',
      wide: 'Breed (één per rij)',
    },
    albumCaption: 'Bijschrift voor de reeks (optioneel)',
    albumHint:
      'Wordt bij het weergeven van de pagina uitgevouwen tot fotoblokken — in de volgorde van het album, een handmatige galerijvolgorde eerst. Laat het aantal leeg voor het hele album.',
    mapCaption: 'Bijschrift, bijv. Busan → Seoul (optioneel)',
    pointLabel: 'Label (optioneel)',
    latitude: 'Breedtegraad',
    /** Placeholders of the latitude / longitude fields; keep them short. */
    lat: 'Breedte',
    longitude: 'Lengtegraad',
    lng: 'Lengte',
    photoUuidPlaceholder: 'UUID van de foto…',
    allPhotosItem: 'Alle foto’s met locatie uit de albums van deze pagina, op volgorde',
    removePin: 'Speld verwijderen',
    invalidPoint:
      'Een punt heeft een breedtegraad binnen ±90 en een lengtegraad binnen ±180 nodig; punten zonder geldige coördinaten worden niet opgeslagen.',
    addPoint: 'Punt',
    addPhotoPin: 'Fotospeld',
    addAllPhotos: 'Alle foto’s met locatie',
    connectLine: 'Spelden met een lijn verbinden',
    mapHint:
      'Getypte punten worden gepubliceerd zoals getypt. Fotospelden worden op de live pagina geplaatst op basis van de gps-gegevens van de foto, binnen de locatieprecisie van het album. Alleen getoond zolang de kaart in Instellingen is ingeschakeld.',
  },
  collision: {
    invalid: (slug: string) =>
      `“${slug}” is geen geldige slug: gebruik alleen letters, cijfers, “-” en “_”.`,
    reserved: (slug: string) => `/${slug} is een ingebouwde route van de site.`,
    subpage: (slug: string) => `/${slug} is al een subpagina.`,
    album: (slug: string) => `/${slug} is al een los album.`,
    journal: (slug: string) => `Een journalverhaal gebruikt de slug “${slug}” al.`,
  },
};
