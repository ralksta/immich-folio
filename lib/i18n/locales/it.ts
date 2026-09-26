/**
 * Italian dictionary.
 *
 * Typed as `Dictionary` (derived from `en.ts`), so a key added to English but
 * forgotten here fails the type-check rather than falling through to English
 * at runtime.
 */

import type { Dictionary } from '../index';

const plural = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`;

export const it: Dictionary = {
  dateLocale: 'it-IT',

  nav: {
    home: 'Home',
    about: 'Chi sono',
    map: 'Mappa',
    journal: 'Diario',
    skipToContent: 'Vai al contenuto',
    openMenu: 'Apri menu',
    closeMenu: 'Chiudi menu',
  },

  common: {
    backTo: (label: string) => `Torna a ${label}`,
    backToGallery: 'Torna alla galleria',
    backToJournal: 'Torna al diario',
    email: 'E-mail',
    website: 'Sito web',
    home: 'Home',
    // Italian "foto" and "album" are invariable — the article carries the plural.
    photos: (n: number) => `${n} foto`,
    albums: (n: number) => `${n} album`,
    collections: (n: number) => plural(n, 'collezione', 'collezioni'),
    prevAlbum: 'Album precedente',
    nextAlbum: 'Album successivo',
    prevAlbumAria: (name: string) => `Album precedente: ${name}`,
    nextAlbumAria: (name: string) => `Album successivo: ${name}`,
    albumNavAria: 'Navigazione tra gli album',
    prevEntry: 'Articolo precedente',
    nextEntry: 'Articolo successivo',
    prevEntryAria: (title: string) => `Articolo precedente: ${title}`,
    nextEntryAria: (title: string) => `Articolo successivo: ${title}`,
    entryNavAria: 'Navigazione tra gli articoli del diario',
    loadingGallery: 'Caricamento della galleria',
    loadingPhotos: 'Caricamento delle foto',
    downloadAlbum: 'Scarica album',
  },

  home: {
    enter: 'Entra',
  },

  error: {
    notFoundTitle: 'Pagina non trovata',
    notFoundText: 'Questa pagina non esiste, oppure l’album non è più pubblicato.',
    errorTitle: 'Qualcosa è andato storto',
    errorText:
      'Non è stato possibile caricare questa pagina. Di solito è temporaneo: riprova tra un momento.',
    siteErrorText:
      'Non è stato possibile caricare questo sito. Di solito è temporaneo: riprova tra un momento.',
    tryAgain: 'Riprova',
    reference: (digest: string) => `Riferimento: ${digest}`,
  },

  download: {
    unavailableTitle: 'Download non disponibile',
    notAvailable: 'Questo download non è disponibile.',
    rateLimited: 'Troppe richieste di download. Attendi un momento e riprova.',
    immichUnavailable: 'La libreria fotografica non è al momento disponibile. Riprova a breve.',
    back: 'Torna alla galleria',
  },

  theme: {
    switchToLight: 'Passa alla modalità chiara',
    switchToDark: 'Passa alla modalità scura',
    scrollToTop: 'Torna su',
  },

  password: {
    subtitle: 'Questa galleria è protetta da password.',
    siteSubtitle: 'Questo sito è protetto da password.',
    placeholder: 'Inserisci la password',
    submit: 'Entra',
    verifying: 'Verifica in corso…',
    incorrect: 'Password errata. Riprova.',
    failed: 'Impossibile verificare la password. Riprova più tardi.',
  },

  about: {
    kicker: 'Chi sono',
    title: 'Chi sono',
    metaTitle: (name: string) => `Chi sono — ${name}`,
    portraitAlt: 'Ritratto',
    gear: 'Attrezzatura',
  },

  map: {
    title: 'Mappa',
    kicker: 'Dove',
    subtitle: 'Dove sono state scattate le foto',
    loading: 'Caricamento della mappa…',
    loadFailed: (status: number) => `Impossibile caricare i dati della mappa (${status})`,
    initFailed: 'Impossibile inizializzare la mappa',
  },

  subpage: {
    collectionKicker: (index: string) => `${index} — Collezione`,
    sectionsNav: 'Sezioni',
    coverAria: (albumName: string, count: string) => `${albumName}, ${count}`,
    nextSubpage: 'Avanti',
    nextSubpageAria: (name: string) => `Avanti: ${name}`,
  },

  journal: {
    title: 'Diario',
    kicker: 'Storie e saggi',
    subtitle: 'Saggi fotografici, racconti visivi e appunti sul campo.',
    description: 'Saggi fotografici, racconti di viaggio e diari dietro le quinte.',
    entryDescription: 'Articolo del diario',
    empty: 'Nessun articolo pubblicato per ora.',
    readStory: 'Leggi la storia →',
    minRead: (n: number) => `${n} min di lettura`,
    draft: 'Bozza',
    by: (author: string) => `di ${author}`,
    notFound: 'Non trovato',
  },

  lightbox: {
    viewer: 'Visualizzatore di immagini',
    openPhoto: (n: number) => `Apri la foto ${n}`,
    close: 'Chiudi',
    closeTitle: 'Chiudi (Esc)',
    previous: 'Foto precedente',
    previousTitle: 'Foto precedente (freccia sinistra)',
    next: 'Foto successiva',
    nextTitle: 'Foto successiva (freccia destra)',
    toggleInfo: 'Mostra/nascondi informazioni',
    toggleInfoTitle: 'Mostra/nascondi informazioni (i)',
    hideInfo: 'Nascondi info',
    info: 'Info',
    loading: 'Caricamento…',
    camera: 'Fotocamera',
    lens: 'Obiettivo',
    focalLength: 'Lunghezza focale',
    aperture: 'Diaframma',
    shutter: 'Tempo di scatto',
    iso: 'ISO',
    location: 'Luogo',
    noExif: 'Nessun dato EXIF disponibile',
    copyLink: 'Copia il link a questa foto',
    copyLinkTitle: 'Copia il link a questa foto (c)',
    copyLinkShort: 'Link',
    copied: 'Copiato',
    copyManual: 'Copia questo link',
    shortcuts: 'Scorciatoie da tastiera',
    shortcutNavigate: 'Foto precedente / successiva',
    shortcutInfo: 'Informazioni sulla foto',
    shortcutFullscreen: 'Schermo intero',
    shortcutExitFullscreen: 'Esci da schermo intero',
    download: 'Scarica il file originale',
    downloadTitle: 'Scarica il file originale (d)',
    downloadShort: 'Originale',
    shortcutDownload: 'Scarica l’originale',
    shortcutSlideshow: 'Presentazione',
    shortcutSlideshowRunning: (seconds: number) => `Presentazione — ogni ${seconds} s`,
    slideshowStopped: 'Presentazione interrotta',
    slideshowRunning: (seconds: number) => `Presentazione in corso, avanza ogni ${seconds} secondi`,
    shortcutCopyLink: 'Copia il link a questa foto',
    shortcutList: 'Questo elenco',
    shortcutClose: 'Chiudi il visualizzatore',
  },

  proofing: {
    addFavorite: 'Aggiungi ai preferiti',
    removeFavorite: 'Rimuovi dai preferiti',
    addToFavorites: 'Aggiungi ai preferiti',
    removeFromFavorites: 'Rimuovi dai preferiti',
    saved: 'Salvato',
    favorite: 'Preferito',
    showAll: 'Mostra tutto',
    selected: (n: number) => `❤️ ${n} ${n === 1 ? 'selezionata' : 'selezionate'}`,
    shareExport: 'Condividi ed esporta',
    modalTitle: (n: number) => `❤️ Selezione (${n})`,
    closeModal: 'Chiudi finestra',
    intro: (n: number) =>
      `Hai selezionato ${n} foto. Scegli un’opzione di esportazione per condividere la tua selezione:`,
    copyLink: 'Copia link di condivisione',
    linkCopied: 'Link copiato!',
    copyList: 'Copia elenco testuale (#1, #2…)',
    listCopied: 'Elenco copiato!',
    copyManualLink: 'Copia questo link',
    copyManualList: 'Copia questo elenco',
    sendEmail: '✉️ Invia e-mail al fotografo',
    downloadSelected: 'Scarica selezione (.zip)',
    clearSelection: 'Svuota selezione',
    confirmClear: 'Rimuovere tutti i preferiti selezionati?',
    listEmpty: (albumName: string) => `${albumName}: nessuna foto selezionata.`,
    listSummary: (albumName: string, count: number, indices: string) =>
      `${albumName} — Foto selezionate (${count}): ${indices}`,
    mailSubject: (n: number) => `Selezione di foto (${n})`,
    mailBody: (list: string, url: string) =>
      `Ciao,\n\necco la mia selezione di foto:\n\n${list}\n\nLink di condivisione: ${url}\n\nCordiali saluti,`,
  },

  legal: {
    navLabel: 'Note legali',
    title: 'Note legali',
    subtitle: 'Informazioni ai sensi del § 5 DDG',
    address: 'Indirizzo',
    contact: 'Contatti',
    email: 'E-mail',
    phone: 'Telefono',
    contactForm: 'Modulo di contatto',
    taxSection: 'Informazioni fiscali',
    taxId: 'Codice fiscale',
    vatId: 'Partita IVA',
    extraInfo: 'Ulteriori informazioni',
  },
};
