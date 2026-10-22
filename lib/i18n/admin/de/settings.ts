import type { AdminDictionary } from '../index';

/**
 * Settings (`/admin/settings/<section>`): the editor shell, each section, the
 * privacy policy editor in Legal, and the shared form fields in
 * `app/admin/components/fields/` that other areas reuse.
 *
 * `{name}` placeholders are filled with markup by `rich()` — usually a
 * `<code>` element holding a file name or an environment variable, which stays
 * as it is in every language.
 */
export const settings: AdminDictionary['settings'] = {
  editor: {
    /** The section nav on the left of the settings page. */
    sections: {
      general: 'Allgemein',
      theme: 'Design',
      grid: 'Raster',
      footer: 'Fußzeile',
      legal: 'Rechtliches',
      seo: 'SEO',
      security: 'Sicherheit & Schutz',
      about: 'Über mich',
    },
    kicker: 'Website',
    title: 'Einstellungen',
    description: 'Gespeicherte Änderungen gelten sofort, ohne Neustart.',
    /** Label of the save button in the floating save bar. */
    saveChanges: 'Änderungen speichern',
    loadErrorTitle: 'Einstellungen konnten nicht geladen werden.',
    loadErrorBody:
      'Es wurde nichts geändert. Speichern bleibt gesperrt, bis sie geladen sind, damit ein leeres Formular deine Konfiguration nicht überschreibt.',
    conflict: 'Nicht gespeichert — die Einstellungen wurden anderswo geändert.',
    /** Shown when the server confirms a save without a message of its own. */
    saved: 'Gespeichert!',
    saveFailed: 'Speichern fehlgeschlagen',
  },

  general: {
    title: 'Allgemeine Website-Einstellungen',
    sub: 'Grundlegende Identität der Website, Sprache und zentrale Funktionen.',
    siteTitle: 'Website-Titel',
    siteTitleHint: 'Erscheint im Header, im Browser-Tab und in Link-Vorschauen.',
    /** `title` is what the site shows instead; `fromEnv` when SITE_TITLE supplied it. */
    siteTitleEmpty: (title: string, fromEnv: boolean) =>
      `Leer, daher zeigt die Website „${title}“${fromEnv ? ', aus SITE_TITLE' : ''}.`,
    subtitle: 'Untertitel',
    subtitlePlaceholder: 'Ein visuelles Tagebuch',
    language: 'Sprache',
    /** {locales}: comma-separated language codes; {htmlLang}: the `<html lang>` attribute. */
    languageHint:
      'Die Oberfläche für Besucher ist übersetzt für {locales}. Andere Sprachen setzen trotzdem {htmlLang} und das Datumsformat, zeigen aber die englische Oberfläche. Der Admin-Bereich hat eine eigene Spracheinstellung, siehe unten.',
    adminLanguage: 'Sprache des Admin-Bereichs',
    adminLanguageSame: 'Wie die Sprache der Website',
    adminLanguageHint:
      'Die Sprache dieses Admin-Bereichs. Sie wechselt, sobald die Einstellungen gespeichert sind.',

    featuresTitle: 'Portfolio-Funktionen & Module',
    featuresSub:
      'Optionale Seiten, und was die Website über deine Fotos verrät und über Besuche zählt.',
    modules: 'Module',
    modulesDesc: 'Jedes fügt eine Seite oder ein Bedienelement für Besucher hinzu.',
    aboutPage: '„Über mich“-Seite',
    aboutPageDesc: 'Porträt, Biografie und Ausrüstung unter /about',
    map: 'Karte',
    mapDesc: 'Aufnahmeorte auf einer Weltkarte unter /map',
    proofing: 'Kundenauswahl',
    proofingDesc: 'Besucher markieren, filtern und exportieren eine Auswahl von Fotos',
    zoom: 'Foto-Zoom',
    zoomDesc:
      'Besucher zoomen in voller Auflösung (1:1) in ein Foto, um die Schärfe zu prüfen. Seiten und Alben können das überschreiben',
    proofingEmail: 'E-Mail für die Auswahl',
    proofingEmailPlaceholder: 'Standard ist die Kontakt-E-Mail aus der Fußzeile',
    proofingEmailHint:
      'Wohin „E-Mail an den Fotografen“ eine Auswahl schickt. Ohne Angabe gilt die Kontakt-E-Mail aus der Fußzeile; ist keine von beiden gesetzt, wird der Button ausgeblendet.',

    privacyGroup: 'Was Besucher über dich erfahren',
    privacyGroupDesc: 'Was jedes Foto verrät und was bei einem Besuch gezählt wird.',
    /** Small chip beside the group title. */
    privacyGroupChip: 'für Besucher sichtbar',
    photoMetadata: 'Foto-Metadaten',
    /** Parts of the one-line summary under "Photo metadata", joined with " · ". */
    metadataSummary: {
      camera: 'Kamera & Objektiv',
      exposure: 'Belichtung',
      location: 'Ort',
      description: 'Beschreibung',
      none: 'Nichts veröffentlicht — die Lightbox blendet ihr Info-Panel aus',
    },
    details: 'Details',
    exifCamera: 'Kamera & Objektiv',
    exifCameraDesc: 'Gehäuse, Objektiv und Brennweite',
    exifSettings: 'Belichtungseinstellungen',
    exifSettingsDesc: 'Blende, Belichtungszeit und ISO',
    exifLocation: 'Ort',
    exifLocationDesc: 'Stadt und Land aus den GPS-Daten des Fotos',
    exifCaption: 'Fotobeschreibung',
    exifCaptionDesc: 'Die in Immich hinterlegte Beschreibung',
    gridHover: 'Zusammenfassung beim Überfahren im Raster',
    gridHoverDesc: 'Kamera und Objektiv über dem Foto, nicht nur in der Lightbox',
    gridHoverNeedsCamera: 'Erfordert Kamera & Objektiv',
    analytics: 'Statistik',
    analyticsDesc: 'Aufrufzählung ohne Cookies, nur auf deinem Server gespeichert',

    favicon: 'Favicon',
    faviconAlt: 'Aktuelles Favicon',
    faviconUpload: 'Icon hochladen',
    faviconUploadFailed: 'Hochladen fehlgeschlagen',
    faviconResetFailed: 'Zurücksetzen fehlgeschlagen',
    faviconResetTitle: 'Favicon zurücksetzen?',
    faviconResetMessage:
      'Das hochgeladene Icon wird gelöscht und wieder das mitgelieferte Standard-Icon verwendet.',
    faviconHint:
      'SVG, PNG, ICO oder JPEG — max. 512 kB. Wird im Content-Volume gespeichert. Zurücksetzen stellt das mitgelieferte Standard-Icon wieder her.',
  },

  theme: {
    title: 'Design-Vorlagen & Farbmodus',
    sub: 'Wähle eine Typografie-Vorlage und sieh sie dir im hellen oder dunklen Modus an.',
    visitorMode: 'Standardmodus für Besucher',
    visitorModeAria: 'Standardmodus für Besucher',
    modeDark: 'Dunkel',
    modeLight: 'Hell',
    modeAuto: 'System des Besuchers folgen',
    visitorModeHint:
      'Was ein Erstbesucher sieht. Mit dem Hell/Dunkel-Schalter im Header der Website kann er trotzdem wählen, und seine Wahl wird auf seinem Gerät gespeichert. Die Vorschau unten ist nur für dich und ändert daran nichts.',
    preset: 'Vorlage',
    /** Under each preset card: font, corner radius and photo frame. */
    presetSpecs: (font: string, radius: number, frame: string) =>
      `${font} · Radius ${radius} · ${frame}`,
    colorMode: 'Farbmodus',
    /** {editorial}, {minimal}, {classic}: preset names, set in bold. */
    colorModeHint:
      'Vorlagen wie {editorial}, {minimal} & {classic} haben im hellen Modus warme Creme-Hintergründe und im dunklen Modus Anthrazit.',
    lightMode: 'Heller Modus (Creme / Beige)',
    darkMode: 'Dunkler Modus (Anthrazit)',
    accentTitle: 'Akzentfarbe',
    accentSub: 'Wähle eine Akzentfarbe für Links, Buttons und Hervorhebungen.',
    /** Tooltips on the accent colour swatches. */
    swatches: {
      studioRed: 'Studio-Rot',
      editorialGold: 'Editorial-Gold',
      emerald: 'Smaragd',
      sapphire: 'Saphir',
      violet: 'Violett',
      white: 'Monochrom-Weiß',
      black: 'Obsidian-Schwarz',
    },
    accentAria: 'Akzentfarbe',
    accentHexAria: 'Akzentfarbe (Hex)',
    frameTitle: 'Fotorahmen & Layout',
    frameSub: 'Rahmen um die Bilder und Layout des Hero-Bereichs anpassen.',
    photoFrame: 'Fotorahmen',
    photoFrames: {
      none: { label: 'Keiner', desc: 'Bild bündig mit klaren Kanten' },
      passepartout: { label: 'Passepartout', desc: 'Klassischer Galerie-Passepartoutrand' },
      shadow: { label: 'Schatten', desc: 'Weicher, schwebender Schlagschatten' },
    },
    heroStyle: 'Hero-Stil',
    heroStyles: {
      split: { label: 'Geteilt', desc: 'Titel & Foto nebeneinander' },
      fullbleed: { label: 'Randlos', desc: 'Banner über die volle Breite, von Rand zu Rand' },
      minimal: { label: 'Minimal', desc: 'Zentrierter Titel mit dezentem Foto' },
      stacked: { label: 'Gestapelt', desc: 'Titel direkt über dem Foto' },
      typographic: { label: 'Typografisch', desc: 'Übergroßer Text als Kopf, keine Fotos' },
      mosaic: { label: 'Mosaik', desc: 'Dynamische Fotocollage' },
      cover: {
        label: 'Cover (experimentell)',
        desc: 'Vollbild-Startseite mit einem einzigen „Eintreten“-Link',
      },
    },
    lookTitle: 'Optik & Bewegung',
    lookSub: 'Effekte und kleine Bedienelemente auf jeder Seite.',
    transitions: 'Seitenübergänge',
    transitionsDesc: 'Ein kurzes Überblenden zwischen Seiten',
    scrollToTop: 'Nach-oben-Button',
    scrollToTopDesc: 'Ein schwebender Pfeil auf langen Seiten',
    grain: 'Filmkorn',
    grainDesc: 'Analoges Rauschen über dem Hintergrund',
    headerDot: 'Akzentpunkt im Header',
    headerDotDesc: 'Ein Punkt neben der Überschrift des aktiven Bereichs',
  },

  grid: {
    title: 'Raster & Layout',
    sub: 'Spaltenstruktur der Galerie und Seitenverhältnis der Vorschaubilder einstellen.',
    layout: 'Layout-Algorithmus',
    layouts: {
      masonry: { label: 'Masonry', desc: 'Dynamische, versetzte Spalten im Pinterest-Stil' },
      uniform: {
        label: 'Gleichmäßiges Raster',
        desc: 'Klares Raster mit gleichem Seitenverhältnis',
      },
      showcase: { label: 'Showcase', desc: 'Große Hero-Fotos gemischt mit kleineren Kacheln' },
      filmstrip: { label: 'Filmstreifen', desc: 'Horizontal scrollbarer Filmstreifen' },
      'editorial-flow': {
        label: 'Editorial Flow',
        desc: 'Magazin-Layout mit unterschiedlich großen Fotos',
      },
      justified: {
        label: 'Blocksatz (experimentell)',
        desc: 'Zeilen gleicher Höhe, die die volle Breite füllen',
      },
    },
    aspectRatio: 'Seitenverhältnis',
    /** Keyed by the ratio value written to settings.yaml. */
    aspectRatios: {
      '1': { label: 'Quadratisch (1:1)', desc: 'Quadratischer Zuschnitt im Verhältnis 1:1' },
      '3/2': { label: 'Querformat (3:2)', desc: 'Klassisches Kleinbild-Querformat' },
      '2/3': { label: 'Hochformat (2:3)', desc: 'Vertikales Hochformat' },
      '16/9': { label: 'Kino (16:9)', desc: 'Breitbild im Kinoformat 16:9' },
      auto: { label: 'Original', desc: 'Unbeschnittene Originalproportionen' },
    },
    spacingTitle: 'Abstände & Spalten',
    spacingSub:
      'Spaltenzahl und Abstand im Raster anpassen. Die Spaltenzahl gilt auch für die Albumcover auf einer Unterseite; deren Abstand bleibt beim Design, sofern eine Seite ihn nicht überschreibt.',
    columns: (min: number, max: number) => `Spalten (${min} - ${max})`,
    gap: 'Abstand (px)',
  },

  footer: {
    title: 'Fußzeile & Social Links',
    sub: 'Markenname, Instagram, E-Mail und Website-Links in der Fußzeile des Portfolios anzeigen.',
    brandName: 'Markenname in der Fußzeile',
    brandNamePlaceholder: 'Meine Fotografie',
    instagram: 'Instagram-URL',
    email: 'Kontakt-E-Mail',
    website: 'Persönliche Website',
    navTitle: 'Links in der Header-Navigation (experimentell)',
    navSub:
      'Externe Links, die im Header-Menü nach deinen Seiten erscheinen. Nur http(s)-URLs sind erlaubt; sie öffnen sich in einem neuen Tab.',
    linkLabel: 'Bezeichnung',
    /** Example label for an external header link. */
    linkLabelPlaceholder: 'Shop',
    linkUrl: 'URL',
    removeLink: 'Link entfernen',
    addLink: '+ Externen Link hinzufügen',
  },

  legal: {
    title: 'Impressum & rechtliche Hinweise',
    sub: 'Die Anbieterkennzeichnung einrichten, die das Digitale-Dienste-Gesetz (DDG) vorschreibt.',
    view: '/impressum ansehen ↗',
    enable: 'Impressum-Seite aktivieren (/impressum)',
    enableDesc: 'Erzeugt /impressum automatisch und verlinkt sie in der Fußzeile',
    heading: 'Überschrift',
    headingHint:
      'Leer lassen für die Zeile zu § 5 DDG in der Sprache der Website. Setzen, wenn ein anderes Gesetz gilt, z. B. § 5 ECG in Österreich.',
    name: 'Vollständiger Name / Firmenname',
    address: 'Straße und Hausnummer',
    zipCity: 'PLZ & Ort',
    country: 'Land',
    countryPlaceholder: 'Deutschland',
    email: 'E-Mail für das Impressum',
    phone: 'Telefonnummer',
    contactUrl: 'URL des Kontaktformulars',
    contactUrlInvalid:
      'Muss mit https:// oder http:// beginnen. Jeder andere Link wird auf der Seite weggelassen.',
    contactLabel: 'Text des Kontaktlinks',
    contactLabelPlaceholder: 'Kontaktformular',
    vatId: 'Umsatzsteuer-ID',
    taxId: 'Steuernummer',
    extraInfo: 'Weitere Angaben',
    contactForm: 'Kontaktformular (/contact)',
    contactFormDesc:
      'Nachrichten werden auf diesem Server gespeichert und unter Nachrichten gelesen. Es wird keine E-Mail verschickt.',
    notifyUrl: 'Benachrichtigungs-URL (ntfy)',
    notifyUrlInvalid: 'Muss mit https:// oder http:// beginnen.',
    notifyUrlHint:
      'Erhält einen festen Push „neue Nachricht“, ohne Angaben zum Absender. Wähle einen Topic-Namen, den niemand erraten kann.',
    /** `variable` is the environment variable's name. */
    notifyUrlEnvOverride: (variable: string) => `${variable} überschreibt diesen Wert.`,
    retention: 'Nachrichten löschen nach (Tagen)',
    privacy: 'Datenschutzerklärung (/privacy)',
    privacyDesc:
      'Wird angezeigt und in der Fußzeile verlinkt, sobald der Text unten gespeichert ist',
  },

  seo: {
    title: 'Suchmaschinenoptimierung (SEO)',
    sub: 'Metadaten für Suchmaschinen, OpenGraph-Tags und Indexierungsregeln anpassen.',
    snippetPreview: 'Vorschau des Google-Suchergebnisses',
    /** Stand-ins in the search preview while the fields are empty. */
    snippetTitle: 'Mein Fotografie-Portfolio',
    snippetDesc: 'Eine kuratierte Auswahl fotografischer Arbeiten.',
    siteUrl: 'Website-URL',
    /** {sitemap}: the file name sitemap.xml. */
    siteUrlHint:
      'Nötig für {sitemap}, den Feed und die strukturierten Daten — diese entstehen ohne Anfrage, daher lässt sich die Adresse nicht daraus ableiten. Bleibt das Feld leer, bleibt auch die Sitemap leer, statt zu raten.',
    /** {variable}: SITE_URL; {value}: the URL it holds. */
    siteUrlFromEnv:
      'Derzeit aus der Umgebungsvariable {variable} ({value}). Ein hier eingetragener Wert hat nach dem Speichern Vorrang.',
    metaTitle: 'SEO-Meta-Titel',
    metaTitlePlaceholder: 'Ersetzt den Website-Titel in den Google-Suchergebnissen',
    titleTemplate: 'Titelvorlage für Unterseiten',
    /** Site name used in the template example while no title is set. */
    titleTemplateFallback: 'Mein Portfolio',
    /** {placeholder}: the literal `%s`. */
    titleTemplateHint:
      'Vorlage für Unterseiten & Alben. {placeholder} steht als Platzhalter für den Seitentitel.',
    previewLabel: 'Vorschau:',
    /** Example page title put into the template preview. */
    previewExample: 'Landschaften',
    metaDescription: 'SEO-Meta-Beschreibung',
    metaDescriptionPlaceholder: 'Eine kuratierte Auswahl fotografischer Arbeiten...',
    crawlerTitle: 'Anweisungen für Suchmaschinen-Crawler',
    crawlerSub: 'Steuern, wie Googlebot und andere Crawler deine Website indexieren.',
    noIndex: 'noindex (vor Google verbergen)',
    noIndexDesc: 'Weist Suchmaschinen an, diese Website NICHT in den Suchergebnissen aufzuführen',
    noFollow: 'nofollow (Links nicht folgen)',
    noFollowDesc: 'Weist Suchmaschinen-Crawler an, ausgehenden Links nicht zu folgen',
  },

  security: {
    title: 'Website-Passwort',
    sub: 'Stellt die gesamte öffentliche Website hinter ein Passwort — praktisch, solange ein Portfolio noch im Aufbau ist, oder für ein Folio, das nur Kunden zu sehen bekommen.',
    sitePassword: 'Website-Passwort',
    sitePasswordAria: 'Website-Passwort',
    sitePasswordPlaceholder: 'Leer lassen für eine öffentliche Website',
    /** {hash}: the `scrypt:…` prefix; {file}: settings.yaml. */
    storedHashed: 'Wird als {hash}-Hash in {file} gespeichert, nie im Klartext.',
    /** {variable}: SITE_PASSWORD. */
    envOverride: 'Die Umgebungsvariable {variable} überschreibt dieses Feld.',
    adminSeparate:
      'Der Admin-Bereich behält sein eigenes Passwort und liegt nie hinter dieser Sperre.',
    protectionTitle: 'Bildschutz & Wasserzeichen',
    protectionSub:
      'Regeln zum Bildschutz, Sperre des Rechtsklicks und Wasserzeichen-Overlay einstellen.',
    rightClick: 'Rechtsklick-Menü deaktivieren',
    rightClickDesc:
      'Verhindert das Kontextmenü auf Portfolio-Bildern, um unerlaubte Downloads zu erschweren',
    imageDrag: 'Ziehen von Bildern deaktivieren',
    imageDragDesc: 'Verhindert, dass Besucher Bilder aus der Portfolio-Seite herausziehen',
    watermarkTitle: 'Dynamisches Wasserzeichen',
    watermarkSub: 'Copyright-Text über die Bilder in der Lightbox legen.',
    watermarkEnable: 'Wasserzeichen aktivieren',
    watermarkEnableDesc: 'Legt einen Copyright-Text über die Bildansichten des Portfolios',
    watermarkText: 'Text des Wasserzeichens',
    position: 'Position',
    positionAria: 'Position des Wasserzeichens',
    positionBottomRight: 'Unten rechts',
    positionBottomLeft: 'Unten links',
    positionCenter: 'Mittig über dem Bild',
    opacity: (percent: number) => `Deckkraft (${percent} %)`,
  },

  about: {
    title: '„Über mich“-Seite',
    sub: 'Porträt, Biografie und Ausrüstung auf der „Über mich“-Seite bearbeiten. Unter Allgemein lässt sich die Seite selbst ein- oder ausblenden.',
    portrait: 'Asset-ID des Porträts',
    portraitPlaceholder: 'Immich-Asset-UUID des Porträtfotos',
    name: 'Name',
    namePlaceholder: 'Dein Name',
    location: 'Ort',
    locationPlaceholder: 'Stadt, Land',
    gear: 'Ausrüstung (eine pro Zeile)',
    biography: 'Biografie (Markdown)',
    biographyPlaceholder: 'Fotograf aus...',
    conflict: 'Nicht gespeichert — die „Über mich“-Seite wurde anderswo geändert.',
  },

  privacy: {
    /** `error` is a short technical reason, e.g. "HTTP 500". */
    loadError: (error: string) =>
      `Die Datenschutzerklärung konnte nicht geladen werden (${error}). Lade die Seite neu, um es erneut zu versuchen.`,
    conflict: 'Nicht gespeichert — die Erklärung wurde anderswo geändert.',
    saveFailed: (status: number) => `Speichern fehlgeschlagen (HTTP ${status}).`,
    saved: 'Datenschutzerklärung gespeichert.',
    unreachable: 'Der Server ist nicht erreichbar.',
    factsTitle: 'Was diese Website verarbeitet',
    factsHint:
      'Aus deiner aktuellen Konfiguration abgelesen. Eine Checkliste zum Schreiben der Erklärung, kein Text für die Seite.',
    /** Badge beside a processing fact that involves an outside service. */
    thirdParty: 'Drittanbieter',
    body: 'Datenschutzerklärung (Markdown)',
    /** Example text in the empty editor; keep the Markdown heading. */
    bodyPlaceholder: '## Verantwortlicher\n\nName, Anschrift, E-Mail…',
    /** {heading}, {list}, {bold}, {link}: Markdown syntax examples in code style. */
    syntaxHint:
      'Überschriften mit {heading}, Listen mit {list}, {bold} und {link}. Wird unter /privacy angezeigt und in der Fußzeile verlinkt, sobald Text vorhanden ist. Frühere Fassungen bleiben unter Backups erhalten.',
    insertHeadings: 'Überschriften einfügen',
    view: '/privacy ansehen ↗',
    save: 'Datenschutzerklärung speichern',
  },

  /** Form fields shared with the page builder and the journal. */
  fields: {
    /** Link beside a feature switch to its own settings page. */
    configure: 'Einrichten →',
    locked: 'Gesperrt',
    /** {variable}: the environment variable's name. */
    envLockNote:
      'Gesetzt durch {variable} in der Umgebung. Ändere oder entferne die Variable dort; Änderungen hier hätten keine Wirkung.',
    columnsPlaceholder: 'Spalten (Website-Standard)',
    columnsAria: 'Spalten',
    gapPlaceholder: 'Abstand in px (Design-Standard)',
    gapAria: 'Abstand in px',
    passwordPlaceholder: 'Leer lassen für öffentlichen Zugriff',
    passwordProtected: 'Geschützt',
    passwordChange: 'Ändern',
    passwordNew: 'Neues Passwort',
    passwordHide: 'Passwort verbergen',
    passwordShow: 'Passwort anzeigen',
    passwordKeep: 'Aktuelles Passwort behalten',
    zoom: 'Foto-Zoom',
    zoomOn: 'An — Besucher können auf volle Auflösung zoomen',
    zoomOff: 'Aus',
  },
};
