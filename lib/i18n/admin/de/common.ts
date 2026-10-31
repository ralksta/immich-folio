import type { AdminDictionary } from '../index';

/** Words every area of the panel uses. An area keeps its own wording otherwise. */
export const common: AdminDictionary['common'] = {
  save: 'Speichern',
  saving: 'Wird gespeichert…',
  cancel: 'Abbrechen',
  close: 'Schließen',
  reset: 'Zurücksetzen',
  remove: 'Entfernen',
  delete: 'Löschen',
  add: 'Hinzufügen',
  edit: 'Bearbeiten',
  confirm: 'Bestätigen',
  switchOn: 'An',
  switchOff: 'Aus',
  retry: 'Erneut versuchen',
  loading: 'Wird geladen…',
  none: 'Keine',
  unknown: 'Unbekannt',
  /** Prefix for an error the server reported, e.g. "Fehler: Datei zu groß". */
  errorWith: (message: string) => `Fehler: ${message}`,
  /**
   * The photo grid layouts, keyed by the id written to `grid.layout`
   * (lib/admin/layouts.ts). Settings, an album's override and a page's layout
   * all read this one table (#691).
   */
  layouts: {
    masonry: { label: 'Masonry', desc: 'Dynamische, versetzte Spalten im Pinterest-Stil' },
    uniform: {
      label: 'Gleichmäßiges Raster',
      desc: 'Klares Raster mit gleichem Seitenverhältnis',
    },
    showcase: { label: 'Showcase', desc: 'Große Hero-Fotos gemischt mit kleineren Kacheln' },
    filmstrip: { label: 'Filmstreifen', desc: 'Horizontal scrollbarer Filmstreifen' },
    'editorial-flow': {
      label: 'Editorial Flow',
      desc: 'Magazin-Layout mit unterschiedlich großen Fotos',
    },
    justified: {
      label: 'Blocksatz (experimentell)',
      desc: 'Zeilen gleicher Höhe, die die volle Breite füllen',
    },
    essay: {
      label: 'Story-Layout',
      desc: 'Text, Zitate und Fotos zu einer durchlaufenden Geschichte komponiert',
    },
  },
};
