/** The help page and the backup dialog. */
export const system = {
  help: {
    kicker: 'System',
    title: 'Help',
    description: 'What your portfolio can do that has no button of its own.',
    viewer: 'Image viewer',
    /** `{question}` and `{h}` are the two keys, drawn as keycaps. */
    viewerIntro:
      'Keys a visitor can press in the lightbox. There is deliberately no toolbar for these — a permanent control over a photograph costs every visitor something — but visitors can call up the same list with {question} or {h}.',
    /**
     * When a conditional key is absent, keyed by the shortcut's label key in
     * `lib/lightboxShortcuts.ts`. The shortcut names themselves come from the
     * visitor dictionary of the panel's language.
     */
    notes: {
      shortcutInfo: 'Hidden where every EXIF group is switched off, and in journal entries.',
      shortcutFullscreen:
        'Absent on browsers with no element fullscreen, such as Safari on iPhone.',
      shortcutSlideshow: 'Cycles off, 3s, 5s, 10s and back to off. Any arrow or swipe stops it.',
      shortcutCopyLink:
        'Copies a link to the photo on screen. Positional: reordering the album moves where it lands.',
      shortcutDownload: 'Only for albums with download: true in gallery.yaml.',
      shortcutZoom:
        'Only where zoom is on (settings, page or album) and the photo has a full-resolution source.',
      shortcutZoomReset: 'Back to the whole photo. Esc does the same before it closes the viewer.',
    },
    diagnostics: 'Diagnostics',
    /** `{tab}` is the sidebar entry's name (`diagnosticsTab`), shown bold. */
    diagnosticsIntro:
      'Checks the things that fail silently — a wrong proxy hop count, a deleted album ID, a plaintext password, an album Immich does not consider shared. Open it from {tab} in the sidebar; the status badge below the menu still gives a quick read on whether anything needs attention right now.',
    diagnosticsTab: 'Diagnostics',
  },

  backups: {
    title: 'Backup History & Restoration',
    subtitle:
      'Restore an earlier version of your pages, settings, about page, journal or content pages — including deleted journal entries and pages.',
    /** One tab per kind of file; `files` names it in the empty state. */
    tabs: {
      gallery: 'Gallery',
      settings: 'Settings',
      about: 'About',
      privacy: 'Privacy',
      journal: 'Journal',
      pages: 'Content pages',
    },
    files: {
      gallery: 'gallery.yaml',
      settings: 'settings.yaml',
      about: 'about.md',
      privacy: 'privacy.md',
      journal: 'journal entries',
      pages: 'content pages',
    },
    tabLabel: (label: string, n: number) => `${label} (${n})`,
    restoreFailed: 'Failed to restore backup',
    restoreError: 'Error restoring backup',
    restoredPage: (slug: string) => `Page "${slug}" restored.`,
    restoredEntry: (slug: string) => `Journal entry "${slug}" restored.`,
    restored: (file: string) => `Backup restored successfully! (${file})`,
    confirmTitle: 'Confirm Restoration',
    /** `{file}` is the backup's file name, set in code. */
    confirmBody:
      'Are you sure you want to restore {file}? A safety snapshot of your current state will be created automatically before reverting.',
    restoring: 'Restoring...',
    restoreNow: 'Yes, Restore Now',
    loading: 'Loading backups...',
    empty: (what: string) => `No backups available yet for ${what}`,
    deleted: 'Deleted entry',
    deletedTitle: 'Snapshot taken when the entry was deleted',
    preRestore: 'Pre-Restore Snapshot',
    preRestoreTitle: 'Safety snapshot taken before a restore',
    restore: 'Restore',
    hideOlder: 'Hide older backups',
    showOlder: (n: number) => `Show ${n} older ${n === 1 ? 'backup' : 'backups'}`,
  },
};
