/**
 * Dutch dictionary.
 *
 * Typed as `Dictionary` (derived from `en.ts`), so a key added to English but
 * forgotten here fails the type-check rather than falling through to English
 * at runtime.
 */

import type { Dictionary } from '../index';

const plural = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`;

export const nl: Dictionary = {
  dateLocale: 'nl-NL',

  nav: {
    home: 'Start',
    about: 'Over mij',
    map: 'Kaart',
    journal: 'Journal',
    skipToContent: 'Naar de inhoud',
    openMenu: 'Menu openen',
    closeMenu: 'Menu sluiten',
  },

  common: {
    backTo: (label: string) => `Terug naar ${label}`,
    backToGallery: 'Terug naar de galerij',
    backToJournal: 'Terug naar het journal',
    email: 'E-mail',
    website: 'Website',
    home: 'Start',
    photos: (n: number) => plural(n, 'foto', 'foto’s'),
    albums: (n: number) => plural(n, 'album', 'albums'),
    collections: (n: number) => plural(n, 'collectie', 'collecties'),
    prevAlbum: 'Vorig album',
    nextAlbum: 'Volgend album',
    prevAlbumAria: (name: string) => `Vorig album: ${name}`,
    nextAlbumAria: (name: string) => `Volgend album: ${name}`,
    albumNavAria: 'Albumnavigatie',
    prevEntry: 'Vorig verhaal',
    nextEntry: 'Volgend verhaal',
    prevEntryAria: (title: string) => `Vorig verhaal: ${title}`,
    nextEntryAria: (title: string) => `Volgend verhaal: ${title}`,
    entryNavAria: 'Navigatie tussen journalverhalen',
    loadingGallery: 'Galerij laden',
    loadingPhotos: 'Foto’s laden',
    downloadAlbum: 'Album downloaden',
  },

  home: {
    enter: 'Binnenkomen',
  },

  error: {
    notFoundTitle: 'Niet gevonden',
    notFoundText: 'Deze pagina bestaat niet, of het album is niet meer gepubliceerd.',
    errorTitle: 'Er is iets misgegaan',
    errorText:
      'Deze pagina kon niet worden geladen. Meestal is dat tijdelijk — probeer het zo nog eens.',
    siteErrorText:
      'Deze site kon niet worden geladen. Meestal is dat tijdelijk — probeer het zo nog eens.',
    tryAgain: 'Opnieuw proberen',
    reference: (digest: string) => `Referentie: ${digest}`,
  },

  download: {
    unavailableTitle: 'Download niet beschikbaar',
    notAvailable: 'Deze download is niet beschikbaar.',
    rateLimited: 'Te veel downloadverzoeken. Wacht even en probeer het opnieuw.',
    immichUnavailable:
      'De fotobibliotheek is op dit moment niet bereikbaar. Probeer het zo opnieuw.',
    back: 'Terug naar de galerij',
    limitReached: 'Het downloadlimiet voor deze link is bereikt.',
  },

  theme: {
    switchToLight: 'Naar lichte modus',
    switchToDark: 'Naar donkere modus',
    scrollToTop: 'Naar boven',
  },

  password: {
    subtitle: 'Deze galerij is met een wachtwoord beveiligd.',
    siteSubtitle: 'Deze site is met een wachtwoord beveiligd.',
    placeholder: 'Voer het wachtwoord in',
    submit: 'Binnenkomen',
    verifying: 'Controleren…',
    incorrect: 'Onjuist wachtwoord. Probeer het opnieuw.',
    failed: 'Het wachtwoord kon niet worden gecontroleerd. Probeer het later opnieuw.',
  },

  about: {
    kicker: 'Over mij',
    title: 'Over mij',
    metaTitle: (name: string) => `Over mij — ${name}`,
    portraitAlt: 'Portret',
    gear: 'Uitrusting',
  },

  map: {
    title: 'Kaart',
    kicker: 'Waar',
    subtitle: 'Waar de foto’s zijn gemaakt',
    loading: 'Kaart laden…',
    loadFailed: (status: number) => `Kaartgegevens konden niet worden geladen (${status})`,
    initFailed: 'De kaart kon niet worden gestart',
  },

  subpage: {
    collectionKicker: (index: string) => `${index} — Collectie`,
    sectionsNav: 'Onderdelen',
    coverAria: (albumName: string, count: string) => `${albumName}, ${count}`,
    nextSubpage: 'Volgende',
    nextSubpageAria: (name: string) => `Volgende: ${name}`,
  },

  journal: {
    title: 'Journal',
    kicker: 'Verhalen & essays',
    subtitle: 'Fotoessays, beeldverhalen en veldnotities.',
    description: 'Fotoessays, reisverhalen en een kijkje achter de schermen.',
    entryDescription: 'Journalverhaal',
    empty: 'Er zijn nog geen verhalen gepubliceerd.',
    readStory: 'Lees het verhaal →',
    minRead: (n: number) => `${n} min lezen`,
    draft: 'Concept',
    by: (author: string) => `door ${author}`,
    notFound: 'Niet gevonden',
  },

  lightbox: {
    viewer: 'Fotoviewer',
    openPhoto: (n: number) => `Foto ${n} bekijken`,
    close: 'Sluiten',
    closeTitle: 'Sluiten (Esc)',
    previous: 'Vorige foto',
    previousTitle: 'Vorige foto (pijl naar links)',
    next: 'Volgende foto',
    nextTitle: 'Volgende foto (pijl naar rechts)',
    toggleInfo: 'Foto-info tonen/verbergen',
    toggleInfoTitle: 'Foto-info tonen/verbergen (i)',
    hideInfo: 'Info verbergen',
    info: 'Info',
    loading: 'Laden…',
    camera: 'Camera',
    lens: 'Objectief',
    focalLength: 'Brandpuntsafstand',
    aperture: 'Diafragma',
    shutter: 'Sluitertijd',
    iso: 'ISO',
    location: 'Locatie',
    noExif: 'Geen EXIF-gegevens beschikbaar',
    copyLink: 'Link naar deze foto kopiëren',
    copyLinkTitle: 'Link naar deze foto kopiëren (c)',
    copyLinkShort: 'Link',
    copied: 'Gekopieerd',
    copyManual: 'Kopieer deze link',
    shortcuts: 'Sneltoetsen',
    shortcutNavigate: 'Vorige / volgende foto',
    shortcutInfo: 'Foto-info',
    shortcutFullscreen: 'Volledig scherm',
    shortcutExitFullscreen: 'Volledig scherm verlaten',
    download: 'Het originele bestand downloaden',
    downloadTitle: 'Het originele bestand downloaden (d)',
    downloadShort: 'Origineel',
    shortcutDownload: 'Het origineel downloaden',
    shortcutSlideshow: 'Diavoorstelling',
    shortcutSlideshowRunning: (seconds: number) => `Diavoorstelling — elke ${seconds} s`,
    slideshowStopped: 'Diavoorstelling gestopt',
    slideshowRunning: (seconds: number) =>
      `Diavoorstelling loopt, elke ${seconds} seconden de volgende foto`,
    shortcutCopyLink: 'Link naar deze foto kopiëren',
    shortcutList: 'Deze lijst',
    shortcutClose: 'De viewer sluiten',
  },

  proofing: {
    addFavorite: 'Favoriet maken',
    removeFavorite: 'Favoriet verwijderen',
    addToFavorites: 'Aan favorieten toevoegen',
    removeFromFavorites: 'Uit favorieten verwijderen',
    saved: 'Opgeslagen',
    favorite: 'Favoriet',
    showAll: 'Alles tonen',
    selected: (n: number) => `❤️ ${n} geselecteerd`,
    shareExport: 'Delen & exporteren',
    modalTitle: (n: number) => `❤️ Selectie (${n})`,
    closeModal: 'Venster sluiten',
    intro: (n: number) =>
      `Je hebt ${plural(n, 'foto', 'foto’s')} geselecteerd. Kies hieronder een exportoptie om je selectie te delen:`,
    copyLink: 'Deellink kopiëren',
    linkCopied: 'Link gekopieerd!',
    copyList: 'Tekstlijst kopiëren (#1, #2…)',
    listCopied: 'Lijst gekopieerd!',
    copyManualLink: 'Kopieer deze link',
    copyManualList: 'Kopieer deze lijst',
    sendEmail: '✉️ E-mail naar de fotograaf sturen',
    downloadSelected: 'Selectie downloaden (.zip)',
    clearSelection: 'Selectie wissen',
    confirmClear: 'Alle geselecteerde favorieten wissen?',
    listEmpty: (albumName: string) => `${albumName}: geen foto’s geselecteerd.`,
    listSummary: (albumName: string, count: number, indices: string) =>
      `${albumName} — Geselecteerde foto’s (${count}): ${indices}`,
    mailSubject: (n: number) => `Fotoselectie (${n})`,
    mailBody: (list: string, url: string) =>
      `Hallo,\n\nHier is mijn fotoselectie:\n\n${list}\n\nDeellink: ${url}\n\nMet vriendelijke groet,`,
  },

  proofSession: {
    greeting: (name: string) => `Selectie voor ${name}`,
    intro:
      'Tik op het hartje bij de foto’s die je wilt. Je selectie wordt meteen opgeslagen — je kunt met deze link altijd terugkomen.',
    saving: 'Opslaan…',
    saved: 'Selectie opgeslagen',
    saveFailed:
      'Je selectie kon niet worden opgeslagen. Controleer je verbinding en probeer het opnieuw.',
    review: 'Bekijken & versturen',
    modalTitle: (n: number) => `Jouw selectie (${n})`,
    empty: 'Nog geen foto’s geselecteerd.',
    submit: 'Selectie versturen',
    submitting: 'Versturen…',
    confirmSubmit: (n: number) =>
      `${plural(n, 'foto', 'foto’s')} versturen? Daarna kun je de selectie niet meer wijzigen.`,
    submitted: 'Bedankt — je selectie is verstuurd.',
    locked: 'Deze selectie is verstuurd en kan niet meer worden gewijzigd.',
    validUntil: (date: string) => `Deze link is geldig tot ${date}.`,
    expiredTitle: 'Deze link is verlopen',
    expiredText: 'Vraag je fotograaf om een nieuwe link.',
    downloadSelection: 'Selectie downloaden (.zip)',
    downloadAll: 'Alle foto’s downloaden (.zip)',
    downloadsLeft: (n: number) => `Nog ${plural(n, 'download', 'downloads')}`,
  },

  legal: {
    navLabel: 'Colofon',
    title: 'Colofon',
    subtitle: 'Gegevens volgens § 5 TMG',
    address: 'Adres',
    contact: 'Contact',
    email: 'E-mail',
    phone: 'Telefoon',
    taxSection: 'Fiscale gegevens',
    taxId: 'Fiscaal nummer',
    vatId: 'Btw-nummer',
    extraInfo: 'Aanvullende informatie',
    source: 'Bron: gemaakt met de Impressum-generator van eRecht24.',
  },
};
