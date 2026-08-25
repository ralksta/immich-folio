/**
 * The lightbox's keyboard shortcuts, in one place (#473).
 *
 * Three things read this list: the `?` overlay the visitor sees, the help
 * section in the admin panel where the site owner finds out these keys exist
 * at all, and — since this commit — the viewer's own key handler.
 *
 * That last one is the point. The catalogue used to describe the keys while
 * the handler independently decided which ones it listened for, so a key added
 * to the viewer and forgotten here stayed exactly as undiscoverable as the
 * whole set was before, and nothing would have said so. Now a key reaches the
 * handler only by being declared here, and `LightboxAction` is a closed union
 * the handler switches over exhaustively: declaring an action the viewer does
 * not implement is a type error, not a silent gap.
 *
 * The labels stay out of here: they live in the dictionaries, and the two
 * dynamic ones (fullscreen flips, the slideshow names its speed) are resolved
 * by the viewer, which is the only place that knows the current state.
 */

/** What has to be true for a shortcut to do anything. */
export type ShortcutAvailability =
  /** Always present. */
  | 'always'
  /** Journal entries hide the EXIF toggle, so `i` does nothing there. */
  | 'exifPanel'
  /** Absent where the browser has no element fullscreen to give (iPhone). */
  | 'fullscreen'
  /** Only where the album offers its originals. */
  | 'download';

/**
 * What a key does. Closed on purpose: the viewer switches over this union
 * exhaustively, so adding a member without handling it fails to compile.
 */
export type LightboxAction =
  | 'close'
  | 'prev'
  | 'next'
  | 'info'
  | 'fullscreen'
  | 'slideshow'
  | 'copyLink'
  | 'download'
  | 'shortcutList';

export interface ShortcutBinding {
  /**
   * How the key is written in the two lists. Arrows are stored as names rather
   * than glyphs so the list survives an editor that mangles them; both
   * renderers ask for the display form via `shortcutKeyLabel()`.
   */
  display: string;
  /**
   * The exact `KeyboardEvent.key` values that trigger it, case variants
   * included. `?` is matched on the produced character, not the physical key:
   * Shift+/ on a US layout, Shift+ß on a German one.
   */
  eventKeys: readonly string[];
  action: LightboxAction;
}

export interface LightboxShortcut {
  bindings: readonly ShortcutBinding[];
  /** Key into the `lightbox` dictionary section. */
  labelKey:
    | 'shortcutNavigate'
    | 'shortcutInfo'
    | 'shortcutFullscreen'
    | 'shortcutSlideshow'
    | 'shortcutCopyLink'
    | 'shortcutDownload'
    | 'shortcutList'
    | 'shortcutClose';
  availability: ShortcutAvailability;
  /** Shown in the admin help to explain when the key is absent. */
  note?: string;
}

/** In the order they are worth learning. */
export const LIGHTBOX_SHORTCUTS: readonly LightboxShortcut[] = [
  {
    // One row, two actions: the arrows are learnt together but do opposite
    // things, which is why a binding carries the action rather than the row.
    bindings: [
      { display: 'ARROW_LEFT', eventKeys: ['ArrowLeft'], action: 'prev' },
      { display: 'ARROW_RIGHT', eventKeys: ['ArrowRight'], action: 'next' },
    ],
    labelKey: 'shortcutNavigate',
    availability: 'always',
  },
  {
    bindings: [{ display: 'I', eventKeys: ['i', 'I'], action: 'info' }],
    labelKey: 'shortcutInfo',
    availability: 'exifPanel',
    note: 'Hidden where every EXIF group is switched off, and in journal entries.',
  },
  {
    bindings: [{ display: 'F', eventKeys: ['f', 'F'], action: 'fullscreen' }],
    labelKey: 'shortcutFullscreen',
    availability: 'fullscreen',
    note: 'Absent on browsers with no element fullscreen, such as Safari on iPhone.',
  },
  {
    bindings: [{ display: 'S', eventKeys: ['s', 'S'], action: 'slideshow' }],
    labelKey: 'shortcutSlideshow',
    availability: 'always',
    note: 'Cycles off, 3s, 5s, 10s and back to off. Any arrow or swipe stops it.',
  },
  {
    bindings: [{ display: 'C', eventKeys: ['c', 'C'], action: 'copyLink' }],
    labelKey: 'shortcutCopyLink',
    availability: 'always',
    note: 'Copies a link to the photo on screen. Positional: reordering the album moves where it lands.',
  },
  {
    bindings: [{ display: 'D', eventKeys: ['d', 'D'], action: 'download' }],
    labelKey: 'shortcutDownload',
    availability: 'download',
    note: 'Only for albums with download: true in gallery.yaml.',
  },
  {
    // `h` is the escape hatch for layouts where `?` is awkward — and the one
    // key someone guesses without having been told.
    bindings: [
      { display: '?', eventKeys: ['?'], action: 'shortcutList' },
      { display: 'H', eventKeys: ['h', 'H'], action: 'shortcutList' },
    ],
    labelKey: 'shortcutList',
    availability: 'always',
  },
  {
    bindings: [{ display: 'Esc', eventKeys: ['Escape'], action: 'close' }],
    labelKey: 'shortcutClose',
    availability: 'always',
  },
];

/**
 * Arrow names to glyphs. Ordinary keys pass through, so both renderers can map
 * every display key through this without asking which kind it is.
 */
export function shortcutKeyLabel(key: string): string {
  if (key === 'ARROW_LEFT') return String.fromCharCode(0x2190);
  if (key === 'ARROW_RIGHT') return String.fromCharCode(0x2192);
  return key;
}

/** The keys of one shortcut, ready to render. */
export function shortcutDisplayKeys(shortcut: LightboxShortcut): string[] {
  return shortcut.bindings.map((binding) => shortcutKeyLabel(binding.display));
}

const ACTION_BY_EVENT_KEY: ReadonlyMap<string, LightboxAction> = new Map(
  LIGHTBOX_SHORTCUTS.flatMap((shortcut) =>
    shortcut.bindings.flatMap((binding) =>
      binding.eventKeys.map((key) => [key, binding.action] as const),
    ),
  ),
);

/**
 * What a `KeyboardEvent.key` should do, or null if the viewer does not bind it.
 *
 * This is the only route from a keypress to an action, so a key the catalogue
 * does not list cannot reach the viewer, and one it does list cannot be
 * silently missing from the help.
 */
export function lightboxActionFor(eventKey: string): LightboxAction | null {
  return ACTION_BY_EVENT_KEY.get(eventKey) ?? null;
}
