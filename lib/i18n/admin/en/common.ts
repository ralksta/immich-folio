/** Words every area of the panel uses. An area keeps its own wording otherwise. */
export const common = {
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  close: 'Close',
  reset: 'Reset',
  remove: 'Remove',
  delete: 'Delete',
  add: 'Add',
  edit: 'Edit',
  confirm: 'Confirm',
  /** The short label inside a toggle switch; keep it to one short word. */
  switchOn: 'On',
  switchOff: 'Off',
  retry: 'Try again',
  loading: 'Loading…',
  none: 'None',
  unknown: 'Unknown',
  /** Prefix for an error the server reported, e.g. "Error: File too large". */
  errorWith: (message: string) => `Error: ${message}`,
  /**
   * The photo grid layouts, keyed by the id written to `grid.layout`
   * (lib/admin/layouts.ts). Settings, an album's override and a page's layout
   * all read this one table (#691).
   */
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
    essay: {
      label: 'Story Layout',
      desc: 'Text, quotes and photos composed as one scrolling story',
    },
  },
};
