import type { AdminDictionary } from '../index';

/**
 * Config doctor findings (`lib/admin/doctor.ts`, `app/api/admin/doctor/route.ts`),
 * one group per check. Environment variable names, YAML keys, file paths and
 * header names stay as written — they are what the operator has to type. Menu
 * paths quoted from Immich's own interface stay in English.
 *
 * The only import is type-only, so Node's type stripping (`npm run doctor`,
 * #521) erases it.
 */
export const doctor: AdminDictionary['doctor'] = {
  authSecret: {
    missingTitle: 'AUTH_SECRET is niet ingesteld',
    missingDetail:
      'Asset-tokens en alle authenticatiecookies worden ondertekend met een geheim dat bij elke ' +
      'herstart opnieuw wordt gegenereerd, dus links en aanmeldingen werken niet meer zodra de server ' +
      'herstart. Stel AUTH_SECRET in op een lange willekeurige tekenreeks.',
    shortTitle: (length: number) =>
      `AUTH_SECRET is maar ${length} ${length === 1 ? 'teken' : 'tekens'} lang`,
    shortDetail: (min: number) =>
      `Gebruik minstens ${min} willekeurige tekens — het is de sleutel achter elk asset-token en elke authenticatiecookie.`,
    okTitle: 'AUTH_SECRET is ingesteld',
    okDetail: (length: number) => `${length} ${length === 1 ? 'teken' : 'tekens'}.`,
  },

  proxyHops: {
    noProxyTitle: 'Geen reverse proxy gedetecteerd',
    noProxyInconclusiveDetail:
      'De enige X-Forwarded-For-vermelding is de vermelding die Next bij een direct verzoek zelf invult, en dat past bij TRUSTED_PROXY_HOPS=0.',
    noProxyDetail:
      'Dit verzoek kwam binnen zonder X-Forwarded-For, wat past bij TRUSTED_PROXY_HOPS=0.',
    notSeenTitle: (configured: number) =>
      `TRUSTED_PROXY_HOPS is ${configured}, maar dit verzoek toont geen proxy`,
    notSeenDetail:
      'Ofwel heb je het beheerpaneel rechtstreeks bereikt terwijl het openbare verkeer via een proxy loopt — ' +
      'dan is dit in orde — ofwel is de waarde te hoog en delen alle bezoekers één rate-limit-bucket.',
    unsetTitle: (seen: number) =>
      `Er is een proxyketen van ${seen} gezien, maar TRUSTED_PROXY_HOPS is 0`,
    unsetDetail: (seen: number) =>
      'Het client-IP wordt gelezen uit een header die de client zelf kan zetten, dus de rate limiting ' +
      `is te omzeilen door die te vervalsen. Stel TRUSTED_PROXY_HOPS in op ${seen} (alleen nginx, Traefik of Caddy = 1).`,
    tooHighTitle: (configured: number, seen: number) =>
      `TRUSTED_PROXY_HOPS is ${configured}, maar er ${seen === 1 ? 'is' : 'zijn'} maar ${seen} ${
        seen === 1 ? 'proxyhop' : 'proxyhops'
      } gezien`,
    tooHighDetail: (seen: number) =>
      'De positie die wordt gelezen ligt vóór het begin van de keten, dus het client-IP valt terug op ' +
      `iets onbetrouwbaars. Dit verzoek wijst op ${seen}.`,
    tooLowTitle: (configured: number, seen: number) =>
      `TRUSTED_PROXY_HOPS is ${configured}, maar er is een keten van ${seen} proxyhops gezien`,
    tooLowDetail: (seen: number) =>
      'Het client-IP wordt gelezen van een positie die nog binnen de proxyketen ligt, niet van de echte client — ' +
      `alle bezoekers achter die hop kunnen één rate-limit-bucket delen. Dit verzoek wijst op ${seen}.`,
    okTitle: (configured: number) =>
      `TRUSTED_PROXY_HOPS=${configured} past bij de waargenomen keten`,
    okDetail: (seen: number) =>
      `X-Forwarded-For bevatte bij dit verzoek ${seen} ${seen === 1 ? 'vermelding' : 'vermeldingen'}.`,
  },

  cdn: {
    passwordTitle: 'CDN_URL is ingesteld, maar foto’s worden vanaf deze server geleverd',
    passwordDetail:
      'De site is met een wachtwoord beveiligd, en een CDN zou gecachete foto’s aan iedereen met een ' +
      'link geven, dus de CDN-modus blijft uit. Verwijder het sitewachtwoord of maak CDN_URL leeg.',
    noHopsTitle: 'De CDN-modus staat aan, maar TRUSTED_PROXY_HOPS is 0',
    noHopsDetail: (cdnUrl: string) =>
      `Foto’s worden via ${cdnUrl} geleverd, en zonder TRUSTED_PROXY_HOPS telt de rate limiter ` +
      'de CDN-edge in plaats van de bezoeker. Stel het in op het aantal proxy’s voor de app, ' +
      'de CDN meegerekend.',
    okTitle: 'De CDN-modus staat aan',
    okDetail: (cdnUrl: string) => `Foto’s en video’s worden via ${cdnUrl} geleverd.`,
  },

  albumIds: {
    noneTitle: 'Geen albums ingesteld',
    noneDetail: 'gallery.yaml bevat geen albums, dus de galerij heeft niets te tonen.',
    missingTitle: (missing: number, total: number) =>
      `${missing} van ${total} album-ID’s ${missing === 1 ? 'bestaat' : 'bestaan'} niet in Immich`,
    /** `ids` is a comma-separated list of album IDs. */
    missingDetail: (ids: string) =>
      `Die pagina’s blijven zonder melding leeg. Controleer in gallery.yaml: ${ids}`,
    okTitle: (total: number) => `Alle ${total} album-ID’s worden gevonden`,
    okDetail: 'Elk album in gallery.yaml bestaat in Immich.',
  },

  albumsShared: {
    okTitle: 'Elk gepubliceerd album is gedeeld in Immich',
    okDetail: 'Er is niets gepubliceerd dat Immich nog als privé beschouwt.',
    warnTitle: (n: number) =>
      `${n} ${n === 1 ? 'gepubliceerd album is' : 'gepubliceerde albums zijn'} niet gedeeld in Immich`,
    /** `names` is a comma-separated list of album names. */
    warnDetail: (names: string) =>
      'Ze worden hoe dan ook aan bezoekers getoond — de lijst in gallery.yaml beslist. ' +
      `Kijk ernaar als dat niet de bedoeling was: ${names}`,
  },

  downloadMetadata: {
    okTitle: 'Downloads gaan zonder gps de deur uit',
    okDetail: (albums: number) =>
      `Elk origineel in ${albums === 1 ? 'het downloadalbum' : `de ${albums} downloadalbums`} is JPEG, HEIC, AVIF, MP4 of MOV en wordt zonder locatie geleverd.`,
    warnTitle: (files: number) =>
      `${files} ${files === 1 ? 'downloadbaar origineel behoudt' : 'downloadbare originelen behouden'} alle metadata`,
    /** `located`: how many of the files Immich has GPS for (0 = say nothing). `albums`: "Name (3), …". */
    warnDetail: (located: number, albums: string) =>
      'RAW-, DNG-, PNG-, TIFF- en WebP-bestanden en video’s anders dan MP4 en MOV worden precies zo geleverd als ze zijn ' +
      `opgeslagen, met eventuele gps-coördinaten${located ? ` (Immich heeft voor ${located} ervan een locatie)` : ''}. ` +
      'Zet downloads uit of verwijder deze bestanden als hun locatie privé moet blijven: ' +
      albums,
  },

  zoomRenditions: {
    okTitle: 'Immich heeft previews op volledige grootte om te zoomen',
    okDetail: (photos: number) =>
      `${photos} HEIC-, RAW- of vergelijkbare ${photos === 1 ? 'foto' : 'foto’s'} in zoomalbums ${photos === 1 ? 'wordt' : 'worden'} gezoomd via de versie op volledige grootte van Immich, zonder locatie.`,
    missingTitle: (photos: number) =>
      `${photos} ${photos === 1 ? 'foto kan' : 'foto’s kunnen'} niet worden gezoomd: Immich heeft geen preview op volledige grootte`,
    /** `albums`: "Name (3), …". The menu path is Immich's own English UI. */
    missingDetail: (albums: string) =>
      'HEIC, RAW en andere formaten die een browser niet kan tonen, worden gezoomd via de versie op ' +
      'volledige grootte van Immich, en Immich heeft er geen (één foto gecontroleerd). Bezoekers zien ' +
      'de zoomknop en daarna “niet beschikbaar”. Zet in Immich Administration › Settings › Image Settings › ' +
      'Full-size image (JPEG) aan en start daarna de taak Generate Thumbnails voor ontbrekende assets. Albums: ' +
      albums,
    formatTitle: (photos: number) =>
      `${photos} ${photos === 1 ? 'foto kan' : 'foto’s kunnen'} niet worden gezoomd: het formaat op volledige grootte van Immich is geen JPEG`,
    /** `contentType` is empty when Immich did not name one. */
    formatDetail: (contentType: string, albums: string) =>
      `Immich maakt zijn previews op volledige grootte als ${contentType || 'een onbekend type'}, en ` +
      'zoom levert alleen JPEG-versies — hun locatiemetadata wordt onderweg verwijderd, wat ' +
      'Folio voor WebP niet kan. Zet Administration › Settings › Image Settings › Full-size image ' +
      '› Format op JPEG en start daarna de taak Generate Thumbnails. Albums: ' +
      albums,
  },

  albumSlugs: {
    contextStandalone: 'albums in gallery.yaml',
    contextSubpage: (name: string) => `pagina “${name}”`,
    collision: (context: string, names: string[], slug: string) =>
      `${context}: “${names.join('” en “')}” verwijzen allemaal naar /${slug}`,
    errorTitle: (n: number) =>
      `${n} ${n === 1 ? 'botsing' : 'botsingen'} tussen albumslugs gevonden`,
    /** `collisions` is the `collision` lines joined with "; ". */
    errorDetail: (collisions: string) =>
      'Elk album na het eerste in een botsing is niet bereikbaar op zijn eigen URL, en zijn ' +
      `instellingen worden afgeleid van het album ervoor. ${collisions}`,
    okTitle: 'Geen botsingen tussen albumslugs',
    okDetail: 'Elk album onder hetzelfde URL-voorvoegsel heeft een eigen slug.',
  },

  passwords: {
    labelSite: 'Sitewachtwoord',
    labelSubpage: (slug: string) => `Pagina ${slug}`,
    labelAlbum: (slug: string) => `Album ${slug}`,
    labelJournal: (slug: string) => `Journalverhaal ${slug}`,
    bcryptTitle: (n: number) =>
      `${n} ${n === 1 ? 'wachtwoord gebruikt' : 'wachtwoorden gebruiken'} nog bcrypt`,
    bcryptDetail: (labels: string) =>
      'Ondersteuning voor bcrypt is verwijderd, dus niemand kan deze nog ontgrendelen. Vervang ze ' +
      `eenmalig door platte tekst, meld je aan en plak de scrypt:-hash uit het logboek: ${labels}`,
    plaintextTitle: (n: number) =>
      `${n} ${n === 1 ? 'wachtwoord is' : 'wachtwoorden zijn'} als platte tekst opgeslagen`,
    plaintextDetail: (labels: string) =>
      'Wie het bestand leest, leest het wachtwoord. Sla de pagina, het verhaal of de instelling één ' +
      'keer op in het beheerpaneel, dan wordt het gehasht opgeslagen; bij een handmatig bewerkt bestand ' +
      `meld je je één keer aan en plak je de scrypt:-hash uit het serverlogboek: ${labels}`,
    noneTitle: 'Geen wachtwoorden ingesteld',
    noneDetail: 'Niets op deze site is met een wachtwoord beveiligd.',
    okTitle: (n: number) => `Alle ${n} wachtwoorden zijn gehasht`,
    okDetail: 'Elk ingesteld wachtwoord gebruikt een scrypt:-hash.',
  },

  legal: {
    fieldName: 'naam',
    fieldAddress: 'straat en huisnummer',
    fieldZipCity: 'postcode en plaats',
    missing: (fields: string) => `Ontbreekt: ${fields}.`,
    noEmail: 'Geen e-mailadres; § 5 DDG vereist er een.',
    badContactUrl:
      'De URL van het contactformulier wordt genegeerd, omdat die niet met http(s):// begint.',
    emailOnly:
      'E-mail is het enige contactkanaal. Voeg een telefoonnummer of de URL van een contactformulier toe, of zet het ingebouwde contactformulier aan.',
    gapsTitle: (n: number) => `Het colofon heeft ${n} ${n === 1 ? 'leemte' : 'leemtes'}`,
    okTitle: 'Het colofon is volledig',
    okDetail: 'Naam, adres, e-mail en een tweede contactkanaal zijn ingevuld.',
  },

  contact: {
    noNotifyTitle: 'Niemand krijgt een melding van berichten via het contactformulier',
    noNotifyDetail:
      'Nieuwe berichten verschijnen alleen onder Berichten in het beheerpaneel. Stel een ntfy-URL in, zodat je ervan hoort.',
    badUrlTitle: 'De meldings-URL voor het contactformulier wordt genegeerd',
    badUrlDetail: 'Die begint niet met http(s)://, dus er wordt geen melding verstuurd.',
    okTitle: 'Het contactformulier stuurt je meldingen',
    okDetail: 'Elk nieuw bericht levert een melding op.',
  },

  settingValues: {
    labels: {
      url: 'Site-URL',
      themeAccent: 'accentkleur',
      themeRadius: 'hoekradius',
      gridColumns: 'rasterkolommen',
      gridGap: 'tussenruimte van het raster',
      retentionDays: 'bewaartermijn van berichten',
      navLinks: 'links in de kop',
    },
    okTitle: 'Instellingen worden gebruikt zoals ze zijn opgegeven',
    okDetail:
      'Site-URL, thema, raster, bewaartermijn van berichten en links in de kop in settings.yaml zijn allemaal geldig.',
    oneIgnoredTitle: (name: string) => `De instelling ${name} wordt genegeerd`,
    manyIgnoredTitle: (n: number) => `${n} instellingen worden genegeerd`,
    ignoredDetail: (names: string) =>
      `settings.yaml bevat een waarde die de site niet kan gebruiken voor: ${names}. ` +
      'De site gebruikt in plaats daarvan een standaardwaarde of de dichtstbijzijnde toegestane waarde. Open de instelling om te zien wat die verwacht.',
  },

  privacy: {
    okTitle: 'De privacyverklaring is gepubliceerd',
    okDetail: 'Getoond op /privacy en gelinkt in de voettekst.',
    missingTitle: 'Er is geen privacyverklaring',
    switchedOffDetail:
      'De tekst bestaat, maar de privacypagina staat uit, dus /privacy geeft een 404.',
    noTextDetail:
      'Het colofon staat aan, maar /privacy heeft geen tekst. Instellingen → Juridisch toont wat deze site verwerkt, als vertrekpunt.',
  },

  writable: {
    errorTitle: (n: number) =>
      `${n} ${n === 1 ? 'contentpad is' : 'contentpaden zijn'} niet beschrijfbaar`,
    errorDetail: (paths: string) =>
      'Opslaan vanuit het beheerpaneel mislukt, en back-ups ook. Controleer de eigenaar van het ' +
      `gekoppelde volume: ${paths}`,
    okTitle: 'content/ is beschrijfbaar',
    okDetail: 'Configuratie, journal en back-ups kunnen worden opgeslagen.',
  },

  immichApi: {
    notConfiguredTitle: 'Geen Immich-URL of API-sleutel ingesteld',
    notConfiguredDetail:
      'Stel IMMICH_API_URL en IMMICH_API_KEY in, of start de installatiewizard op /install.',
    failedTitle: (failed: number, total: number) =>
      `${failed} van ${total} Immich-aanroepen mislukt`,
    failedDetail: (endpoints: string) =>
      `Controleer IMMICH_API_URL en de API-sleutel. Mislukt: ${endpoints}`,
    okTitle: 'Immich beantwoordt elke aanroep die Folio doet',
  },

  contentPages: {
    takenTitle: (n: number) =>
      `${n} ${n === 1 ? 'inhoudspagina heeft' : 'inhoudspagina’s hebben'} een slug die al in gebruik is`,
    /** `reasons`: one sentence per page, in English (from lib/pages). `missing`: '' or a list. */
    takenDetail: (reasons: string, missing: string) =>
      reasons +
      ' Geef de pagina in Pagina’s een andere naam, zodat bezoekers hem kunnen bereiken.' +
      (missing ? ` Het menu verwijst ook naar ontbrekende pagina’s: ${missing}.` : ''),
    missingTitle: (n: number) =>
      `Het menu verwijst naar ${n} ${n === 1 ? 'ontbrekende pagina' : 'ontbrekende pagina’s'}`,
    missingDetail: (list: string) =>
      `gallery.yaml verwijst naar ${list}, maar content/pages/ heeft zo’n bestand niet. ` +
      'Het menu slaat de vermelding over; verwijder de verwijzing of maak de pagina aan.',
    okTitle: (n: number) => `${n} ${n === 1 ? 'inhoudspagina' : 'inhoudspagina’s'}, elke slug vrij`,
    okDetail: (inMenu: number) => `${inMenu} daarvan in het menu.`,
  },
};
