/**
 * The lightbox's keyboard shortcuts, in one place (#473).
 *
 * Two things render this list: the `?` overlay the visitor sees, and the help
 * section in the admin panel, where the site owner finds out these keys exist
 * at all. Spelling the set out twice is how the two would drift — a key added
 * to the viewer and forgotten in the help is exactly as undiscoverable as it
 * was before.
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

export interface LightboxShortcut {
  keys: string[];
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
  { keys: ['ARROW_LEFT', 'ARROW_RIGHT'], labelKey: 'shortcutNavigate', availability: 'always' },
  {
    keys: ['I'],
    labelKey: 'shortcutInfo',
    availability: 'exifPanel',
    note: 'Hidden where every EXIF group is switched off, and in journal entries.',
  },
  {
    keys: ['F'],
    labelKey: 'shortcutFullscreen',
    availability: 'fullscreen',
    note: 'Absent on browsers with no element fullscreen, such as Safari on iPhone.',
  },
  {
    keys: ['S'],
    labelKey: 'shortcutSlideshow',
    availability: 'always',
    note: 'Cycles off, 3s, 5s, 10s and back to off. Any arrow or swipe stops it.',
  },
  {
    keys: ['C'],
    labelKey: 'shortcutCopyLink',
    availability: 'always',
    note: 'Copies a link to the photo on screen. Positional: reordering the album moves where it lands.',
  },
  {
    keys: ['D'],
    labelKey: 'shortcutDownload',
    availability: 'download',
    note: 'Only for albums with download: true in gallery.yaml.',
  },
  { keys: ['?', 'H'], labelKey: 'shortcutList', availability: 'always' },
  { keys: ['Esc'], labelKey: 'shortcutClose', availability: 'always' },
];

/**
 * Arrow keys are stored as names rather than glyphs so the list survives an
 * editor that mangles them; both renderers ask for the display form here.
 */
export function shortcutKeyLabel(key: string): string {
  if (key === 'ARROW_LEFT') return String.fromCharCode(0x2190);
  if (key === 'ARROW_RIGHT') return String.fromCharCode(0x2192);
  return key;
}
