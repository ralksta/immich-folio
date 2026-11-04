import type { AdminDictionary } from '../index';

/** Words every area of the panel uses. An area keeps its own wording otherwise. */
export const common: AdminDictionary['common'] = {
  save: 'Salva',
  saving: 'Salvataggio…',
  cancel: 'Annulla',
  close: 'Chiudi',
  reset: 'Ripristina',
  remove: 'Rimuovi',
  delete: 'Elimina',
  add: 'Aggiungi',
  edit: 'Modifica',
  confirm: 'Conferma',
  switchOn: 'Sì',
  switchOff: 'No',
  retry: 'Riprova',
  loading: 'Caricamento…',
  none: 'Nessuno',
  unknown: 'Sconosciuto',
  errorWith: (message: string) => `Errore: ${message}`,
  /**
   * The photo grid layouts, keyed by the id written to `grid.layout`
   * (lib/admin/layouts.ts).
   */
  layouts: {
    masonry: { label: 'Masonry', desc: 'Colonne sfalsate dinamiche, in stile Pinterest' },
    uniform: { label: 'Griglia uniforme', desc: 'Griglia pulita con proporzioni uguali' },
    showcase: { label: 'Vetrina', desc: 'Foto in evidenza alternate a riquadri più piccoli' },
    filmstrip: {
      label: 'Pellicola',
      desc: 'Striscia orizzontale scorrevole, come una pellicola',
    },
    'editorial-flow': {
      label: 'Flusso editoriale',
      desc: 'Impaginazione da rivista con foto di dimensioni diverse',
    },
    justified: {
      label: 'Giustificato (sperimentale)',
      desc: 'Righe di uguale altezza che riempiono tutta la larghezza',
    },
    essay: {
      label: 'Layout narrativo',
      desc: 'Testo, citazioni e foto composti come un racconto continuo',
    },
  },
};
