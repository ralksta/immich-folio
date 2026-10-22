/**
 * The diagnostics page (`app/admin/components/DiagnosticsView.tsx`). The doctor's
 * findings themselves are in `doctor.ts`; the alt-text finding is built here,
 * on the page, and lives under `altText`.
 */
export const diagnostics = {
  /** Groups the checks are filed under. */
  groups: {
    connection: 'Connection',
    security: 'Security',
    content: 'Content',
  },

  /** A finding's level — shown to screen readers and in the copied report. */
  levels: {
    ok: 'OK',
    warn: 'Check',
    error: 'Problem',
  },

  /** Buttons that lead to the fix for a finding. ↗ marks one that opens the docs. */
  fixes: {
    howToSetIt: 'How to set it',
    cdnSetup: 'CDN setup',
    openSettings: 'Open settings',
    openPages: 'Open pages',
    openInPages: 'Open in Pages',
    howToFix: 'How to fix',
    howToSetUp: 'How to set it up',
    apiKeyPermissions: 'API key permissions',
  },

  altText: {
    captionsOffTitle: 'Photo descriptions are not used as alt text',
    captionsOffDetail:
      '“Photo Description” is switched off in Settings → General, so every photo on the site has an empty alt text, whatever Immich holds.',
    /** Appended to the details below, so it starts with a space. */
    unreadable: (n: number) =>
      ` ${n} ${n === 1 ? 'album' : 'albums'} could not be read and are not counted.`,
    allTitle: (total: number) => `All ${total} published photos have alt text`,
    /** `unreadable` is the sentence above, or ''. */
    allDetail: (unreadable: string) => `Every photo carries its Immich description.${unreadable}`,
    missingTitle: (n: number) =>
      `${n} published ${n === 1 ? 'photo has' : 'photos have'} no alt text`,
    missingDetail: (unreadable: string) =>
      `Folio uses the Immich description as alt text. Without one, screen readers announce nothing and search engines index nothing for the photo.${unreadable}`,
    pendingTitle: 'Checking alt text…',
    pendingDetail: 'Reading every published album; large libraries take a moment.',
    failedTitle: 'Alt text could not be checked',
    failedDetail:
      'The albums did not load. If Immich is disconnected, that is the reason — try again once it is back.',
    coverage: (described: number, total: number, percent: number) =>
      `${described} of ${total} described · ${percent}%`,
    albumMissing: (missing: number, total: number) => `${missing} of ${total} missing`,
    openInImmich: (fileName: string) => `${fileName} — open in Immich`,
    more: (n: number) => `+${n} more`,
    showPhotos: 'Show photos',
    hidePhotos: 'Hide photos',
    noteAdd: 'Add the description in Immich, then press Reload in the top bar.',
    /** `{url}` is Immich's address, shown as code. */
    noteExternal: 'Photos open at {url}, Immich’s external domain.',
    /** `{setting}` is `externalDomain` below, shown in bold. */
    noteInternal:
      'Photos open at {url} — the address Folio reaches Immich at, which your browser may not be able to open. Set {setting} in Immich (Administration → Settings → Server) and the links use that instead.',
    /** The name of the setting in Immich's own (English) interface. */
    externalDomain: 'External domain',
  },

  header: {
    kicker: 'System',
    checking: 'Checking…',
    allClear: 'Nothing needs your attention',
    attention: (n: number, total: number) => `${n} of ${total} checks want a look`,
    /** `date` is already formatted for the browser's locale. */
    lastRun: (date: string) => `Last run ${date}`,
    running: 'Running the checks…',
    runAgain: 'Run again',
    copyTitle: 'Markdown, ready to paste into an issue',
    copy: 'Copy report',
    copied: 'Copied',
  },

  errors: {
    failed: (reason: string) => `Diagnostics failed. ${reason}`,
    copyFailed: 'Could not copy — your browser refused clipboard access.',
  },

  /** The Markdown report copied to the clipboard. */
  report: {
    heading: 'Immich Folio diagnostics',
    version: (version: string) => `Version ${version}`,
  },

  vitals: {
    aria: 'Overview',
    immich: 'Immich',
    connected: 'Connected',
    disconnected: 'Disconnected',
    config: 'Config',
    valid: 'Valid',
    invalid: 'Invalid',
    notSetUp: 'Not set up',
    backups: 'Backups',
    latest: (date: string) => `latest ${date}`,
    noneYet: 'none yet',
    version: 'Version',
    available: (version: string) => `${version} available`,
    upToDate: 'up to date',
  },

  needsAttention: 'Needs attention',

  storage: {
    title: 'Storage & cache',
    backupsTitle: (n: number) => `${n} config backups`,
    backupsDetail: 'Written before every admin save, ten per file.',
    manageBackups: 'Manage backups',
    cacheTitle: (n: number) => `In-memory cache holds ${n} items`,
    cacheDetail:
      'Album lists and photo metadata from Immich. Clearing it makes the next page views slower, nothing else.',
    clearing: 'Clearing…',
    clearCache: 'Clear cache',
  },
};
