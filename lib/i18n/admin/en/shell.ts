/**
 * The panel's frame: sign-in, the sidebar, the status dropdown, the floating
 * save bar and the overview at /admin.
 */
export const shell = {
  gate: {
    loading: 'Loading admin panel',
    disabledTitle: 'Admin Panel',
    /** `{env}` is the ADMIN_PASSWORD variable name, set in code. */
    disabledBody:
      'The admin panel is not enabled. Set {env} in your environment variables to activate it.',
    sessionExpired: 'Your session expired. Sign in again.',
  },

  login: {
    subtitle: 'Admin Panel',
    password: 'Password',
    passwordPlaceholder: 'Enter admin password',
    signIn: 'Sign In',
    signingIn: 'Signing in...',
    failed: 'Login failed',
    connectionError: 'Connection error',
  },

  nav: {
    /** Group headings in the sidebar. */
    groups: {
      content: 'Content',
      visitors: 'Visitors',
      site: 'Site',
      system: 'System',
    },
    overview: 'Overview',
    pages: 'Pages',
    journal: 'Journal',
    messages: 'Messages',
    proofing: 'Proofing',
    analytics: 'Analytics',
    settings: 'Settings',
    diagnostics: 'Diagnostics',
    help: 'Help',
    unread: (n: number) => `${n} unread`,
  },

  sidebar: {
    skipToContent: 'Skip to content',
    /** Accessible name of the sidebar landmark. */
    landmark: 'Admin',
    expand: 'Expand sidebar',
    collapse: 'Collapse sidebar',
    /** Tooltip on the collapsed sidebar's toggle; keep it to one short word. */
    expandShort: 'Expand',
    brandSub: 'Admin',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    viewSite: 'View site',
    viewSiteTitle: 'Open site in new tab (bypassing cache)',
    backups: 'Backups',
    backupsTitle: 'Manage config backups & restore',
    reload: 'Reload',
    reloadTitle: 'Reload config & clear cache',
    reloadFailed: (status: number) => `Reload failed (HTTP ${status}).`,
    signOut: 'Sign out',
  },

  /** The system status dropdown at the foot of the sidebar. */
  status: {
    showTitle: 'Show system status',
    heading: 'System Diagnostics',
    refreshTitle: 'Refresh diagnostics',
    checking: 'Checking…',
    /**
     * Shown when the install was never finished. `{wizard}` is a link to the
     * setup wizard, labelled with `setupWizard`.
     */
    missingCredentials:
      'No Immich URL or API key configured. Set {apiUrl} and {apiKey}, or run the {wizard}.',
    noGallery:
      'No {file} yet — the public site has nothing to show. Add a page below, or run the {wizard} (the one-time token is printed to the server log).',
    setupWizard: 'setup wizard',
    immich: 'Immich Connection',
    connected: 'Connected',
    disconnected: 'Disconnected',
    config: 'Config Integrity',
    configValid: 'Valid',
    configDegraded: 'Degraded',
    configNotSetUp: 'Not set up',
    backups: 'Config Backups',
    backupCount: (n: number) => `${n} Backups`,
    latestBackup: 'Latest Backup',
    cache: 'In-Memory Cache',
    cacheItems: (n: number) => `${n} items`,
    version: 'Version',
    updateAvailable: (version: string) => `Version ${version} is available`,
  },

  /** The status badge's words; the colour is decided alongside (systemHealth.ts). */
  health: {
    checking: 'Checking...',
    setupIncomplete: 'Setup Incomplete',
    degraded: 'System Degraded',
    needsAttention: 'Needs Attention',
    checkDiagnostics: 'Check Diagnostics',
    ok: 'System OK',
    unknown: 'Status Unknown',
  },

  /** The spinner and the error-with-retry every admin screen shares. */
  loadState: {
    retry: 'Retry',
    loading: 'Loading',
  },

  /**
   * Unsaved edits that came back from the browser's draft store. `restored`
   * and `stale` insert one of `subjects`, so phrase the subjects to fit those
   * sentences in your language (article, case, preposition).
   */
  draft: {
    subjects: {
      settings: 'settings',
      about: 'About page',
      privacy: 'privacy policy',
      pageStructure: 'page structure',
      page: 'page',
      entry: 'entry',
    },
    restored: (subject: string) =>
      `Your unsaved changes to the ${subject} were restored. They are not saved yet.`,
    stale: (subject: string) =>
      `You have unsaved changes to the ${subject} from earlier, but it was saved elsewhere since. Restoring them replaces that version when you save.`,
    discardChanges: 'Discard changes',
    ok: 'OK',
    restore: 'Restore my changes',
    discardThem: 'Discard them',
  },

  /**
   * The dialog when a file was saved elsewhere since it was opened. `message`
   * starts with one of `subjects`, so phrase them as the subject of that
   * sentence.
   */
  conflict: {
    subjects: {
      settings: 'The settings file',
      about: 'The About page',
      privacy: 'The privacy policy',
      pageStructure: 'The page structure (gallery.yaml)',
      page: 'This page',
      entry: 'This entry',
    },
    title: 'Changed elsewhere',
    message: (subject: string) =>
      `${subject} was changed since you opened it — in another tab, on another device, by hand or by a backup restore. Saving now would replace that change.`,
    overwrite: 'Overwrite anyway',
    reload: 'Reload (discard mine)',
    keepEditing: 'Keep editing',
  },

  /** Errors of an admin screen's load; `detail` is the server's own message, or empty. */
  fetch: {
    loadFailed: (status: number, detail: string) =>
      detail ? `Could not load (HTTP ${status}): ${detail}.` : `Could not load (HTTP ${status}).`,
    unreachable: 'Could not reach the server.',
  },

  /** The close button on a notification toast. */
  notifications: {
    dismiss: 'Dismiss',
  },

  saveBar: {
    unsaved: 'Unsaved changes',
    preview: '↗ Preview Site',
    previewTitle: 'Open site in new tab (bypassing cache)',
    saving: 'Saving...',
  },

  overview: {
    kicker: 'Overview',
    /** Greeting by the hour of the admin's clock. */
    goodNight: 'Good night',
    goodMorning: 'Good morning',
    goodAfternoon: 'Good afternoon',
    goodEvening: 'Good evening',
    needsLook: (n: number) => `${n} thing${n === 1 ? '' : 's'} could use a look.`,
    allInOrder: 'Everything is in order.',
    checking: 'Checking the site…',
    viewSite: 'View site',
    editPages: 'Edit pages',
    attention: 'Needs attention',
    unreadMessages: (n: number) => `${n} unread message${n === 1 ? '' : 's'}`,
    /** `names` is a comma-separated list of up to three senders. */
    from: (names: string) => `From ${names}`,
    open: 'Open',
    calm: 'Nothing waiting. New messages and problems show up here.',
    glance: 'At a glance',
    pages: 'Pages',
    switchedOff: (n: number) => `${n} switched off`,
    allPublished: 'all published',
    heroPhotos: 'Hero photos',
    onHomePage: 'on the home page',
    journal: 'Journal',
    drafts: (n: number) => `${n} draft${n === 1 ? '' : 's'}`,
    noDrafts: 'no drafts',
    views7: 'Views · 7 days',
    cookieless: 'cookieless count',
    quickActions: 'Quick actions',
    newEntry: 'New journal entry',
    messages: 'Messages',
    theme: 'Theme',
    diagnostics: 'Diagnostics',
  },
};
