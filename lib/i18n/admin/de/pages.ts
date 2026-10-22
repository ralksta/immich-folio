import type { AdminDictionary } from '../index';

/**
 * Admin → Seiten: the page builder (home page hero, standalone albums,
 * subpages, content pages), its drawers and the photo-essay block editor.
 *
 * File names (gallery.yaml, content/pages/), CSS values and units in the
 * strings below are literal — keep them as written.
 */
export const pages: AdminDictionary['pages'] = {
  /** The page header above the builder. */
  header: {
    kicker: 'Inhalt',
    title: 'Seiten',
    description:
      'Hero der Startseite, eigenständige Alben, Unterseiten und Inhaltsseiten. Zum Umsortieren ziehen; Änderungen gehen beim Speichern live.',
  },

  builder: {
    sessionExpired: 'Deine Sitzung ist abgelaufen. Melde dich erneut an, um fortzufahren.',
    serverAnswered: (status: number) => `Der Server antwortete mit ${status}.`,
    loadFailed: 'Die Seitenstruktur konnte nicht geladen werden.',
    loadFailedNote:
      'Es wurde nichts geändert. Speichern bleibt gesperrt, bis sie geladen ist, damit ein leerer Seiteneditor deine Galerie nicht überschreibt.',
    notSavedConflict: 'Nicht gespeichert — gallery.yaml wurde anderswo geändert.',
    saved: 'Erfolgreich gespeichert!',
    /** Inserted into "Fehler: …" (common.errorWith). */
    saveFailed: 'Speichern fehlgeschlagen',
    saveChanges: 'Änderungen speichern',
    createFailed: 'Die Seite konnte nicht erstellt werden',
    createdInMenu: 'Seite als Entwurf erstellt. Mit „Änderungen speichern“ kommt sie ins Menü.',
    created: 'Seite als Entwurf erstellt.',
    createOffline:
      'Die Seite konnte nicht erstellt werden. Prüfe die Verbindung und versuche es erneut.',
    /** Toasts after a removal; each offers `undo`. */
    pageRemoved: 'Seite entfernt.',
    albumRemoved: 'Album entfernt.',
    albumRemovedFromPage: 'Album von der Seite entfernt.',
    albumRemovedFromSection: 'Album aus dem Abschnitt entfernt.',
    heroRemoved: 'Hero-Foto entfernt.',
    undo: 'Rückgängig',
    undoFailed:
      'Rückgängig nicht möglich: Die Seitenstruktur hat sich inzwischen geändert. Noch ist nichts gespeichert.',
    /**
     * What screen readers call a dragged item ("Seite „Reisen“ aufgenommen.").
     * Each label starts with a capitalised noun, as German nouns do.
     */
    drag: {
      page: (name: string) => `Seite „${name}“`,
      untitled: 'Ohne Titel',
      hero: (n: number) => `Hero-Foto ${n} der Startseite`,
      album: (name: string) => `Album „${name}“`,
      item: 'Element',
    },
    /** The structure list on the left. */
    tree: 'Seitenstruktur',
    searchLabel: 'Alben oder Unterseiten suchen',
    searchPlaceholder: 'Alben oder Unterseiten suchen...',
    clearSearch: 'Suche leeren',
    homePage: 'Startseite',
    heroPhotos: 'Hero-Fotos',
    menu: 'Menü',
    subpagesLive: (live: number, total: number) => `${live} von ${total} Unterseiten live`,
    noMatches: 'Keine passenden Einträge.',
    newSubpage: 'Neue Unterseite',
    newPage: 'Neue Seite',
    notInMenu: 'Nicht im Menü',
    offMenuEmpty:
      'Seiten, die nur über ihren Link erreichbar sind. Zieh eine Seite hierher, um sie aus dem Menü zu nehmen.',
    standaloneGroup: 'Eigenständige Alben',
    onHomePage: 'Auf der Startseite',
    /** The panel for standalone albums. */
    standaloneHeading: 'Eigenständige Alben',
    addAlbum: '+ Album hinzufügen',
    noMatchingStandalone: 'Keine passenden eigenständigen Alben gefunden.',
    noStandalone: 'Keine eigenständigen Alben. Sie erscheinen direkt auf der Startseite.',
    /** The panel for the home page hero. */
    addHero: 'Hero hinzufügen',
    heroPickerTitle: 'Hero-Bilder für die Startseite wählen',
    noHero:
      'Keine Hero-Bilder eingerichtet. Füge Fotos hinzu, um auf der Startseite ein Hero-Karussell zu zeigen.',
  },

  /** Seed values for a new subpage or section, written into gallery.yaml. */
  defaults: {
    subpageName: (n: number) => `Neue Unterseite ${n}`,
    sectionTitle: 'Neuer Abschnitt',
  },

  /** The per-album photo order (Listbox options and the card's badge tooltip). */
  sort: {
    immich: 'Immich-Reihenfolge (Standard)',
    newest: 'Neueste zuerst',
    oldest: 'Älteste zuerst',
    filename: 'Dateiname',
    manual: 'Manuell',
  },

  albumCard: {
    reorder: (name: string) => `${name} verschieben`,
    dragToReorder: 'Zum Umsortieren ziehen',
    editDetails: 'Details bearbeiten',
    removeAlbum: 'Album entfernen',
    passwordProtected: 'Passwortgeschützt',
    customHero: 'Eigenes Hero-Bild gesetzt',
    /** `label` is one of the `sort` labels. */
    photoOrder: (label: string) => `Fotoreihenfolge: ${label}`,
    photos: (n: number) => `${n} ${n === 1 ? 'Foto' : 'Fotos'}`,
  },

  albumDrawer: {
    heading: 'Albumdetails bearbeiten',
    close: 'Details schließen',
    photos: (n: number) => `${n} ${n === 1 ? 'Foto' : 'Fotos'}`,
    /** Shown after the photo count when the title is overridden. */
    original: (name: string) => `Original: ${name}`,
    titleOverride: 'Abweichender Titel',
    description: 'Beschreibung',
    descriptionPlaceholder: 'Optionale Beschreibung für Besucher',
    passwordProtection: 'Passwortschutz',
    albumPassword: 'Album-Passwort',
    downloads: 'Downloads',
    allowDownloads: 'Download der Originale erlauben',
    allowDownloadsDesc:
      'Besucher können das ganze Album oder ihre ausgewählten Fotos als ZIP herunterladen',
    zoomInherit: 'Von Seite / Website-Einstellungen übernehmen',
    zoomHint:
      'Besucher können in der Bildansicht in ein Foto zoomen, um die Schärfe zu prüfen. JPEG- und AVIF-Originale werden ohne ihre GPS-Daten gezeigt; HEIC und RAW brauchen die Vorschauen in voller Größe von Immich. PNG, WebP, GIF und in Immich bearbeitete Fotos werden nie gezoomt. Gilt dort, wo das Album hier aufgeführt ist.',
    layoutOverride: 'Abweichendes Layout (experimentell)',
    layoutOverrideAria: 'Abweichendes Layout',
    layoutInherit: 'Von Seite / globalen Einstellungen übernehmen',
    layouts: {
      masonry: 'Masonry',
      uniform: 'Gleichmäßiges Raster',
      showcase: 'Showcase',
      filmstrip: 'Filmstreifen',
      editorialFlow: 'Editorial Flow',
      justified: 'Blocksatz (experimentell)',
    },
    coverFocalPoint: 'Fokuspunkt des Covers (experimentell)',
    /** "50% 25%" and "top" are CSS values; keep them as written. */
    coverFocalPointPlaceholder:
      'z. B. "50% 25%" oder "top" — woran sich der Zuschnitt des Covers ausrichtet',
    customHero: 'Eigenes Hero-Bild',
    heroAlt: 'Hero',
    removeHero: 'Eigenes Hero-Bild entfernen',
    defaultCover: 'Standard-Albumcover wird verwendet',
    pickHeroTitle: (name: string) => `Hero-Bild für ${name} wählen`,
    changeImage: 'Bild ändern',
    pickHero: 'Hero-Bild wählen',
    photoOrder: 'Fotoreihenfolge',
    manualHint:
      'Angeheftete Fotos kommen zuerst, in der von dir festgelegten Reihenfolge. Alle anderen folgen in der Immich-Reihenfolge des Albums.',
    immichHint: 'Die Immich-Reihenfolge folgt der Sortierung, die das Album in Immich hat.',
    reorderPhotos: 'Fotos umsortieren',
    reorderPhotosPinned: (n: number) => `Fotos umsortieren (${n} angeheftet)`,
    removeAlbum: 'Album entfernen',
    uuidTitle: 'Immich-Album-UUID',
    copyUuid: 'UUID kopieren',
    copyUuidAria: 'Immich-Album-UUID kopieren',
    done: 'Fertig',
  },

  subpageDrawer: {
    breadcrumb: 'Seiten / Unterseiten',
    untitled: 'Seite ohne Titel',
    /** Accessible name of the Edit / Live Preview switch. */
    view: 'Ansicht',
    livePreview: 'Live-Vorschau',
    openLive: 'Live-Seite in neuem Tab öffnen (ohne Cache)',
    close: 'Bereich schließen',
    pageName: 'Seitenname (URL-Kennung)',
    pageNamePlaceholder: 'z. B. dubai, reisen, hochzeiten',
    displayTitle: 'Angezeigter Titel (optional)',
    /** Sits in a half-width field; keep it short. */
    displayTitlePlaceholder: 'Wie Seitenname',
    subtitle: 'Untertitel',
    subtitlePlaceholder: 'Text des Untertitels',
    visibility: 'Sichtbarkeit & Zugriff',
    visibilityOptions: {
      published: {
        title: 'Veröffentlicht',
        desc: 'Im Header-Menü und in den Listen der Startseite, über die URL erreichbar',
      },
      unlisted: {
        title: 'Ungelistet (experimentell)',
        desc: 'Nicht in Menüs oder auf der Startseite, aber über den direkten Link erreichbar',
      },
      disabled: {
        title: 'Deaktiviert',
        desc: 'Komplett offline — liefert 404, auch beim direkten Aufruf',
      },
    },
    passwordPlaceholder: 'Passwortschutz (optional) — leer lassen für öffentlichen Zugriff',
    pagePassword: 'Seitenpasswort',
    layoutStyle: 'Layout der Seite',
    layoutStyleAria: 'Layout der Seite',
    /** Options of a <select>: plain text only. */
    layouts: {
      masonry: 'Masonry-Raster (dynamische Höhe)',
      uniform: 'Gleichmäßiges Raster (quadratische Kacheln)',
      showcase: 'Showcase (erstes Foto hervorgehoben)',
      filmstrip: 'Filmstreifen (horizontal scrollen)',
      editorialFlow: 'Editorial Flow',
      essay: 'Fotoessay-Modus (Storytelling-Editor)',
    },
    zoomInherit: 'Von den Website-Einstellungen übernehmen',
    zoomHint:
      'Gilt für jedes Album dieser Seite, das nichts Eigenes festlegt. Den Schalter für die ganze Website findest du unter Einstellungen › Allgemein.',
    coverGrid: 'Raster der Albumcover',
    coverGridHint:
      'Legt fest, wie die Albumcover auf dieser Seite angeordnet werden — die Fotos in den Alben sind davon nicht betroffen. Lass die Spaltenzahl leer, um der Rastereinstellung der Website zu folgen, und den Abstand leer, um den Abstand des Designs zu behalten. Auf Tablet-Breite stehen höchstens zwei Cover pro Reihe.',
    photoGrid: 'Fotoraster (Alben dieser Seite)',
    photoGridHint:
      'Wie die Fotos in jedem Album dieser Seite angeordnet werden. Lass beide Felder leer, um Einstellungen › Raster zu folgen; ein einzelnes Album kann das in gallery.yaml weiterhin überschreiben.',
    essayHeading: 'Storytelling & Fotoessay-Editor',
    essayIntro: 'Text, Zitate und randlose oder breite Fotos visuell zusammenstellen.',
    essayPickerTitle: 'Foto für den Fotoessay wählen',
    albums: 'Alben auf dieser Seite',
    addAlbum: '+ Album hinzufügen',
    noAlbums:
      'Noch keine Alben hinzugefügt. Klicke auf + Album hinzufügen, um eines aus Immich zu wählen.',
    /** Placeholder and accessible name of a section's title field. */
    sectionTitle: 'Titel des Abschnitts',
    removeSection: 'Abschnitt entfernen',
    sectionDescPlaceholder: 'Beschreibung des Abschnitts (optional)',
    sectionDesc: 'Beschreibung des Abschnitts',
    addSection: '+ Abschnitt hinzufügen',
    addLooseAlbum: '+ Album ohne Abschnitt hinzufügen',
    deleteSubpage: 'Unterseite löschen',
    done: 'Fertig',
  },

  /** The subpage drawer's Live Preview tab. */
  preview: {
    note: 'Dargestellt mit der gespeicherten Design-Vorlage der Website in Desktop-Breite. Ungespeicherte Änderungen in diesem Bereich erscheinen hier; Designänderungen erst, wenn sie in den Einstellungen gespeichert sind.',
  },

  /** Rows and tiles of the structure list. */
  tiles: {
    reorderHero: (n: number) => `Hero-Foto ${n} verschieben`,
    reorder: (name: string) => `${name} verschieben`,
    /** Stands in for a subpage without a name in `reorder`. */
    pageFallback: 'Seite',
    dragToReorder: 'Zum Umsortieren ziehen',
    disabledTitle: 'Seite ist deaktiviert',
    disabled: 'Deaktiviert',
    unlistedTitle: 'In der Navigation ausgeblendet, über den direkten Link erreichbar',
    /** Short state badges in a list row; one word. */
    unlisted: 'Ungelistet',
    off: 'Aus',
    missing: 'Fehlt',
    draft: 'Entwurf',
    /** Tag marking a content page, as opposed to a subpage; one short word. */
    page: 'Seite',
    passwordProtected: 'Passwortgeschützt',
    password: 'Passwort',
    editPage: 'Seite bearbeiten',
    albums: (n: number) => `${n} ${n === 1 ? 'Album' : 'Alben'}`,
  },

  newPage: {
    title: 'Neue Seite',
    titleLabel: 'Titel',
    titlePlaceholder: 'z. B. Preise',
    url: 'URL',
    /** An example slug: lowercase letters, digits and dashes only. */
    slugPlaceholder: 'preise',
    /** Shown as "/slug" while no slug is typed; same rules as above. */
    slugFallback: 'slug',
    exists: (slug: string) => `Eine Seite „${slug}“ gibt es bereits.`,
    hint: 'Beginnt leer und als Entwurf. Die URL kannst du später ändern.',
    showInMenu: 'Im Menü zeigen',
    showInMenuDesc: 'Hängt sie ans Ende des Menüs; gespeichert mit „Änderungen speichern“.',
    creating: 'Wird erstellt…',
    create: 'Seite erstellen',
  },

  pagePanel: {
    noFile: 'Für diese Seite gibt es keine Datei in content/pages/.',
    serverAnswered: (status: number) => `Der Server antwortete mit ${status}.`,
    couldNotLoad: 'Konnte nicht geladen werden.',
    exists: (slug: string) => `Eine Seite „${slug}“ gibt es bereits.`,
    moveTitle: (slug: string) => `Diese Seite nach /${slug} verschieben?`,
    linksBreak: (slug: string) =>
      `Links auf /${slug} funktionieren dann nicht mehr. Es gibt keine automatische Weiterleitung.`,
    movePage: 'Seite verschieben',
    notSavedConflict:
      'Nicht gespeichert — die Seite wurde anderswo geändert. Deine Änderungen sind noch da.',
    saveFailed: 'Die Seite konnte nicht gespeichert werden',
    saved: 'Seite gespeichert.',
    saveOffline:
      'Die Seite konnte nicht gespeichert werden. Prüfe die Verbindung und versuche es erneut.',
    deleteTitle: (name: string) => `„${name}“ löschen?`,
    deleteMessageInMenu:
      'Die Seite wird auch aus dem Menü in gallery.yaml entfernt. Von beiden Dateien wird vorher ein Backup angelegt, das sich unter Backups wiederherstellen lässt.',
    deleteMessage: 'Eine Kopie bleibt erhalten und lässt sich unter Backups wiederherstellen.',
    deletePage: 'Seite löschen',
    deleteFailed: 'Die Seite konnte nicht gelöscht werden',
    deleted: 'Seite gelöscht.',
    deleteOffline:
      'Die Seite konnte nicht gelöscht werden. Prüfe die Verbindung und versuche es erneut.',
    loadFailed: 'Diese Seite konnte nicht geladen werden.',
    menuStillLists:
      'Das Menü führt sie noch auf. Schalte „Im Menü zeigen“ aus und speichere die Struktur, um den Eintrag zu entfernen.',
    removeFromMenu: 'Aus dem Menü entfernen',
    openLive: 'Live-Seite in neuem Tab öffnen',
    title: 'Titel',
    url: 'URL',
    slugHint: 'Wird mit Unterseiten, Alben, Journal-Einträgen und festen Routen abgeglichen.',
    showInMenu: 'Im Menü zeigen',
    inMenuDesc:
      'Steht im Header-Menü. Zum Verschieben in der Strukturliste an die gewünschte Stelle ziehen.',
    offMenuDesc:
      'Nicht im Menü, aber unter ihrer URL erreichbar — für Seiten, die per Link geteilt werden.',
    /** Follows `inMenuDesc` / `offMenuDesc`. */
    savedWithStructure: 'Gespeichert mit „Änderungen speichern“.',
    draft: 'Entwurf',
    draftDesc: 'Einen Entwurf siehst nur du. Er bleibt aus dem Menü und der Sitemap heraus.',
    password: 'Passwort (optional)',
    pagePassword: 'Seitenpasswort',
    seoDescription: 'SEO-Beschreibung',
    seoPlaceholder: 'Ein oder zwei Sätze für Suchmaschinen und Link-Vorschauen',
    editContent: 'Inhalt bearbeiten →',
    savePage: 'Seite speichern',
  },

  /** The photo-essay block editor in a subpage set to "Fotoessay-Modus". */
  essay: {
    /** The starting story of an empty essay: a "# heading" and a paragraph. */
    starterTitle: 'Titel',
    starterBody: 'Schreib deine Geschichte hier...',
    /** Text a newly added block starts with. */
    newHeading: 'Neue Abschnittsüberschrift',
    newParagraph: 'Absatztext hier eingeben...',
    newQuote: 'Zitat hier eingeben...',
    toolbar: 'Block hinzufügen:',
    add: {
      paragraph: '+ Absatz',
      heading: '+ Überschrift',
      quote: '+ Zitat',
      facts: '+ Fakten',
      photo: '+ Foto',
      photoPair: '+ Fotopaar',
      photoGrid: '+ Fotoraster',
      album: '+ Album',
      map: '+ Karte',
    },
    empty: 'Noch keine Blöcke. Bau deinen Fotoessay mit den Buttons oben auf!',
    moveUp: 'Nach oben',
    moveDown: 'Nach unten',
    deleteBlock: 'Block löschen',
    headingLevel: 'Überschriftenebene',
    headingPlaceholder: 'Abschnittsüberschrift...',
    /** `**bold**` and `*italic*` are markdown syntax; keep the asterisks. */
    paragraphPlaceholder: 'Absatz schreiben... (Markdown wie **fett** und *kursiv* möglich)',
    quotePlaceholder: 'Zitattext...',
    authorPlaceholder: '— Autor / Quelle (optional)',
    noPhoto: 'Kein Foto',
    changePhoto: 'Foto ändern',
    selectPhoto: 'Foto wählen',
    /** Width options of a photo block; the measures are CSS units. */
    contained: 'Schmal (68ch)',
    wide: 'Breit (1100px)',
    fullbleed: 'Randlos (100vw)',
    assetUuidPlaceholder: 'Immich-Asset-UUID...',
    photoCaption: 'Bildunterschrift (optional)',
    photoN: (n: number) => `Foto ${n}`,
    selectPhotoN: (n: number) => `Foto ${n} wählen`,
    uuidN: (n: number) => `UUID ${n}...`,
    swapPhotos: 'Foto 1 & Foto 2 tauschen',
    pairCaption: 'Gemeinsame Bildunterschrift (optional)',
    removePhoto: 'Foto entfernen',
    select: 'Wählen',
    change: 'Ändern',
    addPhoto: 'Foto hinzufügen',
    gridCaption: 'Bildunterschrift des Rasters (optional)',
    factLabel: 'Bezeichnung, z. B. Strecke',
    factValue: 'Wert, z. B. 21 km',
    removeFact: 'Fakt entfernen',
    addFact: 'Fakt hinzufügen',
    albumUuidPlaceholder: 'Immich-Album-UUID (die Albumauswahl unter Seiten zeigt die IDs)',
    countPlaceholder: 'Anzahl (alle)',
    count: 'Anzahl',
    skipPlaceholder: 'Überspringen (0)',
    skip: 'Überspringen',
    layout: 'Layout',
    albumLayouts: {
      grid: 'Raster (Dreierreihen)',
      pairs: 'Paare (Zweierreihen)',
      wide: 'Breit (eins pro Reihe)',
    },
    albumCaption: 'Bildunterschrift für die Serie (optional)',
    albumHint:
      'Wird beim Anzeigen der Seite zu Fotoblöcken aufgefächert — in der Reihenfolge des Albums, eine manuelle Galerie-Reihenfolge zuerst. Lass die Anzahl leer für das ganze Album.',
    mapCaption: 'Bildunterschrift, z. B. Busan → Seoul (optional)',
    pointLabel: 'Bezeichnung (optional)',
    latitude: 'Breitengrad',
    /** Placeholders of the latitude / longitude fields; keep them short. */
    lat: 'Breite',
    longitude: 'Längengrad',
    lng: 'Länge',
    photoUuidPlaceholder: 'Foto-UUID...',
    allPhotosItem: 'Alle Fotos mit Geodaten aus den Alben dieser Seite, der Reihe nach',
    removePin: 'Pin entfernen',
    invalidPoint:
      'Ein Punkt braucht einen Breitengrad zwischen ±90 und einen Längengrad zwischen ±180; Punkte ohne gültige Koordinaten werden nicht gespeichert.',
    addPoint: 'Punkt',
    addPhotoPin: 'Foto-Pin',
    addAllPhotos: 'Alle Fotos mit Geodaten',
    connectLine: 'Pins mit einer Linie verbinden',
    mapHint:
      'Eingegebene Punkte erscheinen so, wie du sie eingibst. Foto-Pins werden auf der Live-Seite anhand der GPS-Daten des Fotos gesetzt, mit der Ortsgenauigkeit des Albums. Wird nur angezeigt, solange die Karte in den Einstellungen eingeschaltet ist.',
  },
};
