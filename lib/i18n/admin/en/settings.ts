/**
 * Settings (`/admin/settings/<section>`): the editor shell, each section, the
 * privacy policy editor in Legal, and the shared form fields in
 * `app/admin/components/fields/` that other areas reuse.
 *
 * `{name}` placeholders are filled with markup by `rich()` — usually a
 * `<code>` element holding a file name or an environment variable, which stays
 * as it is in every language.
 */
export const settings = {
  editor: {
    /** The section nav on the left of the settings page. */
    sections: {
      general: 'General',
      theme: 'Theme',
      grid: 'Grid',
      footer: 'Footer',
      legal: 'Legal',
      seo: 'SEO',
      security: 'Security & Protection',
      about: 'About',
    },
    kicker: 'Site',
    title: 'Settings',
    description: 'Saved changes apply to the site at once, no restart needed.',
    /** Label of the save button in the floating save bar. */
    saveChanges: 'Save Changes',
    loadErrorTitle: 'Settings could not be loaded.',
    loadErrorBody:
      'Nothing has been changed. Saving stays disabled until they load, so an empty form cannot overwrite your configuration.',
    conflict: 'Not saved — the settings changed elsewhere.',
    /** Shown when the server confirms a save without a message of its own. */
    saved: 'Saved!',
    saveFailed: 'Failed to save',
  },

  general: {
    title: 'General Site Settings',
    sub: 'Configure basic site identity, language, and core feature toggles.',
    siteTitle: 'Site Title',
    siteTitleHint: 'Shown in the header, the browser tab and link previews.',
    /** `title` is what the site shows instead; `fromEnv` when SITE_TITLE supplied it. */
    siteTitleEmpty: (title: string, fromEnv: boolean) =>
      `Empty, so the site shows “${title}”${fromEnv ? ', from SITE_TITLE' : ''}.`,
    subtitle: 'Subtitle',
    subtitlePlaceholder: 'A visual journal',
    language: 'Language',
    /** {locales}: comma-separated language codes; {htmlLang}: the `<html lang>` attribute. */
    languageHint:
      'The visitor-facing interface is translated for {locales}. Other languages still set {htmlLang} and date formatting, but show the English interface. The admin panel has a language setting of its own, below.',
    adminLanguage: 'Admin panel language',
    adminLanguageSame: 'Same as site language',
    adminLanguageHint: 'The language of this admin panel. It changes once the settings are saved.',

    featuresTitle: 'Portfolio Features & Modules',
    featuresSub:
      'Optional pages, and what the site reveals about your photos and counts about visits.',
    modules: 'Modules',
    modulesDesc: 'Each one adds a page or a control visitors can use.',
    aboutPage: 'About page',
    aboutPageDesc: 'Portrait, bio and gear at /about',
    map: 'Map',
    mapDesc: 'Photo locations on a world map at /map',
    proofing: 'Client proofing',
    proofingDesc: 'Visitors heart, filter and export a selection of photos',
    zoom: 'Photo zoom',
    zoomDesc:
      'Visitors zoom into a photo to full resolution (1:1) to check sharpness. Pages and albums can override this',
    proofingEmail: 'Proofing email',
    proofingEmailPlaceholder: 'Defaults to the footer contact email',
    proofingEmailHint:
      'Where “Email to photographer” sends a selection. Falls back to the footer contact email; when neither is set, the button is hidden.',

    privacyGroup: 'What visitors learn about you',
    privacyGroupDesc: 'What each photo reveals, and what is counted about a visit.',
    /** Small chip beside the group title. */
    privacyGroupChip: 'visible to visitors',
    photoMetadata: 'Photo metadata',
    /** Parts of the one-line summary under "Photo metadata", joined with " · ". */
    metadataSummary: {
      camera: 'Camera & lens',
      exposure: 'Exposure',
      location: 'Location',
      description: 'Description',
      none: 'Nothing published — the lightbox hides its info panel',
    },
    details: 'Details',
    exifCamera: 'Camera & Lens',
    exifCameraDesc: 'Body, lens and focal length',
    exifSettings: 'Exposure Settings',
    exifSettingsDesc: 'Aperture, shutter speed and ISO',
    exifLocation: 'Location',
    exifLocationDesc: "City and country from the photo's GPS data",
    exifCaption: 'Photo Description',
    exifCaptionDesc: 'The description written in Immich',
    gridHover: 'Summary on grid hover',
    gridHoverDesc: 'Camera and lens over the photo, not only in the lightbox',
    gridHoverNeedsCamera: 'Needs Camera & Lens',
    analytics: 'Analytics',
    analyticsDesc: 'Cookieless view counts, stored on your server only',

    favicon: 'Favicon',
    faviconAlt: 'Current favicon',
    faviconUpload: 'Upload icon',
    faviconUploadFailed: 'Upload failed',
    faviconResetFailed: 'Reset failed',
    faviconResetTitle: 'Reset the favicon?',
    faviconResetMessage: 'The uploaded icon is deleted and the bundled default is used again.',
    faviconHint:
      'SVG, PNG, ICO, or JPEG — max 512 kB. Stored in the content volume. Reset restores the bundled default.',
  },

  theme: {
    title: 'Theme Presets & Color Mode',
    sub: 'Choose a typography preset and preview in Light or Dark mode.',
    visitorMode: 'Visitor Default Mode',
    visitorModeAria: 'Visitor default mode',
    modeDark: 'Dark',
    modeLight: 'Light',
    modeAuto: "Follow the visitor's system",
    visitorModeHint:
      'What a first-time visitor sees. The light/dark toggle in the site header still lets them choose, and their choice is remembered on their device. The preview below is your own, and does not change this.',
    preset: 'Preset',
    /** Under each preset card: font, corner radius and photo frame. */
    presetSpecs: (font: string, radius: number, frame: string) =>
      `${font} · radius ${radius} · ${frame}`,
    colorMode: 'Color Mode',
    /** {editorial}, {minimal}, {classic}: preset names, set in bold. */
    colorModeHint:
      'Presets like {editorial}, {minimal} & {classic} feature warm light/cream backgrounds in Light Mode and charcoal in Dark Mode.',
    lightMode: 'Light Mode (Cream / Beige)',
    darkMode: 'Dark Mode (Charcoal)',
    accentTitle: 'Accent Color',
    accentSub: 'Pick a primary accent color for links, buttons, and highlights.',
    /** Tooltips on the accent colour swatches. */
    swatches: {
      studioRed: 'Studio Red',
      editorialGold: 'Editorial Gold',
      emerald: 'Emerald',
      sapphire: 'Sapphire',
      violet: 'Violet',
      white: 'Monochrome White',
      black: 'Obsidian Black',
    },
    accentAria: 'Accent colour',
    accentHexAria: 'Accent colour (hex)',
    frameTitle: 'Photo Frame & Layout',
    frameSub: 'Customize image presentation borders and hero layouts.',
    photoFrame: 'Photo Frame',
    photoFrames: {
      none: { label: 'None', desc: 'Flush image with crisp edges' },
      passepartout: { label: 'Passepartout', desc: 'Classic gallery matting border' },
      shadow: { label: 'Shadow', desc: 'Soft floating drop shadow' },
    },
    heroStyle: 'Hero Style',
    heroStyles: {
      split: { label: 'Split', desc: 'Side-by-side title & photo' },
      fullbleed: { label: 'Fullbleed', desc: 'Edge-to-edge full width banner' },
      minimal: { label: 'Minimal', desc: 'Centered title with subtle photo' },
      stacked: { label: 'Stacked', desc: 'Title stacked directly over photo' },
      typographic: { label: 'Typographic', desc: 'Oversized text masthead, no photos' },
      mosaic: { label: 'Mosaic', desc: 'Dynamic photo collage layout' },
      cover: { label: 'Cover (Experimental)', desc: 'Fullscreen splash with a single Enter link' },
    },
    lookTitle: 'Look & motion',
    lookSub: 'Effects and small controls on every page.',
    transitions: 'Page transitions',
    transitionsDesc: 'A short fade between pages',
    scrollToTop: 'Scroll-to-top button',
    scrollToTopDesc: 'A floating arrow on long pages',
    grain: 'Film grain',
    grainDesc: 'Analog noise over the background',
    headerDot: 'Header accent dot',
    headerDotDesc: 'A dot beside the active section heading',
  },

  grid: {
    title: 'Grid & Layout Engine',
    sub: 'Configure photography gallery column structures and thumbnail aspect ratios.',
    layout: 'Layout Algorithm',
    layouts: {
      masonry: { label: 'Masonry', desc: 'Dynamic pinterest-style staggered columns' },
      uniform: { label: 'Uniform Grid', desc: 'Clean equal aspect ratio grid' },
      showcase: { label: 'Showcase', desc: 'Featured hero photos mixed with smaller tiles' },
      filmstrip: { label: 'Filmstrip', desc: 'Horizontal scrollable film strip timeline' },
      'editorial-flow': {
        label: 'Editorial Flow',
        desc: 'Magazine story layout with varying photo sizes',
      },
      justified: {
        label: 'Justified (Experimental)',
        desc: 'Equal-height rows that fill the full width',
      },
    },
    aspectRatio: 'Aspect Ratio',
    /** Keyed by the ratio value written to settings.yaml. */
    aspectRatios: {
      '1': { label: 'Square (1:1)', desc: '1:1 ratio square crops' },
      '3/2': { label: 'Landscape (3:2)', desc: 'Standard 35mm DSLR landscape' },
      '2/3': { label: 'Portrait (2:3)', desc: 'Vertical portrait orientation' },
      '16/9': { label: 'Cinema (16:9)', desc: 'Widescreen 16:9 cinematic ratio' },
      auto: { label: 'Original Auto', desc: 'Uncropped original image proportions' },
    },
    spacingTitle: 'Spacing & Columns',
    spacingSub:
      'Adjust column counts and grid gap spacing. The column count also tiles the album covers on a subpage; their spacing stays with the theme unless a page overrides it.',
    columns: (min: number, max: number) => `Columns (${min} - ${max})`,
    gap: 'Gap Spacing (px)',
  },

  footer: {
    title: 'Footer & Social Links',
    sub: 'Display branding, Instagram, email and website links in portfolio footer.',
    brandName: 'Footer Brand Name',
    brandNamePlaceholder: 'My Photography',
    instagram: 'Instagram URL',
    email: 'Contact Email',
    website: 'Personal Website',
    navTitle: 'Header Navigation Links (Experimental)',
    navSub:
      'External links shown after your pages in the header menu. Only http(s) URLs are allowed; they open in a new tab.',
    linkLabel: 'Label',
    /** Example label for an external header link. */
    linkLabelPlaceholder: 'Shop',
    linkUrl: 'URL',
    removeLink: 'Remove link',
    addLink: '+ Add external link',
  },

  legal: {
    title: 'Legal Notice & Impressum',
    sub: 'Configure the legal disclosure page required by the German Digitale-Dienste-Gesetz (DDG).',
    view: 'View /impressum ↗',
    enable: 'Enable Impressum Page (/impressum)',
    enableDesc: 'Automatically generates and links /impressum in footer',
    heading: 'Heading',
    headingHint:
      'Leave empty for the § 5 DDG line in the site language. Set it when a different law applies, e.g. § 5 ECG in Austria.',
    name: 'Full Name / Business Name',
    address: 'Street Address',
    zipCity: 'ZIP & City',
    country: 'Country',
    countryPlaceholder: 'Germany',
    email: 'Legal Email',
    phone: 'Phone Number',
    contactUrl: 'Contact Form URL',
    contactUrlInvalid: 'Must start with https:// or http://. Any other link is left off the page.',
    contactLabel: 'Contact Link Text',
    contactLabelPlaceholder: 'Contact form',
    vatId: 'VAT ID',
    taxId: 'Tax Number',
    extraInfo: 'Additional Disclosures',
    contactForm: 'Contact Form (/contact)',
    contactFormDesc: 'Messages are stored on this server and read under Messages. No mail is sent.',
    notifyUrl: 'Notification URL (ntfy)',
    notifyUrlInvalid: 'Must start with https:// or http://.',
    notifyUrlHint:
      'Gets a fixed "new message" push, with nothing about the sender. Pick a topic name nobody can guess.',
    /** `variable` is the environment variable's name. */
    notifyUrlEnvOverride: (variable: string) => `${variable} overrides this.`,
    retention: 'Delete messages after (days)',
    privacy: 'Privacy Policy (/privacy)',
    privacyDesc: 'Shown and linked in the footer once the text below is saved',
  },

  seo: {
    title: 'Search Engine Optimization (SEO)',
    sub: 'Customize search engine metadata, OpenGraph tags, and indexing rules.',
    snippetPreview: 'Google Search Result Preview',
    /** Stand-ins in the search preview while the fields are empty. */
    snippetTitle: 'My Photography Portfolio',
    snippetDesc: 'A curated selection of photography work.',
    siteUrl: 'Site URL',
    /** {sitemap}: the file name sitemap.xml. */
    siteUrlHint:
      'Needed for {sitemap}, the feed and structured data — those are generated without a request, so the address cannot be derived from it. Leave empty and the sitemap stays empty rather than guessing.',
    /** {variable}: SITE_URL; {value}: the URL it holds. */
    siteUrlFromEnv:
      'Currently supplied by the {variable} environment variable ({value}). A value entered here takes precedence once saved.',
    metaTitle: 'SEO Meta Title',
    metaTitlePlaceholder: 'Overrides default site title for Google search results',
    titleTemplate: 'Subpage Title Template',
    /** Site name used in the template example while no title is set. */
    titleTemplateFallback: 'My Portfolio',
    /** {placeholder}: the literal `%s`. */
    titleTemplateHint:
      'Template for subpages & albums. Use {placeholder} as placeholder for the page title.',
    previewLabel: 'Preview:',
    /** Example page title put into the template preview. */
    previewExample: 'Landscapes',
    metaDescription: 'SEO Meta Description',
    metaDescriptionPlaceholder: 'A curated selection of photography work...',
    crawlerTitle: 'Search Crawler Directives',
    crawlerSub: 'Control how Googlebot and other web crawlers index your site.',
    noIndex: 'noindex (Hide from Google)',
    noIndexDesc: 'Instructs search engines NOT to index this site in search results',
    noFollow: 'nofollow (Block Link Following)',
    noFollowDesc: 'Instructs search engine crawlers not to follow outgoing links',
  },

  security: {
    title: 'Site Password',
    sub: 'Puts the whole public site behind one password — useful while a portfolio is still being built, or for a folio only ever shown to clients.',
    sitePassword: 'Site Password',
    sitePasswordAria: 'Site password',
    sitePasswordPlaceholder: 'Leave empty for a public site',
    /** {hash}: the `scrypt:…` prefix; {file}: settings.yaml. */
    storedHashed: 'Stored as a {hash} hash in {file}, never as typed.',
    /** {variable}: SITE_PASSWORD. */
    envOverride: 'The {variable} environment variable overrides this field.',
    adminSeparate: 'The admin panel keeps its own password and is never behind this gate.',
    protectionTitle: 'Asset Protection & Watermark',
    protectionSub:
      'Configure image protection rules, right-click prevention, and watermark overlay.',
    rightClick: 'Disable Right-Click Menu',
    rightClickDesc: 'Prevents context menu on portfolio images to hinder unauthorized downloads',
    imageDrag: 'Disable Image Dragging',
    imageDragDesc: 'Prevents visitors from dragging images off the portfolio page',
    watermarkTitle: 'Dynamic Watermark Overlay',
    watermarkSub: 'Overlay copyright branding text on Lightbox images.',
    watermarkEnable: 'Enable Watermark',
    watermarkEnableDesc: 'Overlay copyright text on portfolio image views',
    watermarkText: 'Watermark Text',
    position: 'Position',
    positionAria: 'Watermark position',
    positionBottomRight: 'Bottom Right',
    positionBottomLeft: 'Bottom Left',
    positionCenter: 'Center Overlay',
    opacity: (percent: number) => `Opacity (${percent}%)`,
  },

  about: {
    title: 'About Page',
    sub: 'Edit the portrait, biography and gear shown on the About page. Use General to show or hide the page itself.',
    portrait: 'Portrait Asset ID',
    portraitPlaceholder: 'Immich asset UUID for the portrait photo',
    name: 'Name',
    namePlaceholder: 'Your name',
    location: 'Location',
    locationPlaceholder: 'City, Country',
    gear: 'Gear (one per line)',
    biography: 'Biography (Markdown)',
    biographyPlaceholder: 'Photographer based in...',
    conflict: 'Not saved — the About page changed elsewhere.',
  },

  privacy: {
    /** `error` is a short technical reason, e.g. "HTTP 500". */
    loadError: (error: string) =>
      `The privacy policy could not be loaded (${error}). Reload the page to try again.`,
    conflict: 'Not saved — the policy changed elsewhere.',
    saveFailed: (status: number) => `Could not save (HTTP ${status}).`,
    saved: 'Privacy policy saved.',
    unreachable: 'Could not reach the server.',
    factsTitle: 'What this site processes',
    factsHint:
      'Read off your current configuration. A checklist for writing the policy, not text for the page.',
    /** Badge beside a processing fact that involves an outside service. */
    thirdParty: 'third party',
    body: 'Privacy policy (Markdown)',
    /** Example text in the empty editor; keep the Markdown heading. */
    bodyPlaceholder: '## Controller\n\nName, address, email…',
    /** {heading}, {list}, {bold}, {link}: Markdown syntax examples in code style. */
    syntaxHint:
      'Headings with {heading}, lists with {list}, {bold} and {link}. Shown at /privacy and linked in the footer once there is text. Earlier versions are kept under Backups.',
    insertHeadings: 'Insert headings',
    view: 'View /privacy ↗',
    save: 'Save privacy policy',
  },

  /** Form fields shared with the page builder and the journal. */
  fields: {
    /** Link beside a feature switch to its own settings page. */
    configure: 'Configure →',
    locked: 'Locked',
    /** {variable}: the environment variable's name. */
    envLockNote:
      'Set by {variable} in the environment. Change or unset it there; edits here would have no effect.',
    columnsPlaceholder: 'Columns (site default)',
    columnsAria: 'Columns',
    gapPlaceholder: 'Gap in px (theme default)',
    gapAria: 'Gap in px',
    passwordPlaceholder: 'Leave empty for public access',
    passwordProtected: 'Protected',
    passwordChange: 'Change',
    passwordNew: 'New password',
    passwordHide: 'Hide password',
    passwordShow: 'Show password',
    passwordKeep: 'Keep current password',
    zoom: 'Photo zoom',
    zoomOn: 'On — visitors can zoom to full resolution',
    zoomOff: 'Off',
  },
};
