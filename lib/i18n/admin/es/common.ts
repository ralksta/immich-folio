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
  switchOn: 'Sí',
  switchOff: 'No',
  retry: 'Reintentar',
  loading: 'Cargando…',
  none: 'Ninguno',
  unknown: 'Desconocido',
  /** Prefix for an error the server reported, e.g. "Error: El archivo es demasiado grande". */
  errorWith: (message: string) => `Error: ${message}`,
  /**
   * The photo grid layouts, keyed by the id written to `grid.layout`
   * (lib/admin/layouts.ts).
   */
  layouts: {
    masonry: { label: 'Cascada', desc: 'Columnas escalonadas dinámicas, al estilo Pinterest' },
    uniform: { label: 'Cuadrícula uniforme', desc: 'Cuadrícula limpia con la misma proporción' },
    showcase: {
      label: 'Escaparate',
      desc: 'Fotos destacadas combinadas con miniaturas más pequeñas',
    },
    filmstrip: {
      label: 'Tira de película',
      desc: 'Tira horizontal desplazable, como una línea temporal',
    },
    'editorial-flow': {
      label: 'Flujo editorial',
      desc: 'Diseño de reportaje de revista con fotos de distintos tamaños',
    },
    justified: {
      label: 'Justificado (experimental)',
      desc: 'Filas de igual altura que ocupan todo el ancho',
    },
    essay: {
      label: 'Diseño de relato',
      desc: 'Texto, citas y fotos compuestos como un relato continuo',
    },
  },
};
