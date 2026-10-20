import type { AdminDictionary } from '../index';

/**
 * Config doctor findings (`lib/admin/doctor.ts`, `app/api/admin/doctor/route.ts`),
 * one group per check. Built on the server and shown on /admin/diagnostics.
 *
 * Environment variable names, YAML keys, file paths and header names stay as
 * written in every language — they are what the operator has to type.
 */
export const doctor: AdminDictionary['doctor'] = {
  authSecret: {
    missingTitle: 'AUTH_SECRET ist nicht gesetzt',
    missingDetail:
      'Asset-Tokens und alle Auth-Cookies werden mit einem Schlüssel signiert, der bei jedem ' +
      'Neustart neu erzeugt wird, daher brechen Links und Anmeldungen bei jedem Neustart des Servers. ' +
      'Setze AUTH_SECRET auf eine lange Zufallszeichenkette.',
    shortTitle: (length: number) => `AUTH_SECRET hat nur ${length} Zeichen`,
    shortDetail: (min: number) =>
      `Verwende mindestens ${min} zufällige Zeichen — es ist der Schlüssel hinter jedem Asset-Token und Auth-Cookie.`,
    okTitle: 'AUTH_SECRET ist gesetzt',
    okDetail: (length: number) => `${length} Zeichen.`,
  },

  proxyHops: {
    noProxyTitle: 'Kein Reverse Proxy erkannt',
    noProxyInconclusiveDetail:
      'Der einzige X-Forwarded-For-Eintrag ist der, den Next bei einer direkten Anfrage selbst einträgt; das passt zu TRUSTED_PROXY_HOPS=0.',
    noProxyDetail: 'Diese Anfrage kam ohne X-Forwarded-For an; das passt zu TRUSTED_PROXY_HOPS=0.',
    notSeenTitle: (configured: number) =>
      `TRUSTED_PROXY_HOPS ist ${configured}, aber diese Anfrage zeigt keinen Proxy`,
    notSeenDetail:
      'Entweder hast du den Admin-Bereich direkt aufgerufen, während der öffentliche Verkehr über einen Proxy läuft — ' +
      'dann ist alles in Ordnung —, oder der Wert ist zu hoch und alle Besucher teilen sich einen Rate-Limit-Bucket.',
    unsetTitle: (seen: number) =>
      `Eine Proxy-Kette der Länge ${seen} wurde erkannt, aber TRUSTED_PROXY_HOPS ist 0`,
    unsetDetail: (seen: number) =>
      'Die Client-IP wird aus einem Header gelesen, den der Client selbst setzen kann, daher lässt sich ' +
      `das Rate-Limiting durch Fälschen umgehen. Setze TRUSTED_PROXY_HOPS auf ${seen} (nur nginx, Traefik oder Caddy = 1).`,
    tooHighTitle: (configured: number, seen: number) =>
      `TRUSTED_PROXY_HOPS ist ${configured}, aber nur ${seen} Proxy-${
        seen === 1 ? 'Hop wurde' : 'Hops wurden'
      } erkannt`,
    tooHighDetail: (seen: number) =>
      'Die gelesene Position liegt vor dem Anfang der Kette, daher fällt die Client-IP auf einen ' +
      `unzuverlässigen Wert zurück. ${seen} ist das, was diese Anfrage nahelegt.`,
    tooLowTitle: (configured: number, seen: number) =>
      `TRUSTED_PROXY_HOPS ist ${configured}, aber eine Kette von ${seen} Proxy-Hops wurde erkannt`,
    tooLowDetail: (seen: number) =>
      'Die Client-IP wird an einer Position innerhalb der Proxy-Kette gelesen, nicht beim echten Client — ' +
      `alle Besucher hinter diesem Hop können sich einen Rate-Limit-Bucket teilen. ${seen} ist das, was diese Anfrage nahelegt.`,
    okTitle: (configured: number) =>
      `TRUSTED_PROXY_HOPS=${configured} passt zur beobachteten Kette`,
    okDetail: (seen: number) =>
      `X-Forwarded-For enthielt bei dieser Anfrage ${seen} ${seen === 1 ? 'Eintrag' : 'Einträge'}.`,
  },

  cdn: {
    passwordTitle: 'CDN_URL ist gesetzt, aber Fotos werden von diesem Server ausgeliefert',
    passwordDetail:
      'Die Website ist passwortgeschützt, und ein CDN würde zwischengespeicherte Fotos an jeden mit ' +
      'einem Link ausliefern, daher bleibt der CDN-Modus aus. Entferne das Website-Passwort oder CDN_URL.',
    noHopsTitle: 'Der CDN-Modus ist an, aber TRUSTED_PROXY_HOPS ist 0',
    noHopsDetail: (cdnUrl: string) =>
      `Fotos werden über ${cdnUrl} ausgeliefert, und ohne TRUSTED_PROXY_HOPS zählt das Rate-Limiting ` +
      'den CDN-Edge statt des Besuchers. Setze den Wert auf die Zahl der Proxys vor der App, ' +
      'das CDN eingeschlossen.',
    okTitle: 'Der CDN-Modus ist an',
    okDetail: (cdnUrl: string) => `Fotos und Videos werden über ${cdnUrl} ausgeliefert.`,
  },

  albumIds: {
    noneTitle: 'Keine Alben konfiguriert',
    noneDetail: 'gallery.yaml enthält keine Alben, daher hat die Galerie nichts zu zeigen.',
    missingTitle: (missing: number, total: number) =>
      `${missing} von ${total} Album-IDs gibt es in Immich nicht`,
    /** `ids` is a comma-separated list of album IDs. */
    missingDetail: (ids: string) =>
      `Diese Seiten bleiben stillschweigend leer. Prüfe in gallery.yaml: ${ids}`,
    okTitle: (total: number) => `Alle ${total} Album-IDs werden gefunden`,
    okDetail: 'Jedes Album aus gallery.yaml existiert in Immich.',
  },

  albumsShared: {
    okTitle: 'Jedes veröffentlichte Album ist in Immich geteilt',
    okDetail: 'Nichts ist veröffentlicht, was Immich noch für privat hält.',
    warnTitle: (n: number) =>
      n === 1
        ? `${n} veröffentlichtes Album ist in Immich nicht geteilt`
        : `${n} veröffentlichte Alben sind in Immich nicht geteilt`,
    /** `names` is a comma-separated list of album names. */
    warnDetail: (names: string) =>
      'Besucher bekommen sie trotzdem zu sehen — entscheidend ist die Allowlist in gallery.yaml. ' +
      `Einen Blick wert, falls das nicht beabsichtigt war: ${names}`,
  },

  downloadMetadata: {
    okTitle: 'Downloads gehen ohne GPS-Daten hinaus',
    okDetail: (albums: number) =>
      `Jedes Original ${albums === 1 ? 'im Download-Album' : `in den ${albums} Download-Alben`} ist JPEG, HEIC oder AVIF und wird ohne Standort ausgeliefert.`,
    warnTitle: (files: number) =>
      files === 1
        ? `${files} herunterladbares Original behält alle Metadaten`
        : `${files} herunterladbare Originale behalten alle Metadaten`,
    /** `located`: how many of the files Immich has GPS for (0 = say nothing). `albums`: "Name (3), …". */
    warnDetail: (located: number, albums: string) =>
      'RAW-, DNG-, PNG-, TIFF-, WebP- und Videodateien werden genau so ausgeliefert, wie sie gespeichert sind, ' +
      `mit allen GPS-Koordinaten${located ? ` (Immich kennt für ${located} davon einen Standort)` : ''}. ` +
      'Schalte Downloads aus oder entferne diese Dateien, wenn ihr Standort privat bleiben soll: ' +
      albums,
  },

  zoomRenditions: {
    okTitle: 'Immich hat Vorschauen in voller Größe für den Zoom',
    okDetail: (photos: number) =>
      `${photos} HEIC-, RAW- oder ähnliche ${photos === 1 ? 'Foto' : 'Fotos'} in Zoom-Alben werden über die Vollgrößen-Fassung von Immich gezoomt, ohne Standort.`,
    missingTitle: (photos: number) =>
      `${photos} ${photos === 1 ? 'Foto lässt' : 'Fotos lassen'} sich nicht zoomen: Immich hat keine Vorschau in voller Größe`,
    /** `albums`: "Name (3), …". The menu path is Immich's own English UI. */
    missingDetail: (albums: string) =>
      'HEIC, RAW und andere Formate, die ein Browser nicht anzeigen kann, werden über die Vollgrößen-Fassung ' +
      'von Immich gezoomt, und Immich hat keine (ein Foto als Stichprobe). Besucher sehen den Zoom-Button und dann ' +
      '„nicht verfügbar“. Schalte in Immich Administration › Settings › Image Settings › Full-size ' +
      'image (JPEG) ein und starte dann den Job Generate Thumbnails für fehlende Assets. Alben: ' +
      albums,
    formatTitle: (photos: number) =>
      `${photos} ${photos === 1 ? 'Foto lässt' : 'Fotos lassen'} sich nicht zoomen: Das Vollgrößen-Format von Immich ist nicht JPEG`,
    /** `contentType` is empty when Immich did not name one. */
    formatDetail: (contentType: string, albums: string) =>
      `Immich erzeugt seine Vorschauen in voller Größe als ${contentType || 'unbekannten Typ'}, und ` +
      'der Zoom liefert nur JPEG-Fassungen aus — deren Standort-Metadaten werden dabei entfernt, was ' +
      'Folio bei WebP nicht kann. Setze Administration › Settings › Image Settings › Full-size image ' +
      '› Format auf JPEG und starte dann den Job Generate Thumbnails. Alben: ' +
      albums,
  },

  albumSlugs: {
    /** Where a set of albums shares one URL prefix — the top level of the site… */
    contextStandalone: 'Alben in gallery.yaml',
    /** …or a subpage. */
    contextSubpage: (name: string) => `Unterseite „${name}“`,
    collision: (context: string, names: string[], slug: string) =>
      `${context}: „${names.join('“ und „')}“ landen alle auf /${slug}`,
    errorTitle: (n: number) =>
      `${n} ${n === 1 ? 'Kollision' : 'Kollisionen'} bei Album-Slugs gefunden`,
    /** `collisions` is the `collision` lines joined with "; ". */
    errorDetail: (collisions: string) =>
      'Jedes Album nach dem ersten einer Kollision ist unter seiner eigenen URL nicht erreichbar, und seine ' +
      `Einstellungen werden vom vorherigen übernommen. ${collisions}`,
    okTitle: 'Keine Kollisionen bei Album-Slugs',
    okDetail: 'Jedes Album unter demselben URL-Präfix hat einen eigenen Slug.',
  },

  passwords: {
    /** Where a password lives, listed in the findings below. */
    labelSite: 'Website-Passwort',
    labelSubpage: (slug: string) => `Unterseite ${slug}`,
    labelAlbum: (slug: string) => `Album ${slug}`,
    labelJournal: (slug: string) => `Journal-Eintrag ${slug}`,
    bcryptTitle: (n: number) =>
      n === 1 ? `${n} Passwort nutzt noch bcrypt` : `${n} Passwörter nutzen noch bcrypt`,
    bcryptDetail: (labels: string) =>
      'Die Unterstützung für bcrypt wurde entfernt, daher kann niemand diese entsperren. Ersetze sie einmal durch Klartext, ' +
      `melde dich an und füge den scrypt:-Hash aus dem Log ein: ${labels}`,
    plaintextTitle: (n: number) =>
      n === 1
        ? `${n} Passwort ist im Klartext gespeichert`
        : `${n} Passwörter sind im Klartext gespeichert`,
    plaintextDetail: (labels: string) =>
      'Wer die Datei liest, liest das Passwort. Wird die Seite, der Eintrag oder die Einstellung einmal ' +
      'im Admin-Bereich gespeichert, landet es gehasht; bei einer von Hand bearbeiteten Datei melde dich einmal an und füge den ' +
      `scrypt:-Hash aus dem Server-Log ein: ${labels}`,
    noneTitle: 'Keine Passwörter konfiguriert',
    noneDetail: 'Nichts auf dieser Website ist passwortgeschützt.',
    okTitle: (n: number) => `Alle ${n} Passwörter sind gehasht`,
    okDetail: 'Jedes konfigurierte Passwort nutzt einen scrypt:-Hash.',
  },

  legal: {
    /** Impressum fields, listed after `missing`. */
    fieldName: 'Name',
    fieldAddress: 'Anschrift',
    fieldZipCity: 'PLZ und Ort',
    missing: (fields: string) => `Es fehlt: ${fields}.`,
    noEmail: 'Keine E-Mail-Adresse; § 5 DDG verlangt eine.',
    badContactUrl:
      'Die URL des Kontaktformulars wird ignoriert, weil sie nicht mit http(s):// beginnt.',
    emailOnly:
      'E-Mail ist der einzige Kontaktweg. Ergänze eine Telefonnummer, eine URL für ein Kontaktformular oder schalte das eingebaute Kontaktformular ein.',
    gapsTitle: (n: number) =>
      `Im Impressum ${n === 1 ? 'fehlt eine Angabe' : `fehlen ${n} Angaben`}`,
    okTitle: 'Das Impressum ist vollständig',
    okDetail: 'Name, Anschrift, E-Mail und ein zweiter Kontaktweg sind gesetzt.',
  },

  contact: {
    noNotifyTitle: 'Nachrichten aus dem Kontaktformular benachrichtigen niemanden',
    noNotifyDetail:
      'Neue Nachrichten erscheinen nur unter Nachrichten im Admin-Bereich. Setze eine ntfy-URL, damit du davon erfährst.',
    badUrlTitle: 'Die Benachrichtigungs-URL für Kontakt wird ignoriert',
    badUrlDetail: 'Sie beginnt nicht mit http(s)://, daher wird keine Benachrichtigung gesendet.',
    okTitle: 'Das Kontaktformular benachrichtigt dich',
    okDetail: 'Jede neue Nachricht löst eine Benachrichtigung aus.',
  },

  settingValues: {
    /** Names of the settings `validateSettingValues` checks. */
    labels: {
      url: 'Website-URL',
      themeAccent: 'Akzentfarbe',
      themeRadius: 'Eckenradius',
      gridColumns: 'Rasterspalten',
      gridGap: 'Rasterabstand',
      retentionDays: 'Aufbewahrung der Nachrichten',
      navLinks: 'Header-Links',
    },
    okTitle: 'Die Einstellungen werden wie eingetragen verwendet',
    okDetail:
      'Website-URL, Design, Raster, Aufbewahrung der Nachrichten und Header-Links in settings.yaml sind alle gültig.',
    oneIgnoredTitle: (name: string) => `Die Einstellung „${name}“ wird ignoriert`,
    manyIgnoredTitle: (n: number) => `${n} Einstellungen werden ignoriert`,
    ignoredDetail: (names: string) =>
      `settings.yaml enthält einen Wert, den die Website nicht verwenden kann, für: ${names}. ` +
      'Die Website nutzt stattdessen einen Standardwert oder den nächsten erlaubten Wert. Öffne die Einstellung, um zu sehen, was sie erwartet.',
  },

  privacy: {
    okTitle: 'Die Datenschutzerklärung ist veröffentlicht',
    okDetail: 'Wird unter /privacy angezeigt und in der Fußzeile verlinkt.',
    missingTitle: 'Es gibt keine Datenschutzerklärung',
    switchedOffDetail:
      'Der Text existiert, aber die Datenschutzseite ist ausgeschaltet, daher antwortet /privacy mit 404.',
    noTextDetail:
      'Das Impressum ist aktiv, aber /privacy hat keinen Text. Einstellungen → Rechtliches listet als Ausgangspunkt auf, was diese Website verarbeitet.',
  },

  writable: {
    errorTitle: (n: number) =>
      n === 1
        ? `${n} Content-Pfad ist nicht beschreibbar`
        : `${n} Content-Pfade sind nicht beschreibbar`,
    errorDetail: (paths: string) =>
      'Speichern aus dem Admin-Bereich schlägt fehl, Backups ebenso. Prüfe den Besitzer des ' +
      `eingehängten Volumes: ${paths}`,
    okTitle: 'content/ ist beschreibbar',
    okDetail: 'Konfiguration, Journal und Backups lassen sich speichern.',
  },

  immichApi: {
    notConfiguredTitle: 'Keine Immich-URL und kein API-Schlüssel konfiguriert',
    notConfiguredDetail:
      'Setze IMMICH_API_URL und IMMICH_API_KEY oder starte den Einrichtungsassistenten unter /install.',
    failedTitle: (failed: number, total: number) =>
      `${failed} von ${total} Immich-Aufrufen fehlgeschlagen`,
    failedDetail: (endpoints: string) =>
      `Prüfe IMMICH_API_URL und den API-Schlüssel. Fehlgeschlagen: ${endpoints}`,
    okTitle: 'Immich beantwortet jeden Aufruf, den Folio macht',
  },

  contentPages: {
    takenTitle: (n: number) =>
      n === 1
        ? `${n} Inhaltsseite hat einen Slug, der schon vergeben ist`
        : `${n} Inhaltsseiten haben einen Slug, der schon vergeben ist`,
    /** `reasons`: one sentence per page, in English (from lib/pages). `missing`: '' or a list. */
    takenDetail: (reasons: string, missing: string) =>
      reasons +
      ' Benenne die Seite unter Seiten um, damit Besucher sie erreichen.' +
      (missing ? ` Das Menü führt außerdem fehlende Seiten auf: ${missing}.` : ''),
    missingTitle: (n: number) =>
      `Das Menü führt ${n} ${n === 1 ? 'fehlende Seite' : 'fehlende Seiten'} auf`,
    missingDetail: (list: string) =>
      `gallery.yaml verweist auf ${list}, aber in content/pages/ gibt es keine solche Datei. ` +
      'Das Menü überspringt den Eintrag; entferne den Verweis oder lege die Seite an.',
    okTitle: (n: number) => `${n} ${n === 1 ? 'Inhaltsseite' : 'Inhaltsseiten'}, jeder Slug frei`,
    okDetail: (inMenu: number) => `${inMenu} davon im Menü.`,
  },
};
