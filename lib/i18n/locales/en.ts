/**
 * English dictionary — the reference locale.
 *
 * Every other locale implements the `Dictionary` type derived from this file,
 * so adding a key here is a type error in `de.ts` until it is translated.
 * Values are plain strings, or functions when a count or a name is interpolated
 * (a locale is free to pluralise differently — German "Alben" is not "Albums").
 */

const plural = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`;

export const en = {
  /** Passed to `toLocaleDateString` for visitor-facing dates. */
  dateLocale: 'en-US',

  nav: {
    home: 'Home',
    about: 'About',
    map: 'Map',
    journal: 'Journal',
    skipToContent: 'Skip to content',
  },

  common: {
    backTo: (label: string) => `Back to ${label}`,
    backToGallery: 'Back to Gallery',
    backToJournal: 'Back to Journal',
    home: 'Home',
    photos: (n: number) => plural(n, 'photo', 'photos'),
    albums: (n: number) => plural(n, 'album', 'albums'),
    collections: (n: number) => plural(n, 'collection', 'collections'),
    loadingGallery: 'Loading gallery',
    loadingPhotos: 'Loading photos',
  },

  home: {
    enter: 'Enter',
  },

  error: {
    notFoundTitle: 'Not found',
    notFoundText: 'This page does not exist, or the album is no longer published.',
    errorTitle: 'Something went wrong',
    errorText:
      'This page could not be loaded right now. It is usually temporary — try again in a moment.',
    siteErrorText:
      'This site could not be loaded right now. It is usually temporary — try again in a moment.',
    tryAgain: 'Try again',
    reference: (digest: string) => `Reference: ${digest}`,
  },

  theme: {
    switchToLight: 'Switch to light mode',
    switchToDark: 'Switch to dark mode',
    scrollToTop: 'Scroll to top',
  },

  password: {
    subtitle: 'This gallery is password-protected.',
    siteSubtitle: 'This site is password-protected.',
    placeholder: 'Enter password',
    submit: 'Enter',
    verifying: 'Verifying…',
    incorrect: 'Incorrect password. Please try again.',
    failed: 'Unable to verify password. Please try again later.',
  },

  about: {
    kicker: 'About',
    title: 'About',
    metaTitle: (name: string) => `About — ${name}`,
    portraitAlt: 'Portrait',
    gear: 'Gear',
  },

  map: {
    title: 'Map',
    kicker: 'Where',
    subtitle: 'Where the photos were taken',
    loading: 'Loading map…',
    loadFailed: (status: number) => `Failed to load map data (${status})`,
    initFailed: 'Failed to initialize map',
  },

  subpage: {
    collectionKicker: (index: string) => `${index} — Collection`,
    sectionsNav: 'Sections',
    coverAria: (albumName: string, count: string) => `${albumName}, ${count}`,
  },

  journal: {
    title: 'Journal',
    kicker: 'Stories & Essays',
    subtitle: 'Photo essays, visual stories, and field notes.',
    description: 'Photo essays, travel stories, and behind-the-scenes journals.',
    entryDescription: 'Journal entry',
    empty: 'No journal entries published yet.',
    readStory: 'Read Story →',
    minRead: (n: number) => `${n} min read`,
    draft: 'Draft',
    by: (author: string) => `by ${author}`,
    notFound: 'Not Found',
  },

  lightbox: {
    viewer: 'Image viewer',
    close: 'Close',
    closeTitle: 'Close (Esc)',
    previous: 'Previous photo',
    previousTitle: 'Previous photo (Left arrow)',
    next: 'Next photo',
    nextTitle: 'Next photo (Right arrow)',
    toggleInfo: 'Toggle photo info',
    toggleInfoTitle: 'Toggle photo info (i)',
    hideInfo: 'Hide Info',
    info: 'Info',
    loading: 'Loading...',
    camera: 'Camera',
    lens: 'Lens',
    focalLength: 'Focal Length',
    aperture: 'Aperture',
    shutter: 'Shutter',
    iso: 'ISO',
    location: 'Location',
    noExif: 'No EXIF data available',
    copyLink: 'Copy link to this photo',
    copyLinkTitle: 'Copy link to this photo (c)',
    copyLinkShort: 'Link',
    copied: 'Copied',
    copyManual: 'Copy this link',
    shortcuts: 'Keyboard shortcuts',
    shortcutNavigate: 'Previous / next photo',
    shortcutInfo: 'Photo info',
    shortcutFullscreen: 'Fullscreen',
    shortcutExitFullscreen: 'Leave fullscreen',
    shortcutSlideshow: 'Slideshow',
    shortcutSlideshowRunning: (seconds: number) => `Slideshow — every ${seconds}s`,
    slideshowStopped: 'Slideshow stopped',
    slideshowRunning: (seconds: number) => `Slideshow running, advancing every ${seconds} seconds`,
    shortcutCopyLink: 'Copy link to this photo',
    shortcutList: 'This list',
    shortcutClose: 'Close the viewer',
  },

  proofing: {
    addFavorite: 'Add favorite',
    removeFavorite: 'Remove favorite',
    addToFavorites: 'Add to favorites',
    removeFromFavorites: 'Remove from favorites',
    saved: 'Saved',
    favorite: 'Favorite',
    showAll: 'Show All',
    selected: (n: number) => `❤️ ${n} Selected`,
    shareExport: 'Share & Export',
    modalTitle: (n: number) => `❤️ Selection (${n})`,
    closeModal: 'Close modal',
    intro: (n: number) =>
      `You have selected ${plural(n, 'photo', 'photos')}. Choose an export option below to share your selection:`,
    copyLink: 'Copy Shareable Link',
    linkCopied: 'Link Copied!',
    copyList: 'Copy Text List (#1, #2...)',
    listCopied: 'List Copied!',
    sendEmail: '✉️ Send Email to Photographer',
    clearSelection: 'Clear Selection',
    confirmClear: 'Clear all selected favorites?',
    listEmpty: (albumName: string) => `${albumName}: No photos selected.`,
    listSummary: (albumName: string, count: number, indices: string) =>
      `${albumName} — Selected Photos (${count}): ${indices}`,
    mailSubject: (n: number) => `Photo Selection (${n} items)`,
    mailBody: (list: string, url: string) =>
      `Hello,\n\nHere is my photo selection:\n\n${list}\n\nShare Link: ${url}\n\nBest regards,`,
  },

  legal: {
    navLabel: 'Legal Notice',
    title: 'Legal Notice',
    subtitle: 'Information pursuant to § 5 TMG',
    address: 'Address',
    contact: 'Contact',
    email: 'Email',
    phone: 'Phone',
    taxSection: 'Tax Information',
    taxId: 'Tax number',
    vatId: 'VAT ID',
    extraInfo: 'Additional Information',
    source: 'Source: Created with the Impressum generator by eRecht24.',
  },
};
