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
  retry: 'Riprova',
  loading: 'Caricamento…',
  none: 'Nessuno',
  unknown: 'Sconosciuto',
  errorWith: (message: string) => `Errore: ${message}`,
};
