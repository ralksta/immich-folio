import type { AdminDictionary } from '../index';

/**
 * The journal studio: the entry list, the create dialog, the block editor
 * (also used for content pages), its settings and the live preview.
 */
export const journal: AdminDictionary['journal'] = {
  studio: {
    /** The page header's kicker. */
    kicker: 'Inhalt',
    title: 'Journal',
    description:
      'Geschichten, Notizen von unterwegs und lange Fotoessays, geschrieben mit Live-Vorschau.',
    newEntry: 'Neuer Journal-Eintrag',
    emptyTitle: 'Noch keine Journal-Einträge',
    emptyText:
      'Schreib deine erste Geschichte, etwa ein Reisetagebuch oder eine Hochzeitsreportage.',
    createFirst: 'Ersten Eintrag erstellen',
    /** Reading time on an entry card. */
    readingTime: (minutes: number) => `${minutes} Min.`,
    draft: 'Entwurf',
    published: 'Veröffentlicht',
    /** Shown on a card when the entry has a password. */
    password: 'Passwort',
    editInStudio: 'Im Studio bearbeiten',
    viewLive: 'Live-Seite ansehen',
    /** The delete button's tooltip and the confirm dialog's button. */
    deleteEntry: 'Eintrag löschen',
    deleteTitle: (name: string) => `„${name}“ löschen?`,
    deleteMessage: 'Eine Kopie bleibt erhalten und lässt sich unter Backups wiederherstellen.',
    deleteFailed: 'Der Journal-Eintrag konnte nicht gelöscht werden',
    deleteError:
      'Der Journal-Eintrag konnte nicht gelöscht werden. Prüfe die Verbindung und versuche es erneut.',
    createFailed: 'Der Journal-Eintrag konnte nicht erstellt werden',
    createError:
      'Der Journal-Eintrag konnte nicht erstellt werden. Prüfe die Verbindung und versuche es erneut.',
    albumsError:
      'Die Alben konnten nicht geladen werden. Prüfe die Verbindung zu Immich und versuche es erneut.',

    create: {
      title: 'Neuen Journal-Eintrag erstellen',
      titleLabel: 'Titel',
      titlePlaceholder: 'z. B. Expedition Nordkap',
      slugLabel: 'URL-Slug',
      slugPlaceholder: 'z. B. expedition-nordkap',
      /** `slug` is the entry's slug, or `slugFallback` while it is empty. */
      slugHint: (slug: string) => `Erreichbar unter /journal/${slug}`,
      slugFallback: 'slug',
      startFrom: 'Beginnen mit',
      startFromLabel: 'Ausgangspunkt des Eintrags',
      tabTemplates: 'Vorlagen',
      tabAlbums: 'Alben',
      blank: 'Leer',
      blankDescription: 'Mit einem leeren Editor beginnen.',
      loadingAlbums: 'Alben werden geladen...',
      changeAlbum: 'Album wechseln',
      selectAlbum: 'Album wählen',
      choosePhotos: 'Fotos wählen',
      choosePhotosSelected: (n: number) => `Fotos wählen (${n} ausgewählt)`,
      selectedPhotos: 'Ausgewählte Fotos',
      albumNote: 'Nur die Fotos, die du aus diesem Album auswählst, kommen in den Eintrag.',
      pickerTitle: 'Fotos aus diesem Album wählen',
      creating: 'Wird erstellt...',
      submit: 'Erstellen & Studio öffnen',
    },
  },

  /**
   * The names and descriptions of the starting templates, by template id
   * (`lib/journalTemplates.ts`). The blocks a template inserts stay as written.
   */
  templates: {
    wedding: {
      name: 'Hochzeit',
      description:
        'Datum und Ort vorweg, ein Hero-Bild, eine Zeile aus dem Eheversprechen, die Feier als Raster.',
    },
    hiking: {
      name: 'Wandern / Outdoor',
      description:
        'Strecke und Höhenmeter als Fakten, der Weg als Raster, die Route auf einer Karte.',
    },
    travel: {
      name: 'Reise',
      description: 'Die Reise auf einer Karte, dann ein Abschnitt pro Station mit je zwei Fotos.',
    },
    birthday: {
      name: 'Geburtstag / Familie',
      description: 'Kaum Text — das ganze Album als Raster und ein randloses Bild.',
    },
    'portrait-session': {
      name: 'Porträt-Shooting',
      description: 'Einzelne breite Bilder mit viel Luft und ein Satz in eigenen Worten.',
    },
    'behind-the-scenes': {
      name: 'Hinter den Kulissen',
      description: 'Aufbau und Shooting als Paar, dann zum Schluss das fertige Ergebnis.',
    },
    pets: {
      name: 'Haustiere',
      description: 'Ungestellte Paare, ein Porträt aus der Nähe mit Charakter.',
    },
    'new-series': {
      name: 'Neue Serie',
      description: 'Beginnt mit einer Aussage, dann stellen Foto-Text-Paare das Projekt vor.',
    },
  },

  /** The editor of one entry, also used for content pages. */
  editor: {
    sessionExpired: 'Deine Sitzung ist abgelaufen. Melde dich erneut an, um fortzufahren.',
    serverAnswered: (status: number) => `Der Server antwortete mit ${status}.`,
    loadFailedFallback: 'Der Eintrag konnte nicht geladen werden.',
    conflictKept: 'Nicht gespeichert — er wurde anderswo geändert. Deine Änderungen sind noch da.',
    saveFailed: 'Speichern fehlgeschlagen',
    saveErrorEntry:
      'Der Eintrag konnte nicht gespeichert werden. Prüfe die Verbindung und versuche es erneut.',
    saveErrorPage:
      'Die Seite konnte nicht gespeichert werden. Prüfe die Verbindung und versuche es erneut.',
    openingEntry: 'Journal-Studio wird geöffnet...',
    openingPage: 'Seiteneditor wird geöffnet...',
    loadFailedEntry: 'Dieser Eintrag konnte nicht geladen werden.',
    loadFailedPage: 'Diese Seite konnte nicht geladen werden.',
    albumListFailed: (error: string) => `Albumliste: ${error}`,
    loadFailedNote:
      'Es wurde nichts geändert. Speichern bleibt gesperrt, bis geladen ist, damit ein leerer Editor nichts überschreibt.',
    backToEntries: 'Zurück zu den Einträgen',
    backToPages: 'Zurück zu den Seiten',
    /** The top bar's back button. */
    allEntries: '← Alle Einträge',
    pages: '← Seiten',
    storyTitlePlaceholder: 'Titel der Geschichte...',
    storyTitleLabel: 'Titel der Geschichte',
    pageTitlePlaceholder: 'Seitentitel...',
    pageTitleLabel: 'Seitentitel',
    modeLabel: 'Editormodus',
    modeBlocks: 'Visuelle Blöcke',
    modeMarkdown: 'Markdown-Rohtext',
    storySettings: 'Eintrag-Einstellungen',
    pageSettings: 'Seiteneinstellungen',
    publish: 'Veröffentlichen',
    unpublish: 'Zurückziehen',
    publishTitle: 'Seite veröffentlichen und sofort speichern',
    unpublishTitle: 'Seite wieder zum Entwurf machen und sofort speichern',
    /** Link to the published page. */
    live: 'Live',
    saving: 'Wird gespeichert...',
    saveChanges: 'Änderungen speichern',
    saved: 'Gespeichert',
    markdownPlaceholder: 'Markdown hier schreiben...',
    addBlock: 'Block hinzufügen:',
    addText: '+ Text',
    addHeading: '+ Überschrift',
    addQuote: '+ Zitat',
    addFacts: '+ Fakten',
    addPhoto: '+ Foto',
    addPhotos: '+ Fotos',
    addPair: '+ Fotopaar',
    addGrid: '+ Fotoraster',
    addAlbum: '+ Album',
    addMap: '+ Karte',
    moveUp: 'Block nach oben',
    moveDown: 'Block nach unten',
    deleteBlock: 'Block löschen',
    resize: 'Größe von Editor und Vorschau ändern',
  },

  /** Titles of the photo picker, by what it is opened for. */
  pickerTitles: {
    storyPhoto: 'Foto für die Geschichte wählen',
    photos: 'Fotos hinzufügen (je ein Block)',
    pair: 'Fotos für das Paar wählen',
    pairPhoto: (n: number) => `Foto Nr. ${n} für das Paar wählen`,
    grid: 'Fotos für das Raster wählen',
    gridPhoto: (n: number) => `Foto Nr. ${n} für das Raster wählen`,
    mapPhoto: 'Foto für die Karte wählen',
    cover: 'Titelbild wählen',
  },

  /**
   * The text a new block starts with. It is written into the entry, so it is
   * in the panel's language at the time the block is added.
   */
  blockDefaults: {
    heading: 'Neue Überschrift',
    paragraph: 'Absatztext hier eingeben...',
    quote: 'Zitat eingeben...',
  },

  /** The fields of each block type. */
  blocks: {
    headingLevel: 'Überschriftenebene',
    text: 'Text',
    /** Keep the Markdown markers (`**`, `*`, `[…](…)`) as they are. */
    textPlaceholder: 'Text (**fett**, *kursiv*, [Link](https://…))',
    quotePlaceholder: 'Zitattext...',
    authorPlaceholder: 'Quelle des Zitats (optional)',
    legacyRef: (ref: string) =>
      `Die Referenz „${ref}“ ist eine veraltete Albumposition, kein Foto. Sie erscheint nicht auf der veröffentlichten Seite — wähle unten ein Foto.`,
    legacyRefs: (refs: string[]) =>
      `Die Referenzen „${refs.join('“, „')}“ sind veraltete Albumpositionen, keine Fotos. Sie erscheinen nicht auf der veröffentlichten Seite — wähle unten Fotos.`,
    changePhoto: 'Foto ändern',
    pickPhoto: 'Foto wählen',
    /** An empty photo tile. */
    pick: '+ Wählen',
    photoLayout: 'Fotolayout',
    layoutContained: 'Schmal (Spaltenbreite)',
    layoutWide: 'Breit (erweiterte Breite)',
    layoutFullbleed: 'Randlos (von Rand zu Rand)',
    changePhotoButton: 'Foto ändern',
    captionPlaceholder: 'Bildunterschrift (optional)',
    changePairPhoto: (n: number) => `Foto ${n} des Paars ändern`,
    pickPairPhoto: (n: number) => `Foto ${n} des Paars wählen`,
    pickPairSlot: (n: number) => `+ Foto Nr. ${n} wählen`,
    pickBoth: 'Beide Fotos wählen',
    pairCaptionPlaceholder: 'Gemeinsame Bildunterschrift für das Paar (optional)',
    /** Alt text of a picked photo's thumbnail. */
    thumb: 'Vorschaubild',
    pickGridSlot: (n: number) => `+ Nr. ${n} wählen`,
    removePhoto: (n: number) => `Foto Nr. ${n} entfernen`,
    addPhoto: 'Foto hinzufügen',
    pickSeveral: 'Mehrere wählen',
    gridHint: 'Drei oder mehr Fotos, in Dreierreihen angeordnet.',
    gridCaptionPlaceholder: 'Gemeinsame Bildunterschrift für das Raster (optional)',
    factLabelPlaceholder: 'Bezeichnung, z. B. Strecke',
    factValuePlaceholder: 'Wert, z. B. 21 km',
    removeFact: (n: number) => `Fakt Nr. ${n} entfernen`,
    addFact: 'Fakt hinzufügen',
    changeAlbum: 'Album wechseln',
    pickAlbum: 'Album wählen',
    albumPhotoCount: (n: number) => `${n} ${n === 1 ? 'Foto' : 'Fotos'} im Album`,
    albumLoading: 'wird geladen…',
    count: 'Anzahl',
    /** Placeholder of the empty Count field: every photo. */
    countAll: 'alle',
    skip: 'Überspringen',
    layout: 'Layout',
    albumLayoutGrid: 'Raster (Dreierreihen)',
    albumLayoutPairs: 'Paare (Zweierreihen)',
    albumLayoutWide: 'Breit (eins pro Reihe)',
    albumCaptionPlaceholder: 'Bildunterschrift für die Serie (optional)',
    albumHint:
      'Die Fotos folgen der Reihenfolge des Albums (eine manuelle Reihenfolge in der Galerie hat Vorrang). Anzahl und Überspringen wählen einen Ausschnitt; lass die Anzahl leer für alle.',
    mapOff:
      'Die Karte ist unter Einstellungen → Allgemein ausgeschaltet. Dieser Block wird erst angezeigt, wenn sie eingeschaltet ist.',
    mapCaptionPlaceholder: 'Bildunterschrift, z. B. Busan → Seoul (optional)',
    pointLabelPlaceholder: 'Bezeichnung (optional)',
    /** Short placeholders of the coordinate fields. */
    lat: 'Breite',
    latitude: 'Breitengrad',
    lng: 'Länge',
    longitude: 'Längengrad',
    pickPhotoTile: '+ Foto wählen',
    allPhotosItem: 'Alle Fotos mit Geodaten aus diesem Eintrag, der Reihe nach',
    movePinUp: 'Pin nach oben',
    movePinDown: 'Pin nach unten',
    removePin: 'Pin entfernen',
    invalidCoordinates:
      'Ein Punkt braucht einen Breitengrad zwischen ±90 und einen Längengrad zwischen ±180. Punkte ohne gültige Koordinaten werden nicht gespeichert.',
    addPoint: 'Punkt',
    addPhotoPin: 'Foto-Pin',
    addAllPhotos: 'Alle Fotos mit Geodaten',
    connectLine: 'Pins mit einer Linie verbinden',
    mapHint:
      'Eingegebene Punkte erscheinen sofort in der Vorschau. Foto-Pins werden auf der Live-Seite anhand der GPS-Daten des Fotos gesetzt, mit der Ortsgenauigkeit des Albums.',
  },

  storySettings: {
    title: 'Einstellungen & Metadaten des Eintrags',
    subtitle: 'Untertitel',
    subtitlePlaceholder: 'z. B. Notizen von unserer Winterreise',
    author: 'Autor',
    authorPlaceholder: 'z. B. Ralf',
    date: 'Veröffentlichungsdatum',
    cover: 'Titelbild',
    coverAlt: 'Titelbild',
    chooseCover: 'Titelbild wählen',
    password: 'Passwortschutz (optional)',
    draft: 'Als Entwurf behalten (nicht in der öffentlichen /journal-Liste)',
    done: 'Fertig',
  },

  pageSettings: {
    title: 'Seiteneinstellungen',
    description: 'SEO-Beschreibung',
    descriptionPlaceholder: 'Ein oder zwei Sätze für Suchmaschinen und Link-Vorschauen',
    draft: 'Entwurf',
    draftDescription:
      'Einen Entwurf siehst nur du, und er bleibt aus dem Menü und der Sitemap heraus.',
    password: 'Passwort (optional)',
    passwordLabel: 'Seitenpasswort',
    note: 'Die Einstellungen werden mit der Seite gespeichert. URL und Platz im Menü legst du unter Seiten fest.',
  },

  preview: {
    label: 'Design-Vorschau in Echtzeit',
    widthLabel: 'Breite der Vorschau',
    desktop: 'Desktop',
    mobile: 'Mobil',
  },
};
