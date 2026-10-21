import type { AdminDictionary } from '../index';

/** The help page and the backup dialog. */
export const system: AdminDictionary['system'] = {
  help: {
    kicker: 'Sistema',
    title: 'Ayuda',
    description: 'Lo que tu portfolio sabe hacer y no tiene un botón propio.',
    viewer: 'Visor de imágenes',
    /** `{question}` and `{h}` are the two keys, drawn as keycaps. */
    viewerIntro:
      'Teclas que un visitante puede pulsar en el visor. A propósito no hay una barra de herramientas para ellas (un control fijo sobre una fotografía le cuesta algo a cada visitante), pero los visitantes pueden mostrar esta misma lista con {question} o {h}.',
    /**
     * When a conditional key is absent, keyed by the shortcut's label key in
     * `lib/lightboxShortcuts.ts`. The shortcut names themselves come from the
     * visitor dictionary of the panel's language.
     */
    notes: {
      shortcutInfo:
        'Oculto cuando todos los grupos EXIF están desactivados, y en las entradas del diario.',
      shortcutFullscreen:
        'No aparece en navegadores sin pantalla completa por elemento, como Safari en iPhone.',
      shortcutSlideshow:
        'Alterna entre desactivado, 3 s, 5 s, 10 s y de nuevo desactivado. Cualquier flecha o deslizamiento la detiene.',
      shortcutCopyLink:
        'Copia un enlace a la foto en pantalla. Depende de la posición: si reordenas el álbum, cambia la foto a la que lleva.',
      shortcutDownload: 'Solo en álbumes con download: true en gallery.yaml.',
      shortcutZoom:
        'Solo donde el zoom está activado (ajustes, página o álbum) y la foto tiene una fuente a resolución completa.',
      shortcutZoomReset: 'Vuelve a la foto completa. Esc hace lo mismo antes de cerrar el visor.',
    },
    diagnostics: 'Diagnóstico',
    /** `{tab}` is the sidebar entry's name (`diagnosticsTab`), shown bold. */
    diagnosticsIntro:
      'Comprueba lo que falla sin avisar: un número de saltos de proxy incorrecto, el ID de un álbum eliminado, una contraseña en texto plano, un álbum que Immich no considera compartido. Ábrelo desde {tab} en la barra lateral; la insignia de estado bajo el menú sigue indicando de un vistazo si algo requiere atención ahora mismo.',
    diagnosticsTab: 'Diagnóstico',
  },

  backups: {
    title: 'Historial y restauración de copias de seguridad',
    subtitle:
      'Restaura una versión anterior de tus páginas, ajustes, página «Sobre mí», diario o páginas de contenido, incluidas las entradas del diario y las páginas eliminadas.',
    /** One tab per kind of file; `files` names it in the empty state. */
    tabs: {
      gallery: 'Galería',
      settings: 'Ajustes',
      about: 'Sobre mí',
      privacy: 'Privacidad',
      journal: 'Diario',
      pages: 'Páginas de contenido',
    },
    files: {
      gallery: 'gallery.yaml',
      settings: 'settings.yaml',
      about: 'about.md',
      privacy: 'privacy.md',
      journal: 'las entradas del diario',
      pages: 'las páginas de contenido',
    },
    tabLabel: (label: string, n: number) => `${label} (${n})`,
    restoreFailed: 'No se ha podido restaurar la copia de seguridad',
    restoreError: 'Error al restaurar la copia de seguridad',
    restoredPage: (slug: string) => `Se ha restaurado la página «${slug}».`,
    restoredEntry: (slug: string) => `Se ha restaurado la entrada del diario «${slug}».`,
    restored: (file: string) => `¡Copia de seguridad restaurada! (${file})`,
    confirmTitle: 'Confirmar la restauración',
    /** `{file}` is the backup's file name, set in code. */
    confirmBody:
      '¿Seguro que quieres restaurar {file}? Antes de revertir se creará automáticamente una instantánea de seguridad del estado actual.',
    restoring: 'Restaurando…',
    restoreNow: 'Sí, restaurar ahora',
    loading: 'Cargando copias de seguridad…',
    empty: (what: string) => `Todavía no hay copias de seguridad de ${what}`,
    deleted: 'Entrada eliminada',
    deletedTitle: 'Instantánea tomada al eliminar la entrada',
    preRestore: 'Instantánea previa a la restauración',
    preRestoreTitle: 'Instantánea de seguridad tomada antes de una restauración',
    restore: 'Restaurar',
    hideOlder: 'Ocultar las copias anteriores',
    showOlder: (n: number) => `Mostrar ${n} ${n === 1 ? 'copia anterior' : 'copias anteriores'}`,
  },
};
