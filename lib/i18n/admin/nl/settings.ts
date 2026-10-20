import type { AdminDictionary } from '../index';

/**
 * Settings (`/admin/settings/<section>`): the editor shell, each section, the
 * privacy policy editor in Legal, and the shared form fields.
 *
 * `{name}` placeholders are filled with markup by `rich()` — usually a
 * `<code>` element holding a file name or an environment variable.
 */
export const settings: AdminDictionary['settings'] = {
  editor: {
    sections: {
      general: 'Algemeen',
      theme: 'Thema',
      grid: 'Raster',
      footer: 'Voettekst',
      legal: 'Juridisch',
      seo: 'SEO',
      security: 'Beveiliging & bescherming',
      about: 'Over mij',
    },
    kicker: 'Website',
    title: 'Instellingen',
    description: 'Opgeslagen wijzigingen gelden meteen voor de site, zonder herstart.',
    saveChanges: 'Wijzigingen opslaan',
    sessionExpired: 'Je sessie is verlopen. Meld je opnieuw aan om verder te gaan.',
    serverAnswered: (status: number) => `De server antwoordde met ${status}.`,
    loadFailed: 'De instellingen konden niet worden geladen.',
    loadErrorTitle: 'Instellingen konden niet worden geladen.',
    loadErrorBody:
      'Er is niets gewijzigd. Opslaan blijft uitgeschakeld tot ze geladen zijn, zodat een leeg formulier je configuratie niet kan overschrijven.',
    conflict: 'Niet opgeslagen — de instellingen zijn elders gewijzigd.',
    saved: 'Opgeslagen!',
    saveFailed: 'Opslaan mislukt',
  },

  general: {
    title: 'Algemene site-instellingen',
    sub: 'Stel de identiteit van de site, de taal en de belangrijkste functies in.',
    siteTitle: 'Sitetitel',
    siteTitleHint: 'Getoond in de kop van de site, het browsertabblad en linkvoorbeelden.',
    /** `title` is what the site shows instead; `fromEnv` when SITE_TITLE supplied it. */
    siteTitleEmpty: (title: string, fromEnv: boolean) =>
      `Leeg, dus de site toont “${title}”${fromEnv ? ', uit SITE_TITLE' : ''}.`,
    subtitle: 'Ondertitel',
    subtitlePlaceholder: 'Een visueel dagboek',
    language: 'Taal',
    languageHint:
      'De interface voor bezoekers is vertaald in {locales}. Andere talen bepalen nog steeds {htmlLang} en de datumnotatie, maar tonen de Engelse interface. Het beheerpaneel heeft hieronder een eigen taalinstelling.',
    adminLanguage: 'Taal van het beheerpaneel',
    adminLanguageSame: 'Zelfde als de sitetaal',
    adminLanguageHint:
      'De taal van dit beheerpaneel. Die verandert zodra de instellingen zijn opgeslagen.',

    featuresTitle: 'Portfoliofuncties & modules',
    featuresSub:
      'Optionele pagina’s, en wat de site over je foto’s prijsgeeft en over bezoeken telt.',
    modules: 'Modules',
    modulesDesc: 'Elke module voegt een pagina of een bedieningselement voor bezoekers toe.',
    aboutPage: 'Over-mij-pagina',
    aboutPageDesc: 'Portret, bio en uitrusting op /about',
    map: 'Kaart',
    mapDesc: 'Fotolocaties op een wereldkaart op /map',
    proofing: 'Klantselectie',
    proofingDesc: 'Bezoekers geven foto’s een hartje, filteren en exporteren een selectie',
    zoom: 'Fotozoom',
    zoomDesc:
      'Bezoekers zoomen in op een foto op volledige resolutie (1:1) om de scherpte te controleren. Pagina’s en albums kunnen dit overschrijven',
    proofingEmail: 'E-mailadres voor selecties',
    proofingEmailPlaceholder: 'Standaard het contactadres uit de voettekst',
    proofingEmailHint:
      'Waar “E-mail naar de fotograaf sturen” een selectie naartoe stuurt. Valt terug op het contactadres uit de voettekst; als geen van beide is ingesteld, wordt de knop verborgen.',

    privacyGroup: 'Wat bezoekers over je te weten komen',
    privacyGroupDesc: 'Wat elke foto prijsgeeft, en wat er over een bezoek wordt geteld.',
    privacyGroupChip: 'zichtbaar voor bezoekers',
    photoMetadata: 'Fotometadata',
    metadataSummary: {
      camera: 'Camera & objectief',
      exposure: 'Belichting',
      location: 'Locatie',
      description: 'Beschrijving',
      none: 'Niets gepubliceerd — de fotoviewer verbergt het infopaneel',
    },
    details: 'Details',
    exifCamera: 'Camera & objectief',
    exifCameraDesc: 'Camerabody, objectief en brandpuntsafstand',
    exifSettings: 'Belichtingsinstellingen',
    exifSettingsDesc: 'Diafragma, sluitertijd en ISO',
    exifLocation: 'Locatie',
    exifLocationDesc: 'Stad en land uit de gps-gegevens van de foto',
    exifCaption: 'Fotobeschrijving',
    exifCaptionDesc: 'De beschrijving die in Immich is geschreven',
    gridHover: 'Samenvatting bij aanwijzen in het raster',
    gridHoverDesc: 'Camera en objectief over de foto, niet alleen in de fotoviewer',
    gridHoverNeedsCamera: 'Vereist Camera & objectief',
    analytics: 'Statistieken',
    analyticsDesc: 'Weergaven tellen zonder cookies, alleen op je eigen server opgeslagen',

    favicon: 'Favicon',
    faviconAlt: 'Huidige favicon',
    faviconUpload: 'Pictogram uploaden',
    faviconUploadFailed: 'Uploaden mislukt',
    faviconResetFailed: 'Herstellen mislukt',
    faviconResetTitle: 'Favicon herstellen?',
    faviconResetMessage:
      'Het geüploade pictogram wordt verwijderd en de meegeleverde standaard wordt weer gebruikt.',
    faviconHint:
      'SVG, PNG, ICO of JPEG — max. 512 kB. Opgeslagen in het content-volume. Herstellen zet de meegeleverde standaard terug.',
  },

  theme: {
    title: 'Voorinstellingen & kleurmodus',
    sub: 'Kies een typografische voorinstelling en bekijk het voorbeeld in lichte of donkere modus.',
    visitorMode: 'Standaardmodus voor bezoekers',
    visitorModeAria: 'Standaardmodus voor bezoekers',
    modeDark: 'Donker',
    modeLight: 'Licht',
    modeAuto: 'Systeem van de bezoeker volgen',
    visitorModeHint:
      'Wat een nieuwe bezoeker ziet. Met de licht/donker-schakelaar in de kop van de site kan die nog steeds zelf kiezen, en die keuze wordt op het apparaat onthouden. Het voorbeeld hieronder is alleen voor jou en verandert hier niets aan.',
    preset: 'Voorinstelling',
    /** Under each preset card: font, corner radius and photo frame. */
    presetSpecs: (font: string, radius: number, frame: string) =>
      `${font} · hoekradius ${radius} · ${frame}`,
    colorMode: 'Kleurmodus',
    /** {editorial}, {minimal}, {classic}: preset names, set in bold. */
    colorModeHint:
      'Voorinstellingen als {editorial}, {minimal} & {classic} hebben in de lichte modus warme, lichte crèmetinten als achtergrond en in de donkere modus antraciet.',
    lightMode: 'Lichte modus (crème / beige)',
    darkMode: 'Donkere modus (antraciet)',
    accentTitle: 'Accentkleur',
    accentSub: 'Kies een accentkleur voor links, knoppen en markeringen.',
    swatches: {
      studioRed: 'Studiorood',
      editorialGold: 'Redactioneel goud',
      emerald: 'Smaragd',
      sapphire: 'Saffier',
      violet: 'Paars',
      white: 'Monochroom wit',
      black: 'Obsidiaanzwart',
    },
    accentAria: 'Accentkleur',
    accentHexAria: 'Accentkleur (hex)',
    frameTitle: 'Fotolijst & opmaak',
    frameSub: 'Pas de randen rond foto’s en de opmaak van de hero aan.',
    photoFrame: 'Fotolijst',
    photoFrames: {
      none: { label: 'Geen', desc: 'Foto zonder lijst, met strakke randen' },
      passepartout: { label: 'Passe-partout', desc: 'Klassiek passe-partout zoals in een galerie' },
      shadow: { label: 'Schaduw', desc: 'Zachte, zwevende slagschaduw' },
    },
    heroStyle: 'Hero-stijl',
    heroStyles: {
      split: { label: 'Gesplitst', desc: 'Titel en foto naast elkaar' },
      fullbleed: { label: 'Paginabreed', desc: 'Banner over de volle breedte, van rand tot rand' },
      minimal: { label: 'Minimaal', desc: 'Gecentreerde titel met subtiele foto' },
      stacked: { label: 'Gestapeld', desc: 'Titel direct boven de foto gestapeld' },
      typographic: { label: 'Typografisch', desc: 'Grote tekstkop, geen foto’s' },
      mosaic: { label: 'Mozaïek', desc: 'Dynamische fotocollage' },
      cover: {
        label: 'Omslag (experimenteel)',
        desc: 'Schermvullend openingsbeeld met één Binnenkomen-link',
      },
    },
    lookTitle: 'Uiterlijk & beweging',
    lookSub: 'Effecten en kleine bedieningselementen op elke pagina.',
    transitions: 'Paginaovergangen',
    transitionsDesc: 'Een korte overvloeiing tussen pagina’s',
    scrollToTop: 'Naar-boven-knop',
    scrollToTopDesc: 'Een zwevende pijl op lange pagina’s',
    grain: 'Filmkorrel',
    grainDesc: 'Analoge ruis over de achtergrond',
    headerDot: 'Accentpunt in de kop',
    headerDotDesc: 'Een punt naast de kop van het actieve onderdeel',
  },

  grid: {
    title: 'Raster & opmaak',
    sub: 'Stel de kolomindeling van de galerij en de beeldverhouding van miniaturen in.',
    layout: 'Opmaakalgoritme',
    layouts: {
      masonry: { label: 'Masonry', desc: 'Dynamische, verspringende kolommen in Pinterest-stijl' },
      uniform: { label: 'Gelijkmatig raster', desc: 'Strak raster met gelijke beeldverhouding' },
      showcase: { label: 'Etalage', desc: 'Uitgelichte foto’s gemengd met kleinere tegels' },
      filmstrip: { label: 'Filmstrook', desc: 'Horizontaal scrollbare filmstrook als tijdlijn' },
      'editorial-flow': {
        label: 'Redactionele stroom',
        desc: 'Verhaalopmaak als in een tijdschrift, met wisselende fotoformaten',
      },
      justified: {
        label: 'Uitgevuld (experimenteel)',
        desc: 'Rijen van gelijke hoogte over de volle breedte',
      },
    },
    aspectRatio: 'Beeldverhouding',
    aspectRatios: {
      '1': { label: 'Vierkant (1:1)', desc: 'Vierkant bijgesneden, 1:1' },
      '3/2': { label: 'Liggend (3:2)', desc: 'Standaard liggend kleinbeeldformaat' },
      '2/3': { label: 'Staand (2:3)', desc: 'Verticale, staande oriëntatie' },
      '16/9': { label: 'Bioscoop (16:9)', desc: 'Filmisch breedbeeld, 16:9' },
      auto: { label: 'Origineel', desc: 'Niet bijgesneden, oorspronkelijke verhoudingen' },
    },
    spacingTitle: 'Tussenruimte & kolommen',
    spacingSub:
      'Pas het aantal kolommen en de tussenruimte van het raster aan. Het aantal kolommen bepaalt ook de indeling van de albumomslagen op een subpagina; hun tussenruimte volgt het thema, tenzij een pagina die overschrijft.',
    columns: (min: number, max: number) => `Kolommen (${min} - ${max})`,
    gap: 'Tussenruimte (px)',
  },

  footer: {
    title: 'Voettekst & sociale links',
    sub: 'Toon je naam, Instagram, e-mail en websitelinks in de voettekst van het portfolio.',
    brandName: 'Naam in de voettekst',
    brandNamePlaceholder: 'Mijn fotografie',
    instagram: 'Instagram-URL',
    email: 'Contact-e-mailadres',
    website: 'Persoonlijke website',
    navTitle: 'Navigatielinks in de kop (experimenteel)',
    navSub:
      'Externe links die na je pagina’s in het menu worden getoond. Alleen http(s)-URL’s zijn toegestaan; ze openen in een nieuw tabblad.',
    linkLabel: 'Linktekst',
    /** Example label for an external header link. */
    linkLabelPlaceholder: 'Winkel',
    linkUrl: 'URL',
    removeLink: 'Link verwijderen',
    addLink: '+ Externe link toevoegen',
  },

  legal: {
    title: 'Colofon (Impressum)',
    sub: 'Stel de wettelijk verplichte informatiepagina in volgens de Duitse Digitale-Dienste-Gesetz (DDG).',
    view: 'Bekijk /impressum ↗',
    enable: 'Colofonpagina inschakelen (/impressum)',
    enableDesc: 'Maakt /impressum automatisch aan en linkt ernaar in de voettekst',
    heading: 'Kop',
    headingHint:
      'Laat leeg voor de regel volgens § 5 DDG in de sitetaal. Vul in als een andere wet geldt, bijv. § 5 ECG in Oostenrijk.',
    name: 'Volledige naam / bedrijfsnaam',
    address: 'Straat en huisnummer',
    zipCity: 'Postcode & plaats',
    country: 'Land',
    countryPlaceholder: 'Duitsland',
    email: 'E-mailadres',
    phone: 'Telefoonnummer',
    contactUrl: 'URL van het contactformulier',
    contactUrlInvalid:
      'Moet beginnen met https:// of http://. Elke andere link wordt van de pagina weggelaten.',
    contactLabel: 'Tekst van de contactlink',
    contactLabelPlaceholder: 'Contactformulier',
    vatId: 'Btw-nummer',
    taxId: 'Fiscaal nummer',
    extraInfo: 'Aanvullende informatie',
    contactForm: 'Contactformulier (/contact)',
    contactFormDesc:
      'Berichten worden op deze server opgeslagen en gelezen onder Berichten. Er wordt geen e-mail verstuurd.',
    notifyUrl: 'Meldings-URL (ntfy)',
    notifyUrlInvalid: 'Moet beginnen met https:// of http://.',
    notifyUrlHint:
      'Ontvangt een vaste push “nieuw bericht”, zonder iets over de afzender. Kies een topicnaam die niemand kan raden.',
    /** `variable` is the environment variable's name. */
    notifyUrlEnvOverride: (variable: string) => `${variable} overschrijft dit.`,
    retention: 'Berichten verwijderen na (dagen)',
    privacy: 'Privacyverklaring (/privacy)',
    privacyDesc: 'Getoond en gelinkt in de voettekst zodra de tekst hieronder is opgeslagen',
  },

  seo: {
    title: 'Zoekmachineoptimalisatie (SEO)',
    sub: 'Pas de metadata voor zoekmachines, OpenGraph-tags en indexeringsregels aan.',
    snippetPreview: 'Voorbeeld van een Google-zoekresultaat',
    snippetTitle: 'Mijn fotografieportfolio',
    snippetDesc: 'Een zorgvuldig samengestelde selectie fotografiewerk.',
    siteUrl: 'Site-URL',
    /** {sitemap}: the file name sitemap.xml. */
    siteUrlHint:
      'Nodig voor {sitemap}, de feed en gestructureerde data — die worden zonder verzoek gegenereerd, dus het adres kan daar niet uit worden afgeleid. Laat je het leeg, dan blijft de sitemap leeg in plaats van te gokken.',
    /** {variable}: SITE_URL; {value}: the URL it holds. */
    siteUrlFromEnv:
      'Nu ingesteld via de omgevingsvariabele {variable} ({value}). Een waarde die je hier invult, gaat voor zodra die is opgeslagen.',
    metaTitle: 'SEO-metatitel',
    metaTitlePlaceholder: 'Vervangt de standaard sitetitel in Google-zoekresultaten',
    titleTemplate: 'Titelsjabloon voor subpagina’s',
    titleTemplateFallback: 'Mijn portfolio',
    /** {placeholder}: the literal `%s`. */
    titleTemplateHint:
      'Sjabloon voor subpagina’s & albums. Gebruik {placeholder} als plaatshouder voor de paginatitel.',
    previewLabel: 'Voorbeeld:',
    previewExample: 'Landschappen',
    metaDescription: 'SEO-metabeschrijving',
    metaDescriptionPlaceholder: 'Een zorgvuldig samengestelde selectie fotografiewerk…',
    crawlerTitle: 'Instructies voor zoekcrawlers',
    crawlerSub: 'Bepaal hoe Googlebot en andere webcrawlers je site indexeren.',
    noIndex: 'noindex (verbergen voor Google)',
    noIndexDesc: 'Vraagt zoekmachines deze site NIET in zoekresultaten op te nemen',
    noFollow: 'nofollow (links niet volgen)',
    noFollowDesc: 'Vraagt zoekmachinecrawlers uitgaande links niet te volgen',
  },

  security: {
    title: 'Sitewachtwoord',
    sub: 'Zet de hele openbare site achter één wachtwoord — handig zolang een portfolio nog in opbouw is, of voor een folio dat alleen aan klanten wordt getoond.',
    sitePassword: 'Sitewachtwoord',
    sitePasswordAria: 'Sitewachtwoord',
    sitePasswordPlaceholder: 'Laat leeg voor een openbare site',
    /** {hash}: the `scrypt:…` prefix; {file}: settings.yaml. */
    storedHashed: 'Opgeslagen als {hash}-hash in {file}, nooit zoals getypt.',
    /** {variable}: SITE_PASSWORD. */
    envOverride: 'De omgevingsvariabele {variable} overschrijft dit veld.',
    adminSeparate:
      'Het beheerpaneel heeft een eigen wachtwoord en valt nooit achter deze afscherming.',
    protectionTitle: 'Beeldbescherming & watermerk',
    protectionSub:
      'Stel de beeldbescherming, het blokkeren van het rechtsklikmenu en het watermerk in.',
    rightClick: 'Rechtsklikmenu uitschakelen',
    rightClickDesc:
      'Blokkeert het contextmenu op portfoliofoto’s om ongeoorloofd downloaden te bemoeilijken',
    imageDrag: 'Slepen van foto’s uitschakelen',
    imageDragDesc: 'Voorkomt dat bezoekers foto’s van de portfoliopagina slepen',
    watermarkTitle: 'Dynamisch watermerk',
    watermarkSub: 'Legt een copyrighttekst over foto’s in de fotoviewer.',
    watermarkEnable: 'Watermerk inschakelen',
    watermarkEnableDesc: 'Copyrighttekst over de weergave van portfoliofoto’s leggen',
    watermarkText: 'Watermerktekst',
    position: 'Positie',
    positionAria: 'Positie van het watermerk',
    positionBottomRight: 'Rechtsonder',
    positionBottomLeft: 'Linksonder',
    positionCenter: 'Gecentreerd over de foto',
    opacity: (percent: number) => `Dekking (${percent}%)`,
  },

  about: {
    title: 'Over-mij-pagina',
    sub: 'Bewerk het portret, de biografie en de uitrusting op de Over-mij-pagina. Onder Algemeen toon of verberg je de pagina zelf.',
    portrait: 'Asset-ID van het portret',
    portraitPlaceholder: 'Immich-asset-UUID van de portretfoto',
    name: 'Naam',
    namePlaceholder: 'Je naam',
    location: 'Locatie',
    locationPlaceholder: 'Stad, land',
    gear: 'Uitrusting (één per regel)',
    biography: 'Biografie (Markdown)',
    biographyPlaceholder: 'Fotograaf uit…',
    loadFailed: 'De Over-mij-pagina kon niet worden geladen.',
    conflict: 'Niet opgeslagen — de Over-mij-pagina is elders gewijzigd.',
  },

  privacy: {
    loadFailed: 'Kon niet worden geladen.',
    /** `error` is a short technical reason, e.g. "HTTP 500". */
    loadError: (error: string) =>
      `De privacyverklaring kon niet worden geladen (${error}). Laad de pagina opnieuw om het nog eens te proberen.`,
    conflict: 'Niet opgeslagen — de verklaring is elders gewijzigd.',
    saveFailed: (status: number) => `Kon niet worden opgeslagen (HTTP ${status}).`,
    saved: 'Privacyverklaring opgeslagen.',
    unreachable: 'De server was niet bereikbaar.',
    factsTitle: 'Wat deze site verwerkt',
    factsHint:
      'Afgeleid uit je huidige configuratie. Een checklist om de verklaring te schrijven, geen tekst voor de pagina.',
    thirdParty: 'derde partij',
    body: 'Privacyverklaring (Markdown)',
    /** Example text in the empty editor; keep the Markdown heading. */
    bodyPlaceholder: '## Verwerkingsverantwoordelijke\n\nNaam, adres, e-mail…',
    /** {heading}, {list}, {bold}, {link}: Markdown syntax examples in code style. */
    syntaxHint:
      'Koppen met {heading}, lijsten met {list}, {bold} en {link}. Getoond op /privacy en gelinkt in de voettekst zodra er tekst is. Eerdere versies worden bewaard onder Back-ups.',
    insertHeadings: 'Koppen invoegen',
    view: 'Bekijk /privacy ↗',
    save: 'Privacyverklaring opslaan',
  },

  fields: {
    /** Link beside a feature switch to its own settings page. */
    configure: 'Instellen →',
    locked: 'Vergrendeld',
    /** {variable}: the environment variable's name. */
    envLockNote:
      'Ingesteld door {variable} in de omgeving. Wijzig of verwijder de variabele daar; wijzigingen hier hebben geen effect.',
    columnsPlaceholder: 'Kolommen (standaard van de site)',
    columnsAria: 'Kolommen',
    gapPlaceholder: 'Tussenruimte in px (standaard van het thema)',
    gapAria: 'Tussenruimte in px',
    passwordPlaceholder: 'Laat leeg voor openbare toegang',
    passwordProtected: 'Beveiligd',
    passwordChange: 'Wijzigen',
    passwordNew: 'Nieuw wachtwoord',
    passwordHide: 'Wachtwoord verbergen',
    passwordShow: 'Wachtwoord tonen',
    passwordKeep: 'Huidig wachtwoord behouden',
    zoom: 'Fotozoom',
    zoomOn: 'Aan — bezoekers kunnen inzoomen op volledige resolutie',
    zoomOff: 'Uit',
  },
};
