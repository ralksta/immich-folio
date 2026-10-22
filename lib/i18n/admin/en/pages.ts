/**
 * Admin → Pages: the page builder (home page hero, standalone albums,
 * subpages, content pages), its drawers and the photo-essay block editor.
 *
 * File names (gallery.yaml, content/pages/), CSS values and units in the
 * strings below are literal — keep them as written.
 */
export const pages = {
  /** The page header above the builder. */
  header: {
    kicker: 'Content',
    title: 'Pages',
    description:
      'The home page hero, standalone albums, subpages and content pages. Drag to reorder; changes go live when saved.',
  },

  builder: {
    albumListFailed: (error: string) =>
      `Immich albums did not load, so the album picker is empty. ${error}`,
    pageListFailed: (error: string) =>
      `The content pages did not load; their menu entries stay as they are. ${error}`,
    sessionExpired: 'Your session has expired. Sign in again to continue.',
    serverAnswered: (status: number) => `The server answered ${status}.`,
    loadFailed: 'The page structure could not be loaded.',
    loadFailedNote:
      'Nothing has been changed. Saving stays disabled until it loads, so an empty builder cannot overwrite your gallery.',
    notSavedConflict: 'Not saved — gallery.yaml changed elsewhere.',
    saved: 'Saved successfully!',
    /** Inserted into "Error: …" (common.errorWith). */
    saveFailed: 'Failed to save',
    saveChanges: 'Save Changes',
    createFailed: 'Failed to create the page',
    createdInMenu: 'Page created as a draft. Save Changes to put it in the menu.',
    created: 'Page created as a draft.',
    createOffline: 'Could not create the page. Check the connection and try again.',
    /** Toasts after a removal; each offers `undo`. */
    pageRemoved: 'Page removed.',
    albumRemoved: 'Album removed.',
    albumRemovedFromPage: 'Album removed from the page.',
    albumRemovedFromSection: 'Album removed from the section.',
    heroRemoved: 'Hero photo removed.',
    undo: 'Undo',
    undoFailed: 'Could not undo: the page structure changed since. Nothing is saved yet.',
    /** What screen readers call a dragged item ("Picked up page "Travel"."). */
    drag: {
      page: (name: string) => `page "${name}"`,
      untitled: 'Untitled',
      hero: (n: number) => `homepage hero photo ${n}`,
      album: (name: string) => `album "${name}"`,
      item: 'item',
    },
    /** The structure list on the left. */
    tree: 'Page structure',
    searchLabel: 'Search albums or subpages',
    searchPlaceholder: 'Search albums or subpages...',
    clearSearch: 'Clear search',
    homePage: 'Home page',
    heroPhotos: 'Hero photos',
    menu: 'Menu',
    subpagesLive: (live: number, total: number) => `${live} of ${total} subpages live`,
    noMatches: 'No matching entries.',
    newSubpage: 'New subpage',
    newPage: 'New page',
    notInMenu: 'Not in menu',
    offMenuEmpty:
      'Pages reachable only by their link. Drag a page here to take it out of the menu.',
    standaloneGroup: 'Standalone albums',
    onHomePage: 'On the home page',
    /** The panel for standalone albums. */
    standaloneHeading: 'Standalone Albums',
    addAlbum: '+ Add Album',
    noMatchingStandalone: 'No matching standalone albums found.',
    noStandalone: 'No standalone albums. These show directly on the homepage.',
    /** The panel for the home page hero. */
    addHero: 'Add Hero',
    heroPickerTitle: 'Pick Hero Images for Homepage',
    noHero: 'No hero images configured. Add photos to show a hero carousel on the homepage.',
  },

  /** Seed values for a new subpage or section, written into gallery.yaml. */
  defaults: {
    subpageName: (n: number) => `New subpage ${n}`,
    sectionTitle: 'New Section',
  },

  /** The per-album photo order (Listbox options and the card's badge tooltip). */
  sort: {
    immich: 'Immich order (default)',
    newest: 'Newest first',
    oldest: 'Oldest first',
    filename: 'Filename',
    manual: 'Manual',
  },

  albumCard: {
    reorder: (name: string) => `Reorder ${name}`,
    dragToReorder: 'Drag to reorder',
    editDetails: 'Edit details',
    removeAlbum: 'Remove album',
    passwordProtected: 'Password protected',
    customHero: 'Custom Hero Image set',
    /** `label` is one of the `sort` labels. */
    photoOrder: (label: string) => `Photo order: ${label}`,
    /** English deliberately says "photos" for every count here. */
    photos: (n: number) => `${n} photos`,
  },

  albumDrawer: {
    heading: 'Edit Album Details',
    close: 'Close details',
    photos: (n: number) => `${n} ${n === 1 ? 'photo' : 'photos'}`,
    /** Shown after the photo count when the title is overridden. */
    original: (name: string) => `Original: ${name}`,
    titleOverride: 'Title override',
    description: 'Description',
    descriptionPlaceholder: 'Optional description for visitors',
    passwordProtection: 'Password protection',
    albumPassword: 'Album password',
    downloads: 'Downloads',
    allowDownloads: 'Allow original downloads',
    allowDownloadsDesc: 'Visitors can download the whole album or their selected photos as a ZIP',
    zoomInherit: 'Inherit from page / site settings',
    zoomHint:
      "Lets visitors zoom into a photo in the viewer to check sharpness. JPEG and AVIF originals are shown without their GPS data; HEIC and RAW need Immich's full-size previews. PNG, WebP, GIF and photos edited in Immich are never zoomed. Applies where the album is listed here.",
    layoutOverride: 'Layout override (Experimental)',
    layoutOverrideAria: 'Layout override',
    layoutInherit: 'Inherit from page / global settings',
    layouts: {
      masonry: 'Masonry',
      uniform: 'Uniform Grid',
      showcase: 'Showcase',
      filmstrip: 'Filmstrip',
      editorialFlow: 'Editorial Flow',
      justified: 'Justified (Experimental)',
    },
    coverFocalPoint: 'Cover focal point (Experimental)',
    /** "50% 25%" and "top" are CSS values; keep them as written. */
    coverFocalPointPlaceholder: 'e.g. "50% 25%" or "top" — where the cover crop should anchor',
    customHero: 'Custom Hero Image',
    heroAlt: 'Hero',
    removeHero: 'Remove custom hero image',
    defaultCover: 'Using default album cover',
    pickHeroTitle: (name: string) => `Pick Hero Image for ${name}`,
    changeImage: 'Change Image',
    pickHero: 'Pick Hero Image',
    photoOrder: 'Photo order',
    manualHint:
      'Pinned photos come first, in the order you set. Everything else follows in the album’s Immich order.',
    immichHint: 'Immich order follows the album’s own sort setting in Immich.',
    reorderPhotos: 'Reorder photos',
    reorderPhotosPinned: (n: number) => `Reorder photos (${n} pinned)`,
    removeAlbum: 'Remove Album',
    uuidTitle: 'Immich album UUID',
    copyUuid: 'Copy UUID',
    copyUuidAria: 'Copy Immich album UUID',
    done: 'Done',
  },

  subpageDrawer: {
    breadcrumb: 'Pages / Subpages',
    untitled: 'Untitled Page',
    /** Accessible name of the Edit / Live Preview switch. */
    view: 'View',
    livePreview: 'Live Preview',
    openLive: 'Open live page in new tab (bypassing cache)',
    close: 'Close drawer',
    pageName: 'Page Name (URL Identifier)',
    pageNamePlaceholder: 'e.g. dubai, travel, weddings',
    displayTitle: 'Display Title (optional)',
    /** Sits in a half-width field; keep it short. */
    displayTitlePlaceholder: 'Same as page name',
    subtitle: 'Subtitle',
    subtitlePlaceholder: 'Subtitle text',
    visibility: 'Visibility & Access',
    visibilityOptions: {
      published: {
        title: 'Published',
        desc: 'Shown in the header menu and homepage lists, reachable via URL',
      },
      unlisted: {
        title: 'Unlisted (Experimental)',
        desc: 'Not shown in menus or on the homepage, but reachable via direct link',
      },
      disabled: {
        title: 'Disabled',
        desc: 'Completely offline — returns 404 even when accessed directly',
      },
    },
    passwordPlaceholder: 'Password protection (optional) — leave empty for public access',
    pagePassword: 'Page password',
    layoutStyle: 'Page Layout Style',
    layoutStyleAria: 'Page layout style',
    /** Options of a <select>: plain text only. */
    layouts: {
      masonry: 'Masonry Grid (Dynamic Height)',
      uniform: 'Uniform Grid (Square Tiles)',
      showcase: 'Showcase (Featured First Asset)',
      filmstrip: 'Filmstrip (Horizontal Scroll)',
      editorialFlow: 'Editorial Flow',
      essay: 'Photo Essay Mode (Storytelling Editor)',
    },
    zoomInherit: 'Inherit from site settings',
    zoomHint:
      'Applies to every album on this page that does not set its own. Settings › General has the site-wide switch.',
    coverGrid: 'Album Cover Grid',
    coverGridHint:
      "Overrides how the album covers are tiled on this page — the photos inside the albums are not affected. Leave the column count empty to follow the site-wide grid setting, and the gap empty to keep the theme's own spacing. Tablet widths show at most two covers per row.",
    photoGrid: 'Photo Grid (Albums On This Page)',
    photoGridHint:
      'How the photos inside every album on this page are laid out. Leave both empty to follow Settings › Grid; a single album can still override this in gallery.yaml.',
    essayHeading: 'Storytelling & Photo Essay Builder',
    essayIntro: 'Compose text, quotes, and fullbleed/wide photos visually.',
    essayPickerTitle: 'Select Photo for Photo Essay',
    albums: 'Albums in this Page',
    addAlbum: '+ Add Album',
    noAlbums: 'No albums added yet. Click + Add Album to pick from Immich.',
    /** Placeholder and accessible name of a section's title field. */
    sectionTitle: 'Section title',
    removeSection: 'Remove section',
    sectionDescPlaceholder: 'Section description (optional)',
    sectionDesc: 'Section description',
    addSection: '+ Add Section',
    addLooseAlbum: '+ Add Loose Album',
    deleteSubpage: 'Delete Subpage',
    done: 'Done',
  },

  /** The subpage drawer's Live Preview tab. */
  preview: {
    note: 'Rendered with the site’s saved theme preset at desktop width. Unsaved edits in this drawer show up here; theme changes show up once saved in Settings.',
    settingsFailed: (error: string) =>
      `The preview uses the default grid and English until the site settings load. ${error}`,
  },

  /** Rows and tiles of the structure list. */
  tiles: {
    reorderHero: (n: number) => `Reorder hero photo ${n}`,
    reorder: (name: string) => `Reorder ${name}`,
    /** Stands in for a subpage without a name in `reorder`. */
    pageFallback: 'page',
    dragToReorder: 'Drag to reorder',
    disabledTitle: 'Page is disabled',
    disabled: 'Disabled',
    unlistedTitle: 'Hidden from navigation, reachable by direct link',
    /** Short state badges in a list row; one word. */
    unlisted: 'Unlisted',
    off: 'Off',
    missing: 'Missing',
    draft: 'Draft',
    /** Tag marking a content page, as opposed to a subpage; one short word. */
    page: 'Page',
    passwordProtected: 'Password protected',
    password: 'Password',
    editPage: 'Edit Page',
    albums: (n: number) => `${n} album${n !== 1 ? 's' : ''}`,
  },

  newPage: {
    title: 'New page',
    titleLabel: 'Title',
    titlePlaceholder: 'e.g. Pricing',
    url: 'URL',
    /** An example slug: lowercase letters, digits and dashes only. */
    slugPlaceholder: 'pricing',
    /** Shown as "/slug" while no slug is typed; same rules as above. */
    slugFallback: 'slug',
    exists: (slug: string) => `A page "${slug}" already exists.`,
    hint: 'Starts blank and as a draft. You can change the URL later.',
    showInMenu: 'Show in menu',
    showInMenuDesc: 'Adds it to the end of the menu; saved with “Save Changes”.',
    creating: 'Creating…',
    create: 'Create page',
  },

  pagePanel: {
    noFile: 'There is no file for this page in content/pages/.',
    serverAnswered: (status: number) => `The server answered ${status}.`,
    couldNotLoad: 'Could not load.',
    exists: (slug: string) => `A page "${slug}" already exists.`,
    moveTitle: (slug: string) => `Move this page to /${slug}?`,
    linksBreak: (slug: string) =>
      `Links to /${slug} will stop working. There is no automatic redirect.`,
    movePage: 'Move page',
    notSavedConflict: 'Not saved — the page changed elsewhere. Your edits are still here.',
    saveFailed: 'Failed to save the page',
    saved: 'Page saved.',
    saveOffline: 'Could not save the page. Check the connection and try again.',
    deleteTitle: (name: string) => `Delete “${name}”?`,
    deleteMessageInMenu:
      'The page is also removed from the menu in gallery.yaml. Both files are backed up first and can be restored under Backups.',
    deleteMessage: 'A copy is kept and can be restored under Backups.',
    deletePage: 'Delete page',
    deleteFailed: 'Failed to delete the page',
    deleted: 'Page deleted.',
    deleteOffline: 'Could not delete the page. Check the connection and try again.',
    loadFailed: 'This page could not be loaded.',
    menuStillLists:
      'The menu still lists it. Switch off “Show in menu” and save the structure to remove the entry.',
    removeFromMenu: 'Remove from menu',
    openLive: 'Open the live page in a new tab',
    title: 'Title',
    url: 'URL',
    slugHint: 'Checked against subpages, albums, journal entries and built-in routes.',
    showInMenu: 'Show in menu',
    inMenuDesc: 'Listed in the header menu. Drag it in the structure list to move it.',
    offMenuDesc: 'Not in the menu, but reachable at its URL — for pages shared by link.',
    /** Follows `inMenuDesc` / `offMenuDesc`. */
    savedWithStructure: 'Saved with “Save Changes”.',
    draft: 'Draft',
    draftDesc: 'Only you can see a draft. It stays out of the menu and the sitemap.',
    password: 'Password (optional)',
    pagePassword: 'Page password',
    seoDescription: 'SEO description',
    seoPlaceholder: 'One or two sentences for search engines and link previews',
    editContent: 'Edit content →',
    savePage: 'Save page',
  },

  /** The photo-essay block editor in a subpage set to "Photo Essay Mode". */
  essay: {
    /** The starting story of an empty essay: a "# heading" and a paragraph. */
    starterTitle: 'Title',
    starterBody: 'Write your story here...',
    /** Text a newly added block starts with. */
    newHeading: 'New Section Heading',
    newParagraph: 'Enter text paragraph here...',
    newQuote: 'Enter quote text here...',
    toolbar: 'Add Story Block:',
    add: {
      paragraph: '+ Paragraph',
      heading: '+ Heading',
      quote: '+ Pullquote',
      facts: '+ Facts',
      photo: '+ Photo',
      photoPair: '+ 2-Photo Pair',
      photoGrid: '+ Photo Grid',
      album: '+ Album',
      map: '+ Map',
    },
    empty: 'No story blocks yet. Use the buttons above to build your photo essay!',
    moveUp: 'Move Up',
    moveDown: 'Move Down',
    deleteBlock: 'Delete Block',
    headingLevel: 'Heading level',
    headingPlaceholder: 'Section heading...',
    /** `**bold**` and `*italic*` are markdown syntax; keep the asterisks. */
    paragraphPlaceholder: 'Write text paragraph... (**bold**, *italic* markdown supported)',
    quotePlaceholder: 'Quote text...',
    authorPlaceholder: '— Author / Attribution (optional)',
    noPhoto: 'No Photo',
    changePhoto: 'Change Photo',
    selectPhoto: 'Select Photo',
    /** Width options of a photo block; the measures are CSS units. */
    contained: 'Contained (68ch)',
    wide: 'Wide (1100px)',
    fullbleed: 'Fullbleed (100vw)',
    assetUuidPlaceholder: 'Immich Asset UUID...',
    photoCaption: 'Photo caption (optional)',
    photoN: (n: number) => `Photo ${n}`,
    selectPhotoN: (n: number) => `Select Photo ${n}`,
    uuidN: (n: number) => `UUID ${n}...`,
    swapPhotos: 'Swap Photo 1 & Photo 2',
    pairCaption: 'Side-by-side caption (optional)',
    removePhoto: 'Remove photo',
    select: 'Select',
    change: 'Change',
    addPhoto: 'Add photo',
    gridCaption: 'Grid caption (optional)',
    factLabel: 'Label, e.g. Distance',
    factValue: 'Value, e.g. 21 km',
    removeFact: 'Remove fact',
    addFact: 'Add fact',
    albumUuidPlaceholder: 'Immich album UUID (the album picker in Pages shows ids)',
    countPlaceholder: 'Count (all)',
    count: 'Count',
    skipPlaceholder: 'Skip (0)',
    skip: 'Skip',
    layout: 'Layout',
    albumLayouts: {
      grid: 'Grid (rows of three)',
      pairs: 'Pairs (rows of two)',
      wide: 'Wide (one per row)',
    },
    albumCaption: 'Caption for the set (optional)',
    albumHint:
      "Expanded into photo blocks when the page renders — the album's order, a manual gallery order first. Leave count empty for the whole album.",
    mapCaption: 'Caption, e.g. Busan → Seoul (optional)',
    pointLabel: 'Label (optional)',
    latitude: 'Latitude',
    /** Placeholders of the latitude / longitude fields; keep them short. */
    lat: 'Lat',
    longitude: 'Longitude',
    lng: 'Lng',
    photoUuidPlaceholder: 'Photo UUID...',
    allPhotosItem: "All geotagged photos of this page's albums, in order",
    removePin: 'Remove pin',
    invalidPoint:
      'A point needs a latitude within ±90 and a longitude within ±180; points without valid coordinates are not saved.',
    addPoint: 'Point',
    addPhotoPin: 'Photo pin',
    addAllPhotos: 'All geotagged photos',
    connectLine: 'Connect pins with a line',
    mapHint:
      "Typed points are published as typed. Photo pins are placed from the photo's GPS on the live page, under the album's location precision. Renders only while the map is enabled in Settings.",
  },
  /** Why a page slug is taken (lib/pages.ts describeCollision); also shown in Diagnostics. */
  collision: {
    invalid: (slug: string) =>
      `"${slug}" is not a valid slug: use letters, digits, "-" and "_" only.`,
    reserved: (slug: string) => `/${slug} is a built-in route of the site.`,
    subpage: (slug: string) => `/${slug} is already a subpage.`,
    album: (slug: string) => `/${slug} is already a standalone album.`,
    journal: (slug: string) => `A journal entry already uses the slug "${slug}".`,
  },
};
