/**
 * German dictionary.
 *
 * Typed as `Dictionary` (derived from `en.ts`), so a key added to English but
 * forgotten here fails the type-check rather than falling through to English
 * at runtime.
 */

import type { Dictionary } from '../index';

const plural = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`;

export const de: Dictionary = {
  dateLocale: 'de-DE',

  nav: {
    home: 'Start',
    about: 'Über mich',
    map: 'Karte',
    journal: 'Journal',
    skipToContent: 'Zum Inhalt springen',
  },

  common: {
    backTo: (label: string) => `Zurück zu ${label}`,
    backToGallery: 'Zurück zur Galerie',
    backToJournal: 'Zurück zum Journal',
    home: 'Start',
    photos: (n: number) => plural(n, 'Foto', 'Fotos'),
    albums: (n: number) => plural(n, 'Album', 'Alben'),
    collections: (n: number) => plural(n, 'Sammlung', 'Sammlungen'),
    loadingGallery: 'Galerie wird geladen',
    loadingPhotos: 'Fotos werden geladen',
  },

  home: {
    enter: 'Eintreten',
  },

  error: {
    notFoundTitle: 'Nicht gefunden',
    notFoundText: 'Diese Seite existiert nicht, oder das Album ist nicht mehr veröffentlicht.',
    errorTitle: 'Etwas ist schiefgelaufen',
    errorText:
      'Diese Seite konnte gerade nicht geladen werden. Das ist meist vorübergehend — bitte gleich noch einmal versuchen.',
    siteErrorText:
      'Diese Website konnte gerade nicht geladen werden. Das ist meist vorübergehend — bitte gleich noch einmal versuchen.',
    tryAgain: 'Erneut versuchen',
    reference: (digest: string) => `Referenz: ${digest}`,
  },

  theme: {
    switchToLight: 'Zum hellen Modus wechseln',
    switchToDark: 'Zum dunklen Modus wechseln',
    scrollToTop: 'Nach oben',
  },

  password: {
    subtitle: 'Diese Galerie ist passwortgeschützt.',
    siteSubtitle: 'Diese Website ist passwortgeschützt.',
    placeholder: 'Passwort eingeben',
    submit: 'Öffnen',
    verifying: 'Wird geprüft…',
    incorrect: 'Falsches Passwort. Bitte erneut versuchen.',
    failed: 'Passwort konnte nicht geprüft werden. Bitte später erneut versuchen.',
  },

  about: {
    kicker: 'Über mich',
    title: 'Über mich',
    metaTitle: (name: string) => `Über mich — ${name}`,
    portraitAlt: 'Porträt',
    gear: 'Ausrüstung',
  },

  map: {
    title: 'Karte',
    kicker: 'Wo',
    subtitle: 'Wo die Fotos entstanden sind',
    loading: 'Karte wird geladen…',
    loadFailed: (status: number) => `Kartendaten konnten nicht geladen werden (${status})`,
    initFailed: 'Karte konnte nicht initialisiert werden',
  },

  subpage: {
    collectionKicker: (index: string) => `${index} — Sammlung`,
    sectionsNav: 'Abschnitte',
    coverAria: (albumName: string, count: string) => `${albumName}, ${count}`,
  },

  journal: {
    title: 'Journal',
    kicker: 'Geschichten & Essays',
    subtitle: 'Fotoessays, visuelle Geschichten und Notizen von unterwegs.',
    description: 'Fotoessays, Reisegeschichten und Journale hinter den Kulissen.',
    entryDescription: 'Journal-Eintrag',
    empty: 'Noch keine Journal-Einträge veröffentlicht.',
    readStory: 'Geschichte lesen →',
    minRead: (n: number) => `${n} Min. Lesezeit`,
    draft: 'Entwurf',
    by: (author: string) => `von ${author}`,
    notFound: 'Nicht gefunden',
  },

  lightbox: {
    viewer: 'Bildansicht',
    close: 'Schließen',
    closeTitle: 'Schließen (Esc)',
    previous: 'Vorheriges Foto',
    previousTitle: 'Vorheriges Foto (Pfeil links)',
    next: 'Nächstes Foto',
    nextTitle: 'Nächstes Foto (Pfeil rechts)',
    toggleInfo: 'Fotoinfos ein-/ausblenden',
    toggleInfoTitle: 'Fotoinfos ein-/ausblenden (i)',
    hideInfo: 'Infos ausblenden',
    info: 'Infos',
    loading: 'Wird geladen...',
    camera: 'Kamera',
    lens: 'Objektiv',
    focalLength: 'Brennweite',
    aperture: 'Blende',
    shutter: 'Belichtungszeit',
    iso: 'ISO',
    location: 'Ort',
    noExif: 'Keine EXIF-Daten vorhanden',
    shortcuts: 'Tastaturkürzel',
    shortcutNavigate: 'Vorheriges / nächstes Foto',
    shortcutInfo: 'Fotoinfos',
    shortcutFullscreen: 'Vollbild',
    shortcutExitFullscreen: 'Vollbild verlassen',
    shortcutList: 'Diese Liste',
    shortcutClose: 'Ansicht schließen',
  },

  proofing: {
    addFavorite: 'Zur Auswahl hinzufügen',
    removeFavorite: 'Aus Auswahl entfernen',
    addToFavorites: 'Zur Auswahl hinzufügen',
    removeFromFavorites: 'Aus Auswahl entfernen',
    saved: 'Gemerkt',
    favorite: 'Merken',
    showAll: 'Alle anzeigen',
    selected: (n: number) => `❤️ ${n} ausgewählt`,
    shareExport: 'Teilen & Export',
    modalTitle: (n: number) => `❤️ Auswahl (${n})`,
    closeModal: 'Dialog schließen',
    intro: (n: number) =>
      `Du hast ${plural(n, 'Foto', 'Fotos')} ausgewählt. Wähle unten eine Export-Option, um deine Auswahl zu teilen:`,
    copyLink: 'Teilbaren Link kopieren',
    linkCopied: 'Link kopiert!',
    copyList: 'Textliste kopieren (#1, #2...)',
    listCopied: 'Liste kopiert!',
    sendEmail: '✉️ E-Mail an den Fotografen',
    clearSelection: 'Auswahl löschen',
    confirmClear: 'Die gesamte Auswahl löschen?',
    listEmpty: (albumName: string) => `${albumName}: Keine Fotos ausgewählt.`,
    listSummary: (albumName: string, count: number, indices: string) =>
      `${albumName} — Ausgewählte Fotos (${count}): ${indices}`,
    mailSubject: (n: number) => `Fotoauswahl (${n} Fotos)`,
    mailBody: (list: string, url: string) =>
      `Hallo,\n\nhier ist meine Fotoauswahl:\n\n${list}\n\nLink zur Auswahl: ${url}\n\nViele Grüße,`,
  },

  legal: {
    navLabel: 'Impressum',
    title: 'Impressum',
    subtitle: 'Angaben gemäß § 5 TMG',
    address: 'Anschrift',
    contact: 'Kontakt',
    email: 'E-Mail',
    phone: 'Telefon',
    taxSection: 'Steuernummer',
    taxId: 'Steuernummer',
    vatId: 'Umsatzsteuer-ID',
    extraInfo: 'Weitere Informationen',
    source: 'Quelle: Erstellt mit dem Impressum-Generator von eRecht24.',
  },
};
