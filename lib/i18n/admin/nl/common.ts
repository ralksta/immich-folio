import type { AdminDictionary } from '../index';

/** Words every area of the panel uses. An area keeps its own wording otherwise. */
export const common: AdminDictionary['common'] = {
  save: 'Opslaan',
  saving: 'Opslaan…',
  cancel: 'Annuleren',
  close: 'Sluiten',
  reset: 'Herstellen',
  remove: 'Verwijderen',
  delete: 'Wissen',
  add: 'Toevoegen',
  edit: 'Bewerken',
  confirm: 'Bevestigen',
  switchOn: 'Aan',
  switchOff: 'Uit',
  retry: 'Opnieuw proberen',
  loading: 'Laden…',
  none: 'Geen',
  unknown: 'Onbekend',
  errorWith: (message: string) => `Fout: ${message}`,
  /**
   * The photo grid layouts, keyed by the id written to `grid.layout`
   * (lib/admin/layouts.ts).
   */
  layouts: {
    masonry: { label: 'Masonry', desc: 'Dynamische, verspringende kolommen in Pinterest-stijl' },
    uniform: { label: 'Gelijkmatig raster', desc: 'Strak raster met gelijke beeldverhouding' },
    showcase: { label: 'Etalage', desc: 'Uitgelichte foto’s gemengd met kleinere tegels' },
    filmstrip: { label: 'Filmstrook', desc: 'Horizontaal scrollbare filmstrook als tijdlijn' },
    'editorial-flow': {
      label: 'Redactionele stroom',
      desc: 'Verhaalopmaak als in een tijdschrift, met wisselende fotoformaten',
    },
    justified: {
      label: 'Uitgevuld (experimenteel)',
      desc: 'Rijen van gelijke hoogte over de volle breedte',
    },
    essay: {
      label: 'Verhaallayout',
      desc: 'Tekst, citaten en foto’s samengevoegd tot één doorlopend verhaal',
    },
  },
};
