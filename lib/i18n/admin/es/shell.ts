import type { AdminDictionary } from '../index';

/**
 * The panel's frame: sign-in, the sidebar, the status dropdown, the floating
 * save bar and the overview at /admin.
 */
export const shell: AdminDictionary['shell'] = {
  gate: {
    loading: 'Cargando el panel de administración',
    disabledTitle: 'Panel de administración',
    /** `{env}` is the ADMIN_PASSWORD variable name, set in code. */
    disabledBody:
      'El panel de administración no está activado. Define {env} en tus variables de entorno para activarlo.',
    sessionExpired: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  },

  login: {
    subtitle: 'Panel de administración',
    password: 'Contraseña',
    passwordPlaceholder: 'Introduce la contraseña de administración',
    signIn: 'Iniciar sesión',
    signingIn: 'Iniciando sesión…',
    failed: 'No se ha podido iniciar sesión',
    connectionError: 'Error de conexión',
  },

  nav: {
    /** Group headings in the sidebar. */
    groups: {
      content: 'Contenido',
      visitors: 'Visitantes',
      site: 'Sitio',
      system: 'Sistema',
    },
    overview: 'Resumen',
    pages: 'Páginas',
    journal: 'Diario',
    messages: 'Mensajes',
    proofing: 'Selecciones',
    analytics: 'Estadísticas',
    settings: 'Ajustes',
    diagnostics: 'Diagnóstico',
    help: 'Ayuda',
    unread: (n: number) => `${n} sin leer`,
  },

  sidebar: {
    skipToContent: 'Saltar al contenido',
    /** Accessible name of the sidebar landmark. */
    landmark: 'Administración',
    expand: 'Expandir la barra lateral',
    collapse: 'Contraer la barra lateral',
    /** Tooltip on the collapsed sidebar's toggle; keep it to one short word. */
    expandShort: 'Expandir',
    brandSub: 'Administración',
    openMenu: 'Abrir menú',
    closeMenu: 'Cerrar menú',
    viewSite: 'Ver el sitio',
    viewSiteTitle: 'Abrir el sitio en una pestaña nueva (sin caché)',
    backups: 'Copias de seguridad',
    backupsTitle: 'Gestionar y restaurar copias de seguridad de la configuración',
    reload: 'Recargar',
    reloadTitle: 'Recargar la configuración y vaciar la caché',
    reloadFailed: (status: number) => `No se ha podido recargar (HTTP ${status}).`,
    signOut: 'Cerrar sesión',
  },

  /** The system status dropdown at the foot of the sidebar. */
  status: {
    showTitle: 'Mostrar el estado del sistema',
    heading: 'Diagnóstico del sistema',
    refreshTitle: 'Actualizar el diagnóstico',
    checking: 'Comprobando…',
    /**
     * Shown when the install was never finished. `{wizard}` is a link to the
     * setup wizard, labelled with `setupWizard`.
     */
    missingCredentials:
      'No hay ninguna URL ni clave de API de Immich configurada. Define {apiUrl} y {apiKey}, o ejecuta el {wizard}.',
    noGallery:
      'Todavía no existe {file}: el sitio público no tiene nada que mostrar. Añade una página abajo o ejecuta el {wizard} (el token de un solo uso aparece en el registro del servidor).',
    setupWizard: 'asistente de configuración',
    immich: 'Conexión con Immich',
    connected: 'Conectado',
    disconnected: 'Desconectado',
    config: 'Integridad de la configuración',
    configValid: 'Válida',
    configDegraded: 'Degradada',
    configNotSetUp: 'Sin configurar',
    backups: 'Copias de seguridad',
    backupCount: (n: number) => `${n} ${n === 1 ? 'copia' : 'copias'} de seguridad`,
    latestBackup: 'Última copia',
    cache: 'Caché en memoria',
    cacheItems: (n: number) => `${n} ${n === 1 ? 'elemento' : 'elementos'}`,
    version: 'Versión',
    updateAvailable: (version: string) => `La versión ${version} está disponible`,
  },

  /** The status badge's words; the colour is decided alongside (systemHealth.ts). */
  health: {
    checking: 'Comprobando…',
    setupIncomplete: 'Configuración incompleta',
    degraded: 'Sistema degradado',
    needsAttention: 'Requiere atención',
    checkDiagnostics: 'Revisa el diagnóstico',
    ok: 'Sistema correcto',
    unknown: 'Estado desconocido',
  },

  /** The spinner and the error-with-retry every admin screen shares. */
  loadState: {
    retry: 'Reintentar',
    loading: 'Cargando',
  },

  /**
   * Unsaved edits that came back from the browser's draft store. `restored`
   * and `stale` insert one of `subjects`, so each subject carries its own
   * preposition and article ("en los ajustes").
   */
  draft: {
    subjects: {
      settings: 'en los ajustes',
      about: 'en la página «Sobre mí»',
      privacy: 'en la política de privacidad',
      pageStructure: 'en la estructura de páginas',
      page: 'en la página',
      entry: 'en la entrada',
    },
    restored: (subject: string) =>
      `Se han restaurado tus cambios sin guardar ${subject}. Todavía no están guardados.`,
    stale: (subject: string) =>
      `Tienes cambios anteriores sin guardar ${subject}, pero desde entonces se ha guardado otra versión en otro lugar. Si los restauras, sustituirán esa versión al guardar.`,
    discardChanges: 'Descartar cambios',
    ok: 'Entendido',
    restore: 'Restaurar mis cambios',
    discardThem: 'Descartarlos',
  },

  /**
   * The dialog when a file was saved elsewhere since it was opened. `message`
   * starts with one of `subjects`, so they are phrased as its subject.
   */
  conflict: {
    subjects: {
      settings: 'El archivo de ajustes',
      about: 'La página «Sobre mí»',
      privacy: 'La política de privacidad',
      pageStructure: 'La estructura de páginas (gallery.yaml)',
      page: 'Esta página',
      entry: 'Esta entrada',
    },
    title: 'Cambiado en otro lugar',
    message: (subject: string) =>
      `${subject} ha cambiado desde que empezaste a editar: en otra pestaña, en otro dispositivo, a mano o al restaurar una copia de seguridad. Si guardas ahora, sustituirás ese cambio.`,
    overwrite: 'Sobrescribir de todos modos',
    reload: 'Recargar (descartar lo mío)',
    keepEditing: 'Seguir editando',
  },

  fetch: {
    loadFailed: (status: number, detail: string) =>
      detail
        ? `No se pudo cargar (HTTP ${status}): ${detail}.`
        : `No se pudo cargar (HTTP ${status}).`,
    unreachable: 'No se pudo conectar con el servidor.',
  },

  notifications: {
    dismiss: 'Descartar',
  },

  saveBar: {
    unsaved: 'Cambios sin guardar',
    discard: 'Descartar cambios',
    preview: '↗ Previsualizar el sitio',
    previewTitle: 'Abrir el sitio en una pestaña nueva (sin caché)',
    saving: 'Guardando…',
  },

  overview: {
    kicker: 'Resumen',
    /** Greeting by the hour of the admin's clock. */
    goodNight: 'Buenas noches',
    goodMorning: 'Buenos días',
    goodAfternoon: 'Buenas tardes',
    goodEvening: 'Buenas noches',
    needsLook: (n: number) => `${n} ${n === 1 ? 'cosa merece' : 'cosas merecen'} un vistazo.`,
    allInOrder: 'Todo está en orden.',
    checking: 'Comprobando el sitio…',
    viewSite: 'Ver el sitio',
    editPages: 'Editar páginas',
    attention: 'Requiere atención',
    unreadMessages: (n: number) => `${n} ${n === 1 ? 'mensaje' : 'mensajes'} sin leer`,
    /** `names` is a comma-separated list of up to three senders. */
    from: (names: string) => `De ${names}`,
    open: 'Abrir',
    calm: 'No hay nada pendiente. Aquí aparecerán los mensajes nuevos y los problemas.',
    glance: 'De un vistazo',
    pages: 'Páginas',
    switchedOff: (n: number) => `${n} ${n === 1 ? 'desactivada' : 'desactivadas'}`,
    allPublished: 'todas publicadas',
    heroPhotos: 'Fotos de portada',
    onHomePage: 'en la página de inicio',
    journal: 'Diario',
    drafts: (n: number) => `${n} ${n === 1 ? 'borrador' : 'borradores'}`,
    noDrafts: 'sin borradores',
    views7: 'Visitas · 7 días',
    cookieless: 'recuento sin cookies',
    quickActions: 'Acciones rápidas',
    newEntry: 'Nueva entrada del diario',
    messages: 'Mensajes',
    theme: 'Tema',
    diagnostics: 'Diagnóstico',
  },
};
