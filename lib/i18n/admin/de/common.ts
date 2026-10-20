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
  retry: 'Erneut versuchen',
  loading: 'Wird geladen…',
  none: 'Keine',
  unknown: 'Unbekannt',
  /** Prefix for an error the server reported, e.g. "Fehler: Datei zu groß". */
  errorWith: (message: string) => `Fehler: ${message}`,
};
