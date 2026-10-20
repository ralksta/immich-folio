import type { AdminDictionary } from '../index';

/** Words every area of the panel uses. An area keeps its own wording otherwise. */
export const common: AdminDictionary['common'] = {
  save: 'Enregistrer',
  saving: 'Enregistrement…',
  cancel: 'Annuler',
  close: 'Fermer',
  reset: 'Réinitialiser',
  remove: 'Retirer',
  delete: 'Supprimer',
  add: 'Ajouter',
  edit: 'Modifier',
  confirm: 'Confirmer',
  retry: 'Réessayer',
  loading: 'Chargement…',
  none: 'Aucun',
  unknown: 'Inconnu',
  errorWith: (message: string) => `Erreur : ${message}`,
};
