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
  retry: 'Opnieuw proberen',
  loading: 'Laden…',
  none: 'Geen',
  unknown: 'Onbekend',
  errorWith: (message: string) => `Fout: ${message}`,
};
