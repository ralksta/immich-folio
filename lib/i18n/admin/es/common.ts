import type { AdminDictionary } from '../index';

/** Words every area of the panel uses. An area keeps its own wording otherwise. */
export const common: AdminDictionary['common'] = {
  save: 'Guardar',
  saving: 'Guardando…',
  cancel: 'Cancelar',
  close: 'Cerrar',
  reset: 'Restablecer',
  remove: 'Quitar',
  delete: 'Eliminar',
  add: 'Añadir',
  edit: 'Editar',
  confirm: 'Confirmar',
  retry: 'Reintentar',
  loading: 'Cargando…',
  none: 'Ninguno',
  unknown: 'Desconocido',
  /** Prefix for an error the server reported, e.g. "Error: El archivo es demasiado grande". */
  errorWith: (message: string) => `Error: ${message}`,
};
