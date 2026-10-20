/**
 * Config doctor findings (`lib/admin/doctor.ts`, `app/api/admin/doctor/route.ts`),
 * one group per check. Built on the server and shown on /admin/diagnostics.
 *
 * Environment variable names, YAML keys, file paths and header names stay as
 * written in every language — they are what the operator has to type.
 *
 * This file must stay import-free: `npm run doctor` loads it through
 * `lib/admin/doctor.ts` with Node's own type stripping (#521).
 */
export const doctor = {
  authSecret: {
    missingTitle: 'AUTH_SECRET is not set',
    missingDetail:
      'Asset tokens and every auth cookie are signed with a secret regenerated on each ' +
      'restart, so links and logins break whenever the server restarts. Set AUTH_SECRET to a ' +
      'long random string.',
    shortTitle: (length: number) => `AUTH_SECRET is only ${length} characters`,
    shortDetail: (min: number) =>
      `Use at least ${min} random characters — it is the key behind every asset token and auth cookie.`,
    okTitle: 'AUTH_SECRET is set',
    okDetail: (length: number) => `${length} characters.`,
  },

  proxyHops: {
    noProxyTitle: 'No reverse proxy detected',
    noProxyInconclusiveDetail:
      'The only X-Forwarded-For entry is the one Next fills in for a direct request, which matches TRUSTED_PROXY_HOPS=0.',
    noProxyDetail: 'This request arrived without X-Forwarded-For, matching TRUSTED_PROXY_HOPS=0.',
    notSeenTitle: (configured: number) =>
      `TRUSTED_PROXY_HOPS is ${configured}, but this request shows no proxy`,
    notSeenDetail:
      'Either you reached the admin panel directly while public traffic goes through a proxy — ' +
      'in which case this is fine — or the value is too high and every visitor shares one rate-limit bucket.',
    unsetTitle: (seen: number) => `A proxy chain of ${seen} was seen, but TRUSTED_PROXY_HOPS is 0`,
    unsetDetail: (seen: number) =>
      'The client IP is read from a header the client can set, so rate limiting can be bypassed ' +
      `by spoofing it. Set TRUSTED_PROXY_HOPS to ${seen} (nginx, Traefik or Caddy alone = 1).`,
    tooHighTitle: (configured: number, seen: number) =>
      `TRUSTED_PROXY_HOPS is ${configured}, but only ${seen} proxy ${
        seen === 1 ? 'hop was' : 'hops were'
      } seen`,
    tooHighDetail: (seen: number) =>
      'The position being read lies before the start of the chain, so the client IP falls back to ' +
      `something unreliable. ${seen} is what this request suggests.`,
    tooLowTitle: (configured: number, seen: number) =>
      `TRUSTED_PROXY_HOPS is ${configured}, but a chain of ${seen} proxy hops was seen`,
    tooLowDetail: (seen: number) =>
      'The client IP is read from a position still inside the proxy chain, not the real client — ' +
      `every visitor behind that hop can share one rate-limit bucket. ${seen} is what this request suggests.`,
    okTitle: (configured: number) => `TRUSTED_PROXY_HOPS=${configured} matches the observed chain`,
    okDetail: (seen: number) =>
      `X-Forwarded-For carried ${seen} ${seen === 1 ? 'entry' : 'entries'} on this request.`,
  },

  cdn: {
    passwordTitle: 'CDN_URL is set, but photos are served from this server',
    passwordDetail:
      'The site is password-protected, and a CDN would hand cached photos to anyone with a ' +
      'link, so CDN mode stays off. Remove the site password or unset CDN_URL.',
    noHopsTitle: 'CDN mode is on, but TRUSTED_PROXY_HOPS is 0',
    noHopsDetail: (cdnUrl: string) =>
      `Photos are served through ${cdnUrl}, and without TRUSTED_PROXY_HOPS the rate limiter ` +
      'counts the CDN edge instead of the visitor. Set it to the number of proxies in front of ' +
      'the app, the CDN included.',
    okTitle: 'CDN mode is on',
    okDetail: (cdnUrl: string) => `Photos and videos are served through ${cdnUrl}.`,
  },

  albumIds: {
    noneTitle: 'No albums configured',
    noneDetail: 'gallery.yaml lists no albums, so the gallery has nothing to show.',
    missingTitle: (missing: number, total: number) =>
      `${missing} of ${total} album IDs do not exist in Immich`,
    /** `ids` is a comma-separated list of album IDs. */
    missingDetail: (ids: string) =>
      `Those pages are silently empty. Check gallery.yaml for: ${ids}`,
    okTitle: (total: number) => `All ${total} album IDs resolve`,
    okDetail: 'Every album in gallery.yaml exists in Immich.',
  },

  albumsShared: {
    okTitle: 'Every published album is shared in Immich',
    okDetail: 'Nothing is published that Immich still considers private.',
    warnTitle: (n: number) =>
      `${n} published ${n === 1 ? 'album is' : 'albums are'} not shared in Immich`,
    /** `names` is a comma-separated list of album names. */
    warnDetail: (names: string) =>
      'They are served to visitors regardless — the allowlist in gallery.yaml is what decides. ' +
      `Worth a look if it was unintentional: ${names}`,
  },

  downloadMetadata: {
    okTitle: 'Downloads go out without GPS',
    okDetail: (albums: number) =>
      `Every original in the ${albums === 1 ? 'download album' : `${albums} download albums`} is JPEG, HEIC or AVIF, and is served with its location removed.`,
    warnTitle: (files: number) =>
      `${files} downloadable ${files === 1 ? 'original keeps' : 'originals keep'} all metadata`,
    /** `located`: how many of the files Immich has GPS for (0 = say nothing). `albums`: "Name (3), …". */
    warnDetail: (located: number, albums: string) =>
      'RAW, DNG, PNG, TIFF, WebP and video files are served exactly as stored, with any GPS ' +
      `coordinates${located ? ` (Immich has a location for ${located} of them)` : ''}. ` +
      'Turn off downloads or remove these files if their location should stay private: ' +
      albums,
  },

  zoomRenditions: {
    okTitle: 'Immich has full-size previews for zoom',
    okDetail: (photos: number) =>
      `${photos} HEIC, RAW or similar ${photos === 1 ? 'photo' : 'photos'} in zoom albums are zoomed through Immich's full-size rendition, with the location removed.`,
    missingTitle: (photos: number) =>
      `${photos} ${photos === 1 ? 'photo' : 'photos'} cannot be zoomed: Immich has no full-size preview`,
    /** `albums`: "Name (3), …". The menu path is Immich's own English UI. */
    missingDetail: (albums: string) =>
      'HEIC, RAW and other formats a browser cannot show are zoomed through Immich’s full-size ' +
      'rendition, and Immich has none (one photo sampled). Visitors see the zoom button and then ' +
      '"not available". In Immich, turn on Administration › Settings › Image Settings › Full-size ' +
      'image (JPEG), then run the Generate Thumbnails job for missing assets. Albums: ' +
      albums,
    formatTitle: (photos: number) =>
      `${photos} ${photos === 1 ? 'photo' : 'photos'} cannot be zoomed: Immich's full-size format is not JPEG`,
    /** `contentType` is empty when Immich did not name one. */
    formatDetail: (contentType: string, albums: string) =>
      `Immich renders its full-size previews as ${contentType || 'an unknown type'}, and ` +
      'zoom only serves JPEG renditions — their location metadata is removed on the way out, which ' +
      'Folio cannot do for WebP. Set Administration › Settings › Image Settings › Full-size image ' +
      '› Format to JPEG, then run the Generate Thumbnails job. Albums: ' +
      albums,
  },

  albumSlugs: {
    /** Where a set of albums shares one URL prefix — the top level of the site… */
    contextStandalone: 'gallery.yaml albums',
    /** …or a subpage. */
    contextSubpage: (name: string) => `subpage "${name}"`,
    collision: (context: string, names: string[], slug: string) =>
      `${context}: "${names.join('" and "')}" all resolve to /${slug}`,
    errorTitle: (n: number) => `${n} album slug ${n === 1 ? 'collision' : 'collisions'} found`,
    /** `collisions` is the `collision` lines joined with "; ". */
    errorDetail: (collisions: string) =>
      'Every album after the first in a collision is unreachable at its own URL, and its ' +
      `settings resolve from the one before it. ${collisions}`,
    okTitle: 'No album slug collisions',
    okDetail: 'Every album reachable under the same URL prefix has a distinct slug.',
  },

  passwords: {
    /** Where a password lives, listed in the findings below. */
    labelSite: 'Site password',
    labelSubpage: (slug: string) => `Subpage ${slug}`,
    labelAlbum: (slug: string) => `Album ${slug}`,
    labelJournal: (slug: string) => `Journal ${slug}`,
    bcryptTitle: (n: number) => `${n} password${n === 1 ? '' : 's'} still use bcrypt`,
    bcryptDetail: (labels: string) =>
      'Bcrypt support was removed, so nobody can unlock these at all. Replace with plaintext ' +
      `once, log in, and paste the scrypt: hash from the log: ${labels}`,
    plaintextTitle: (n: number) => `${n} password${n === 1 ? ' is' : 's are'} stored in plaintext`,
    plaintextDetail: (labels: string) =>
      'Anyone who reads the file reads the password. Saving the page, entry or setting once ' +
      'in the admin panel stores it hashed; for a hand-edited file, log in once and paste the ' +
      `scrypt: hash printed to the server log: ${labels}`,
    noneTitle: 'No passwords configured',
    noneDetail: 'Nothing on this site is password-protected.',
    okTitle: (n: number) => `All ${n} passwords are hashed`,
    okDetail: 'Every configured password uses a scrypt: hash.',
  },

  legal: {
    /** Impressum fields, listed after `missing`. */
    fieldName: 'name',
    fieldAddress: 'street address',
    fieldZipCity: 'ZIP and city',
    missing: (fields: string) => `Missing: ${fields}.`,
    noEmail: 'No email address; § 5 DDG requires one.',
    badContactUrl: 'The contact form URL is ignored because it does not start with http(s)://.',
    emailOnly:
      'Email is the only contact channel. Add a phone number, a contact form URL, or turn on the built-in contact form.',
    gapsTitle: (n: number) => `The Impressum has ${n} gap${n === 1 ? '' : 's'}`,
    okTitle: 'The Impressum is complete',
    okDetail: 'Name, address, email and a second contact channel are set.',
  },

  contact: {
    noNotifyTitle: 'Contact form messages notify nobody',
    noNotifyDetail:
      'New messages only show up under Messages in the admin panel. Set an ntfy URL so you hear about them.',
    badUrlTitle: 'The contact notification URL is ignored',
    badUrlDetail: 'It does not start with http(s)://, so no notification is sent.',
    okTitle: 'Contact form notifies you',
    okDetail: 'Each new message triggers a notification.',
  },

  settingValues: {
    /** Names of the settings `validateSettingValues` checks. */
    labels: {
      url: 'Site URL',
      themeAccent: 'accent colour',
      themeRadius: 'corner radius',
      gridColumns: 'grid columns',
      gridGap: 'grid gap',
      retentionDays: 'message retention',
      navLinks: 'header links',
    },
    okTitle: 'Settings are used as written',
    okDetail:
      'Site URL, theme, grid, message retention and header links in settings.yaml are all valid.',
    oneIgnoredTitle: (name: string) => `The ${name} setting is ignored`,
    manyIgnoredTitle: (n: number) => `${n} settings are ignored`,
    ignoredDetail: (names: string) =>
      `settings.yaml holds a value the site cannot use for: ${names}. ` +
      'The site uses a default or the nearest allowed value instead. Open the setting to see what it expects.',
  },

  privacy: {
    okTitle: 'The privacy policy is published',
    okDetail: 'Shown at /privacy and linked in the footer.',
    missingTitle: 'There is no privacy policy',
    switchedOffDetail:
      'The text exists but the privacy page is switched off, so /privacy answers 404.',
    noTextDetail:
      'The Impressum is on but /privacy has no text. Settings → Legal lists what this site processes, as a starting point.',
  },

  writable: {
    errorTitle: (n: number) => `${n} content ${n === 1 ? 'path is' : 'paths are'} not writable`,
    errorDetail: (paths: string) =>
      'Saving from the admin panel will fail, and so will backups. Check the ownership of the ' +
      `mounted volume: ${paths}`,
    okTitle: 'content/ is writable',
    okDetail: 'Config, journal and backups can be saved.',
  },

  immichApi: {
    notConfiguredTitle: 'No Immich URL or API key configured',
    notConfiguredDetail:
      'Set IMMICH_API_URL and IMMICH_API_KEY, or run the setup wizard at /install.',
    failedTitle: (failed: number, total: number) => `${failed} of ${total} Immich calls failed`,
    failedDetail: (endpoints: string) =>
      `Check IMMICH_API_URL and the API key. Failing: ${endpoints}`,
    okTitle: 'Immich answers every call Folio makes',
  },

  contentPages: {
    takenTitle: (n: number) =>
      `${n} content ${n === 1 ? 'page has' : 'pages have'} a slug that is already taken`,
    /** `reasons`: one sentence per page, in English (from lib/pages). `missing`: '' or a list. */
    takenDetail: (reasons: string, missing: string) =>
      reasons +
      ' Rename the page in Pages so visitors can reach it.' +
      (missing ? ` The menu also lists missing pages: ${missing}.` : ''),
    missingTitle: (n: number) => `The menu lists ${n} missing ${n === 1 ? 'page' : 'pages'}`,
    missingDetail: (list: string) =>
      `gallery.yaml references ${list}, but content/pages/ has no such file. ` +
      'The menu skips the entry; remove the reference or create the page.',
    okTitle: (n: number) => `${n} content ${n === 1 ? 'page' : 'pages'}, every slug free`,
    okDetail: (inMenu: number) => `${inMenu} of them in the menu.`,
  },
};
