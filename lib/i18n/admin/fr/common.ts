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
  switchOn: 'Oui',
  switchOff: 'Non',
  retry: 'Réessayer',
  loading: 'Chargement…',
  none: 'Aucun',
  unknown: 'Inconnu',
  errorWith: (message: string) => `Erreur : ${message}`,
  /**
   * The photo grid layouts, keyed by the id written to `grid.layout`
   * (lib/admin/layouts.ts).
   */
  layouts: {
    masonry: { label: 'Maçonnerie', desc: 'Colonnes décalées dynamiques, façon Pinterest' },
    uniform: { label: 'Grille uniforme', desc: 'Grille nette au format identique' },
    showcase: {
      label: 'Vitrine',
      desc: 'Photos mises en avant mêlées à des vignettes plus petites',
    },
    filmstrip: { label: 'Pellicule', desc: 'Bande de film horizontale à faire défiler' },
    'editorial-flow': {
      label: 'Flux éditorial',
      desc: 'Mise en page de magazine avec des photos de tailles variées',
    },
    justified: {
      label: 'Justifiée (expérimental)',
      desc: 'Rangées de même hauteur qui occupent toute la largeur',
    },
    essay: {
      label: 'Mise en récit',
      desc: 'Texte, citations et photos composés en un récit continu',
    },
  },
};
