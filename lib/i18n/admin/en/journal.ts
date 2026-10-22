/**
 * The journal studio: the entry list, the create dialog, the block editor
 * (also used for content pages), its settings and the live preview.
 */
export const journal = {
  studio: {
    /** The page header's kicker. */
    kicker: 'Content',
    title: 'Journal',
    description: 'Stories, field notes and longform photo essays, written with a live preview.',
    newEntry: 'New Journal Entry',
    emptyTitle: 'No journal entries yet',
    emptyText: 'Create your first story to share travel journals or wedding reportages.',
    createFirst: 'Create First Entry',
    /** Reading time on an entry card. */
    readingTime: (minutes: number) => `${minutes} min`,
    draft: 'Draft',
    published: 'Published',
    /** Shown on a card when the entry has a password. */
    password: 'Password',
    editInStudio: 'Edit in Studio',
    viewLive: 'View live page',
    /** The delete button's tooltip and the confirm dialog's button. */
    deleteEntry: 'Delete entry',
    deleteTitle: (name: string) => `Delete “${name}”?`,
    deleteMessage: 'A copy is kept and can be restored under Backups.',
    deleteFailed: 'Failed to delete journal entry',
    deleteError: 'Could not delete the journal entry. Check the connection and try again.',
    createFailed: 'Failed to create journal entry',
    createError: 'Could not create the journal entry. Check the connection and try again.',
    albumsError: 'Could not load albums. Check the Immich connection and try again.',

    create: {
      title: 'Create New Journal Entry',
      titleLabel: 'Title',
      titlePlaceholder: 'e.g. Expedition Nordkap',
      slugLabel: 'URL Slug',
      slugPlaceholder: 'e.g. expedition-nordkap',
      /** `slug` is the entry's slug, or `slugFallback` while it is empty. */
      slugHint: (slug: string) => `Will be accessible at /journal/${slug}`,
      slugFallback: 'slug',
      startFrom: 'Start from',
      startFromLabel: 'Journal starting point',
      tabTemplates: 'Templates',
      tabAlbums: 'Albums',
      blank: 'Blank',
      blankDescription: 'Start with an empty editor.',
      loadingAlbums: 'Loading albums...',
      changeAlbum: 'Change album',
      selectAlbum: 'Select album',
      choosePhotos: 'Choose photos',
      choosePhotosSelected: (n: number) => `Choose photos (${n} selected)`,
      selectedPhotos: 'Selected photos',
      albumNote: 'Only the photos you select from this album will be added to the journal.',
      pickerTitle: 'Choose photos from this album',
      creating: 'Creating...',
      submit: 'Create & Open Studio',
    },
  },

  /**
   * The names and descriptions of the starting templates, by template id
   * (`lib/journalTemplates.ts`). The blocks a template inserts stay as written.
   */
  templates: {
    wedding: {
      name: 'Wedding',
      description:
        'Date and venue up front, one hero image, a line from the vows, the party as a grid.',
    },
    hiking: {
      name: 'Hiking / Outdoor',
      description: 'Distance and elevation as facts, the trail as a grid, the route on a map.',
    },
    travel: {
      name: 'Travel',
      description: 'The trip on a map, then one stop per section with two photos each.',
    },
    birthday: {
      name: 'Birthday / Family',
      description: 'Almost no text — the whole album as a grid and one full-bleed frame.',
    },
    'portrait-session': {
      name: 'Portrait Session',
      description: 'Solo wide frames with room to breathe, and a line in their own words.',
    },
    'behind-the-scenes': {
      name: 'Behind the Scenes',
      description: 'Setup and shoot as a pair, then the finished result to land on.',
    },
    pets: {
      name: 'Pets',
      description: 'Candid pairs, one close-up portrait with personality.',
    },
    'new-series': {
      name: 'New Series',
      description: 'Opens on a statement, then photo-and-text pairs introducing the project.',
    },
  },

  /** The editor of one entry, also used for content pages. */
  editor: {
    sessionExpired: 'Your session has expired. Sign in again to continue.',
    serverAnswered: (status: number) => `The server answered ${status}.`,
    loadFailedFallback: 'The entry could not be loaded.',
    conflictKept: 'Not saved — it changed elsewhere. Your edits are still here.',
    saveFailed: 'Failed to save',
    saveErrorEntry: 'Could not save the entry. Check the connection and try again.',
    saveErrorPage: 'Could not save the page. Check the connection and try again.',
    openingEntry: 'Opening Journal Studio...',
    openingPage: 'Opening page editor...',
    loadFailedEntry: 'This entry could not be loaded.',
    loadFailedPage: 'This page could not be loaded.',
    albumListFailed: (error: string) => `Album list: ${error}`,
    loadFailedNote:
      'Nothing has been changed. Saving stays disabled until it loads, so an empty editor cannot overwrite it.',
    backToEntries: 'Back to entries',
    backToPages: 'Back to pages',
    /** The top bar's back button. */
    allEntries: '← All Entries',
    pages: '← Pages',
    storyTitlePlaceholder: 'Story Title...',
    storyTitleLabel: 'Story title',
    pageTitlePlaceholder: 'Page title...',
    pageTitleLabel: 'Page title',
    modeLabel: 'Editor mode',
    modeBlocks: 'Visual Blocks',
    modeMarkdown: 'Raw Markdown',
    storySettings: 'Story Settings',
    pageSettings: 'Page Settings',
    publish: 'Publish',
    unpublish: 'Unpublish',
    publishTitle: 'Publish the page and save it now',
    unpublishTitle: 'Turn the page back into a draft and save it now',
    /** Link to the published page. */
    live: 'Live',
    saving: 'Saving...',
    saveChanges: 'Save Changes',
    saved: 'Saved',
    markdownPlaceholder: 'Write Markdown here...',
    addBlock: 'Add Block:',
    addText: '+ Text',
    addHeading: '+ Heading',
    addQuote: '+ Quote',
    addFacts: '+ Facts',
    addPhoto: '+ Photo',
    addPhotos: '+ Photos',
    addPair: '+ 2-Photo Pair',
    addGrid: '+ Photo Grid',
    addAlbum: '+ Album',
    addMap: '+ Map',
    moveUp: 'Move block up',
    moveDown: 'Move block down',
    deleteBlock: 'Delete block',
    resize: 'Resize editor and preview',
  },

  /** Titles of the photo picker, by what it is opened for. */
  pickerTitles: {
    storyPhoto: 'Select Photo for Story',
    photos: 'Add Photos (one block each)',
    pair: 'Select Photos for Pair',
    pairPhoto: (n: number) => `Select Photo #${n} for Pair`,
    grid: 'Select Photos for Grid',
    gridPhoto: (n: number) => `Select Photo #${n} for Grid`,
    mapPhoto: 'Select a photo to place on the map',
    cover: 'Select Cover Photo',
  },

  /**
   * The text a new block starts with. It is written into the entry, so it is
   * in the panel's language at the time the block is added.
   */
  blockDefaults: {
    heading: 'New Heading',
    paragraph: 'Enter paragraph text here...',
    quote: 'Enter quote text...',
  },

  /** The fields of each block type. */
  blocks: {
    headingLevel: 'Heading level',
    text: 'Text',
    /** Keep the Markdown markers (`**`, `*`, `[…](…)`) as they are. */
    textPlaceholder: 'Text (**bold**, *italic*, [link](https://…))',
    quotePlaceholder: 'Quote text...',
    authorPlaceholder: 'Author attribution (optional)',
    legacyRef: (ref: string) =>
      `Reference "${ref}" is a legacy album position, not a photo. It will not appear on the published page — pick a photo below.`,
    legacyRefs: (refs: string[]) =>
      `References "${refs.join('", "')}" are legacy album positions, not photos. They will not appear on the published page — pick photos below.`,
    changePhoto: 'Change photo',
    pickPhoto: 'Pick a photo',
    /** An empty photo tile. */
    pick: '+ Pick',
    photoLayout: 'Photo layout',
    layoutContained: 'Contained (Column Width)',
    layoutWide: 'Wide (Expanded Width)',
    layoutFullbleed: 'Fullbleed (Edge to Edge)',
    changePhotoButton: 'Change Photo',
    captionPlaceholder: 'Caption (optional)',
    changePairPhoto: (n: number) => `Change photo ${n} of the pair`,
    pickPairPhoto: (n: number) => `Pick photo ${n} of the pair`,
    pickPairSlot: (n: number) => `+ Pick Photo #${n}`,
    pickBoth: 'Pick both photos',
    pairCaptionPlaceholder: 'Shared caption for pair (optional)',
    /** Alt text of a picked photo's thumbnail. */
    thumb: 'Thumb',
    pickGridSlot: (n: number) => `+ Pick #${n}`,
    removePhoto: (n: number) => `Remove photo #${n}`,
    addPhoto: 'Add photo',
    pickSeveral: 'Pick several',
    gridHint: 'Three or more photos, laid out in rows of three.',
    gridCaptionPlaceholder: 'Shared caption for grid (optional)',
    factLabelPlaceholder: 'Label, e.g. Distance',
    factValuePlaceholder: 'Value, e.g. 21 km',
    removeFact: (n: number) => `Remove fact #${n}`,
    addFact: 'Add fact',
    changeAlbum: 'Change album',
    pickAlbum: 'Pick album',
    albumPhotoCount: (n: number) => `${n} photos in album`,
    albumLoading: 'loading…',
    count: 'Count',
    /** Placeholder of the empty Count field: every photo. */
    countAll: 'all',
    skip: 'Skip',
    layout: 'Layout',
    albumLayoutGrid: 'Grid (rows of three)',
    albumLayoutPairs: 'Pairs (rows of two)',
    albumLayoutWide: 'Wide (one per row)',
    albumCaptionPlaceholder: 'Caption for the set (optional)',
    albumHint:
      "Photos follow the album's order (a manual order in the gallery comes first). Count and skip pick a slice; leave count empty for all.",
    mapOff:
      'The map is switched off in Settings → General. This block will not render until it is enabled.',
    mapCaptionPlaceholder: 'Caption, e.g. Busan → Seoul (optional)',
    pointLabelPlaceholder: 'Label (optional)',
    /** Short placeholders of the coordinate fields. */
    lat: 'Lat',
    latitude: 'Latitude',
    lng: 'Lng',
    longitude: 'Longitude',
    pickPhotoTile: '+ Pick photo',
    allPhotosItem: 'All geotagged photos of this entry, in order',
    movePinUp: 'Move pin up',
    movePinDown: 'Move pin down',
    removePin: 'Remove pin',
    invalidCoordinates:
      'A point needs a latitude within ±90 and a longitude within ±180. Points without valid coordinates are not saved.',
    addPoint: 'Point',
    addPhotoPin: 'Photo pin',
    addAllPhotos: 'All geotagged photos',
    connectLine: 'Connect pins with a line',
    mapHint:
      "Typed points show in the preview right away. Photo pins are placed on the live page from the photo's GPS, under the album's location precision.",
  },

  storySettings: {
    title: 'Story Settings & Metadata',
    subtitle: 'Subtitle',
    subtitlePlaceholder: 'e.g. Field notes from our winter journey',
    author: 'Author',
    authorPlaceholder: 'e.g. Ralf',
    date: 'Publish Date',
    cover: 'Cover Photo',
    coverAlt: 'Cover',
    chooseCover: 'Choose Cover',
    password: 'Password Protection (Optional)',
    draft: 'Keep as Draft (Hidden from public /journal list)',
    done: 'Done',
  },

  pageSettings: {
    title: 'Page settings',
    description: 'SEO description',
    descriptionPlaceholder: 'One or two sentences for search engines and link previews',
    draft: 'Draft',
    draftDescription: 'Only you can see a draft, and it stays out of the menu and the sitemap.',
    password: 'Password (optional)',
    passwordLabel: 'Page password',
    note: 'Settings are saved with the page. The URL and the menu place are set in Pages.',
  },

  preview: {
    label: 'Realtime Theme Preview',
    widthLabel: 'Preview width',
    desktop: 'Desktop',
    mobile: 'Mobile',
  },
};
