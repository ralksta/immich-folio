import type { AdminDictionary } from '../index';

/**
 * The diagnostics page (`app/admin/components/DiagnosticsView.tsx`). The doctor's
 * findings themselves are in `doctor.ts`; the alt-text finding is built here,
 * on the page, and lives under `altText`.
 */
export const diagnostics: AdminDictionary['diagnostics'] = {
  /** Groups the checks are filed under. */
  groups: {
    connection: 'Conexión',
    security: 'Seguridad',
    content: 'Contenido',
  },

  /** A finding's level — shown to screen readers and in the copied report. */
  levels: {
    ok: 'Correcto',
    warn: 'Revisar',
    error: 'Problema',
  },

  /** Buttons that lead to the fix for a finding. ↗ marks one that opens the docs. */
  fixes: {
    howToSetIt: 'Cómo configurarlo',
    cdnSetup: 'Configuración de la CDN',
    openSettings: 'Abrir ajustes',
    openPages: 'Abrir páginas',
    openInPages: 'Abrir en Páginas',
    howToFix: 'Cómo solucionarlo',
    howToSetUp: 'Cómo ponerlo en marcha',
    apiKeyPermissions: 'Permisos de la clave de API',
  },

  altText: {
    captionsOffTitle: 'Las descripciones de las fotos no se usan como texto alternativo',
    captionsOffDetail:
      '«Descripción de la foto» está desactivada en Ajustes → General, así que todas las fotos del sitio tienen el texto alternativo vacío, tenga Immich lo que tenga.',
    /** Appended to the details below, so it starts with a space. */
    unreadable: (n: number) =>
      n === 1
        ? ` ${n} álbum no se ha podido leer y no se cuenta.`
        : ` ${n} álbumes no se han podido leer y no se cuentan.`,
    allTitle: (total: number) => `Las ${total} fotos publicadas tienen texto alternativo`,
    /** `unreadable` is the sentence above, or ''. */
    allDetail: (unreadable: string) => `Cada foto lleva su descripción de Immich.${unreadable}`,
    missingTitle: (n: number) =>
      n === 1
        ? `${n} foto publicada no tiene texto alternativo`
        : `${n} fotos publicadas no tienen texto alternativo`,
    missingDetail: (unreadable: string) =>
      `Folio usa la descripción de Immich como texto alternativo. Sin ella, los lectores de pantalla no anuncian nada y los buscadores no indexan nada de la foto.${unreadable}`,
    pendingTitle: 'Comprobando el texto alternativo…',
    pendingDetail: 'Leyendo todos los álbumes publicados; las bibliotecas grandes tardan un poco.',
    failedTitle: 'No se ha podido comprobar el texto alternativo',
    failedDetail:
      'Los álbumes no se han cargado. Si Immich está desconectado, ese es el motivo: inténtalo de nuevo cuando vuelva.',
    coverage: (described: number, total: number, percent: number) =>
      `${described} de ${total} con descripción · ${percent} %`,
    albumMissing: (missing: number, total: number) => `${missing} de ${total} sin descripción`,
    openInImmich: (fileName: string) => `${fileName} — abrir en Immich`,
    more: (n: number) => `+${n} más`,
    showPhotos: 'Mostrar fotos',
    hidePhotos: 'Ocultar fotos',
    noteAdd: 'Añade la descripción en Immich y pulsa Recargar en la barra superior.',
    /** `{url}` is Immich's address, shown as code. */
    noteExternal: 'Las fotos se abren en {url}, el dominio externo de Immich.',
    /** `{setting}` is `externalDomain` below, shown in bold. */
    noteInternal:
      'Las fotos se abren en {url}, la dirección con la que Folio llega a Immich y que quizá tu navegador no pueda abrir. Configura {setting} en Immich (Administration → Settings → Server) y los enlaces usarán esa dirección.',
    /** The name of the setting in Immich's own (English) interface. */
    externalDomain: 'External domain',
  },

  header: {
    kicker: 'Sistema',
    checking: 'Comprobando…',
    allClear: 'Nada requiere tu atención',
    attention: (n: number, total: number) =>
      `${n} de ${total} comprobaciones ${n === 1 ? 'merece' : 'merecen'} un vistazo`,
    /** `date` is already formatted for the browser's locale. */
    lastRun: (date: string) => `Última ejecución: ${date}`,
    running: 'Ejecutando las comprobaciones…',
    runAgain: 'Volver a ejecutar',
    copyTitle: 'Markdown, listo para pegar en una incidencia',
    copy: 'Copiar informe',
    copied: 'Copiado',
  },

  errors: {
    failed: (reason: string) => `El diagnóstico ha fallado. ${reason}`,
    copyFailed: 'No se ha podido copiar: tu navegador ha denegado el acceso al portapapeles.',
  },

  /** The Markdown report copied to the clipboard. */
  report: {
    heading: 'Diagnóstico de Immich Folio',
    version: (version: string) => `Versión ${version}`,
  },

  vitals: {
    aria: 'Resumen',
    immich: 'Immich',
    connected: 'Conectado',
    disconnected: 'Desconectado',
    config: 'Configuración',
    valid: 'Válida',
    invalid: 'No válida',
    notSetUp: 'Sin configurar',
    backups: 'Copias de seguridad',
    latest: (date: string) => `la última, ${date}`,
    noneYet: 'todavía ninguna',
    version: 'Versión',
    available: (version: string) => `${version} disponible`,
    upToDate: 'actualizado',
  },

  needsAttention: 'Requiere atención',

  storage: {
    title: 'Almacenamiento y caché',
    backupsTitle: (n: number) =>
      `${n} ${n === 1 ? 'copia' : 'copias'} de seguridad de la configuración`,
    backupsDetail: 'Se crean antes de cada guardado en el panel, diez por archivo.',
    manageBackups: 'Gestionar copias de seguridad',
    cacheTitle: (n: number) =>
      `La caché en memoria contiene ${n} ${n === 1 ? 'elemento' : 'elementos'}`,
    cacheDetail:
      'Listas de álbumes y metadatos de fotos de Immich. Vaciarla solo hace que las siguientes visitas a las páginas sean más lentas.',
    clearing: 'Vaciando…',
    clearCache: 'Vaciar caché',
  },
};
