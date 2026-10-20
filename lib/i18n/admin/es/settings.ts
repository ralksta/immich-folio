import type { AdminDictionary } from '../index';

/**
 * Settings (`/admin/settings/<section>`): the editor shell, each section, the
 * privacy policy editor in Legal, and the shared form fields in
 * `app/admin/components/fields/` that other areas reuse.
 *
 * `{name}` placeholders are filled with markup by `rich()` — usually a
 * `<code>` element holding a file name or an environment variable, which stays
 * as it is in every language.
 */
export const settings: AdminDictionary['settings'] = {
  editor: {
    /** The section nav on the left of the settings page. */
    sections: {
      general: 'General',
      theme: 'Tema',
      grid: 'Cuadrícula',
      footer: 'Pie de página',
      legal: 'Información legal',
      seo: 'SEO',
      security: 'Seguridad y protección',
      about: 'Sobre mí',
    },
    kicker: 'Sitio',
    title: 'Ajustes',
    description: 'Los cambios guardados se aplican al sitio al instante, sin reiniciar.',
    /** Label of the save button in the floating save bar. */
    saveChanges: 'Guardar cambios',
    sessionExpired: 'Tu sesión ha caducado. Vuelve a iniciar sesión para continuar.',
    serverAnswered: (status: number) => `El servidor ha respondido ${status}.`,
    loadFailed: 'No se han podido cargar los ajustes.',
    loadErrorTitle: 'No se han podido cargar los ajustes.',
    loadErrorBody:
      'No se ha cambiado nada. Guardar seguirá desactivado hasta que se carguen, para que un formulario vacío no pueda sobrescribir tu configuración.',
    conflict: 'No se ha guardado: los ajustes se han cambiado en otro lugar.',
    /** Shown when the server confirms a save without a message of its own. */
    saved: '¡Guardado!',
    saveFailed: 'No se ha podido guardar',
  },

  general: {
    title: 'Ajustes generales del sitio',
    sub: 'Configura la identidad básica del sitio, el idioma y las funciones principales.',
    siteTitle: 'Título del sitio',
    siteTitleHint:
      'Aparece en la cabecera, en la pestaña del navegador y en las vistas previas de enlaces.',
    /** `title` is what the site shows instead; `fromEnv` when SITE_TITLE supplied it. */
    siteTitleEmpty: (title: string, fromEnv: boolean) =>
      `Vacío, así que el sitio muestra «${title}»${fromEnv ? ', tomado de SITE_TITLE' : ''}.`,
    subtitle: 'Subtítulo',
    subtitlePlaceholder: 'Un diario visual',
    language: 'Idioma',
    /** {locales}: comma-separated language codes; {htmlLang}: the `<html lang>` attribute. */
    languageHint:
      'La interfaz para visitantes está traducida a {locales}. Los demás idiomas siguen fijando {htmlLang} y el formato de las fechas, pero muestran la interfaz en inglés. El panel de administración tiene su propio ajuste de idioma, más abajo.',
    adminLanguage: 'Idioma del panel de administración',
    adminLanguageSame: 'El mismo que el del sitio',
    adminLanguageHint:
      'El idioma de este panel de administración. Cambia en cuanto se guardan los ajustes.',

    featuresTitle: 'Funciones y módulos del portfolio',
    featuresSub:
      'Páginas opcionales, y qué revela el sitio sobre tus fotos y qué cuenta de las visitas.',
    modules: 'Módulos',
    modulesDesc: 'Cada uno añade una página o un control que pueden usar los visitantes.',
    aboutPage: 'Página «Sobre mí»',
    aboutPageDesc: 'Retrato, biografía y equipo en /about',
    map: 'Mapa',
    mapDesc: 'Ubicaciones de las fotos en un mapa del mundo en /map',
    proofing: 'Selección por clientes',
    proofingDesc: 'Los visitantes marcan con un corazón, filtran y exportan una selección de fotos',
    zoom: 'Zoom de fotos',
    zoomDesc:
      'Los visitantes amplían una foto a resolución completa (1:1) para comprobar la nitidez. Las páginas y los álbumes pueden cambiarlo',
    proofingEmail: 'Correo para selecciones',
    proofingEmailPlaceholder: 'Por defecto, el correo de contacto del pie de página',
    proofingEmailHint:
      'A dónde envía una selección el botón «Enviar correo al fotógrafo». Si está vacío, se usa el correo de contacto del pie de página; si no hay ninguno, el botón se oculta.',

    privacyGroup: 'Qué saben de ti los visitantes',
    privacyGroupDesc: 'Qué revela cada foto y qué se cuenta de una visita.',
    /** Small chip beside the group title. */
    privacyGroupChip: 'visible para visitantes',
    photoMetadata: 'Metadatos de las fotos',
    /** Parts of the one-line summary under "Photo metadata", joined with " · ". */
    metadataSummary: {
      camera: 'Cámara y objetivo',
      exposure: 'Exposición',
      location: 'Ubicación',
      description: 'Descripción',
      none: 'No se publica nada: el visor oculta su panel de información',
    },
    details: 'Detalles',
    exifCamera: 'Cámara y objetivo',
    exifCameraDesc: 'Cuerpo, objetivo y distancia focal',
    exifSettings: 'Ajustes de exposición',
    exifSettingsDesc: 'Apertura, velocidad de obturación e ISO',
    exifLocation: 'Ubicación',
    exifLocationDesc: 'Ciudad y país según los datos GPS de la foto',
    exifCaption: 'Descripción de la foto',
    exifCaptionDesc: 'La descripción escrita en Immich',
    gridHover: 'Resumen al pasar el cursor por la cuadrícula',
    gridHoverDesc: 'Cámara y objetivo sobre la foto, no solo en el visor',
    gridHoverNeedsCamera: 'Requiere «Cámara y objetivo»',
    analytics: 'Estadísticas',
    analyticsDesc: 'Recuento de visitas sin cookies, guardado solo en tu servidor',

    favicon: 'Favicon',
    faviconAlt: 'Favicon actual',
    faviconUpload: 'Subir icono',
    faviconUploadFailed: 'No se ha podido subir',
    faviconResetFailed: 'No se ha podido restablecer',
    faviconResetTitle: '¿Restablecer el favicon?',
    faviconResetMessage:
      'Se elimina el icono subido y se vuelve a usar el predeterminado incluido.',
    faviconHint:
      'SVG, PNG, ICO o JPEG, 512 kB como máximo. Se guarda en el volumen de contenido. Restablecer recupera el predeterminado incluido.',
  },

  theme: {
    title: 'Preajustes de tema y modo de color',
    sub: 'Elige un preajuste tipográfico y previsualízalo en modo claro u oscuro.',
    visitorMode: 'Modo predeterminado para visitantes',
    visitorModeAria: 'Modo predeterminado para visitantes',
    modeDark: 'Oscuro',
    modeLight: 'Claro',
    modeAuto: 'Seguir el sistema del visitante',
    visitorModeHint:
      'Lo que ve quien visita el sitio por primera vez. El interruptor claro/oscuro de la cabecera le sigue permitiendo elegir, y su elección se recuerda en su dispositivo. La vista previa de abajo es solo tuya y no cambia esto.',
    preset: 'Preajuste',
    /** Under each preset card: font, corner radius and photo frame. */
    presetSpecs: (font: string, radius: number, frame: string) =>
      `${font} · radio ${radius} · ${frame}`,
    colorMode: 'Modo de color',
    /** {editorial}, {minimal}, {classic}: preset names, set in bold. */
    colorModeHint:
      'Preajustes como {editorial}, {minimal} y {classic} usan fondos claros y cálidos en tono crema en el modo claro, y carbón en el modo oscuro.',
    lightMode: 'Modo claro (crema / beis)',
    darkMode: 'Modo oscuro (carbón)',
    accentTitle: 'Color de acento',
    accentSub: 'Elige un color de acento principal para enlaces, botones y resaltados.',
    /** Tooltips on the accent colour swatches. */
    swatches: {
      studioRed: 'Rojo estudio',
      editorialGold: 'Oro editorial',
      emerald: 'Esmeralda',
      sapphire: 'Zafiro',
      violet: 'Violeta',
      white: 'Blanco monocromo',
      black: 'Negro obsidiana',
    },
    accentAria: 'Color de acento',
    accentHexAria: 'Color de acento (hex)',
    frameTitle: 'Marco de las fotos y diseño',
    frameSub: 'Personaliza los bordes de presentación de las imágenes y el diseño de la portada.',
    photoFrame: 'Marco de las fotos',
    photoFrames: {
      none: { label: 'Ninguno', desc: 'Imagen a ras, con bordes nítidos' },
      passepartout: { label: 'Paspartú', desc: 'Borde clásico de galería' },
      shadow: { label: 'Sombra', desc: 'Sombra suave, como si flotara' },
    },
    heroStyle: 'Estilo de portada',
    heroStyles: {
      split: { label: 'Dividido', desc: 'Título y foto uno junto a otro' },
      fullbleed: { label: 'A sangre', desc: 'Banda a todo el ancho, de borde a borde' },
      minimal: { label: 'Minimalista', desc: 'Título centrado con una foto discreta' },
      stacked: { label: 'Apilado', desc: 'Título justo encima de la foto' },
      typographic: { label: 'Tipográfico', desc: 'Cabecera de texto grande, sin fotos' },
      mosaic: { label: 'Mosaico', desc: 'Collage dinámico de fotos' },
      cover: {
        label: 'Portada (experimental)',
        desc: 'Pantalla completa de bienvenida con un único enlace «Entrar»',
      },
    },
    lookTitle: 'Aspecto y movimiento',
    lookSub: 'Efectos y pequeños controles en todas las páginas.',
    transitions: 'Transiciones entre páginas',
    transitionsDesc: 'Un breve fundido entre páginas',
    scrollToTop: 'Botón «Volver arriba»',
    scrollToTopDesc: 'Una flecha flotante en las páginas largas',
    grain: 'Grano de película',
    grainDesc: 'Ruido analógico sobre el fondo',
    headerDot: 'Punto de acento en la cabecera',
    headerDotDesc: 'Un punto junto al título de la sección activa',
  },

  grid: {
    title: 'Cuadrícula y motor de diseño',
    sub: 'Configura la estructura de columnas de la galería y la proporción de las miniaturas.',
    layout: 'Algoritmo de diseño',
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
    },
    aspectRatio: 'Proporción',
    /** Keyed by the ratio value written to settings.yaml. */
    aspectRatios: {
      '1': { label: 'Cuadrado (1:1)', desc: 'Recortes cuadrados en proporción 1:1' },
      '3/2': { label: 'Horizontal (3:2)', desc: 'Formato horizontal estándar de 35 mm' },
      '2/3': { label: 'Vertical (2:3)', desc: 'Orientación vertical de retrato' },
      '16/9': { label: 'Cine (16:9)', desc: 'Proporción panorámica cinematográfica 16:9' },
      auto: {
        label: 'Original automático',
        desc: 'Proporciones originales de la imagen, sin recortar',
      },
    },
    spacingTitle: 'Espaciado y columnas',
    spacingSub:
      'Ajusta el número de columnas y el espacio entre elementos de la cuadrícula. El número de columnas también distribuye las portadas de los álbumes en una subpágina; su espaciado lo sigue decidiendo el tema, salvo que una página lo cambie.',
    columns: (min: number, max: number) => `Columnas (${min} - ${max})`,
    gap: 'Espaciado (px)',
  },

  footer: {
    title: 'Pie de página y redes sociales',
    sub: 'Muestra tu marca y los enlaces a Instagram, correo y sitio web en el pie de página del portfolio.',
    brandName: 'Nombre de marca en el pie de página',
    brandNamePlaceholder: 'Mi fotografía',
    instagram: 'URL de Instagram',
    email: 'Correo de contacto',
    website: 'Sitio web personal',
    navTitle: 'Enlaces de navegación en la cabecera (experimental)',
    navSub:
      'Enlaces externos que aparecen tras tus páginas en el menú de la cabecera. Solo se permiten URL http(s); se abren en una pestaña nueva.',
    linkLabel: 'Texto',
    /** Example label for an external header link. */
    linkLabelPlaceholder: 'Tienda',
    linkUrl: 'URL',
    removeLink: 'Quitar enlace',
    addLink: '+ Añadir enlace externo',
  },

  legal: {
    title: 'Aviso legal (Impressum)',
    sub: 'Configura la página de información legal que exige la ley alemana de servicios digitales (Digitale-Dienste-Gesetz, DDG).',
    view: 'Ver /impressum ↗',
    enable: 'Activar la página de aviso legal (/impressum)',
    enableDesc: 'Genera /impressum automáticamente y la enlaza en el pie de página',
    heading: 'Encabezado',
    headingHint:
      'Déjalo vacío para usar la línea del § 5 DDG en el idioma del sitio. Rellénalo si se aplica otra ley, p. ej. el § 5 ECG en Austria.',
    name: 'Nombre completo / razón social',
    address: 'Dirección',
    zipCity: 'Código postal y ciudad',
    country: 'País',
    countryPlaceholder: 'España',
    email: 'Correo electrónico legal',
    phone: 'Teléfono',
    contactUrl: 'URL del formulario de contacto',
    contactUrlInvalid:
      'Debe empezar por https:// o http://. Cualquier otro enlace se omite en la página.',
    contactLabel: 'Texto del enlace de contacto',
    contactLabelPlaceholder: 'Formulario de contacto',
    vatId: 'Número de IVA',
    taxId: 'Número de identificación fiscal',
    extraInfo: 'Información adicional',
    contactForm: 'Formulario de contacto (/contact)',
    contactFormDesc:
      'Los mensajes se guardan en este servidor y se leen en Mensajes. No se envía ningún correo.',
    notifyUrl: 'URL de notificación (ntfy)',
    notifyUrlInvalid: 'Debe empezar por https:// o http://.',
    notifyUrlHint:
      'Recibe un aviso fijo de «mensaje nuevo», sin nada sobre el remitente. Elige un nombre de tema que nadie pueda adivinar.',
    /** `variable` is the environment variable's name. */
    notifyUrlEnvOverride: (variable: string) => `${variable} tiene prioridad sobre este campo.`,
    retention: 'Borrar los mensajes tras (días)',
    privacy: 'Política de privacidad (/privacy)',
    privacyDesc: 'Se muestra y se enlaza en el pie de página en cuanto se guarda el texto de abajo',
  },

  seo: {
    title: 'Optimización para buscadores (SEO)',
    sub: 'Personaliza los metadatos para buscadores, las etiquetas OpenGraph y las reglas de indexación.',
    snippetPreview: 'Vista previa del resultado en Google',
    /** Stand-ins in the search preview while the fields are empty. */
    snippetTitle: 'Mi portfolio de fotografía',
    snippetDesc: 'Una selección cuidada de trabajos fotográficos.',
    siteUrl: 'URL del sitio',
    /** {sitemap}: the file name sitemap.xml. */
    siteUrlHint:
      'Necesaria para {sitemap}, el feed y los datos estructurados: se generan sin una petición, así que la dirección no se puede deducir de ella. Si la dejas vacía, el sitemap queda vacío en lugar de adivinarla.',
    /** {variable}: SITE_URL; {value}: the URL it holds. */
    siteUrlFromEnv:
      'Ahora la proporciona la variable de entorno {variable} ({value}). Un valor introducido aquí tiene prioridad en cuanto se guarda.',
    metaTitle: 'Metatítulo SEO',
    metaTitlePlaceholder:
      'Sustituye el título predeterminado del sitio en los resultados de Google',
    titleTemplate: 'Plantilla de título de subpágina',
    /** Site name used in the template example while no title is set. */
    titleTemplateFallback: 'Mi portfolio',
    /** {placeholder}: the literal `%s`. */
    titleTemplateHint:
      'Plantilla para subpáginas y álbumes. Usa {placeholder} en lugar del título de la página.',
    previewLabel: 'Vista previa:',
    /** Example page title put into the template preview. */
    previewExample: 'Paisajes',
    metaDescription: 'Metadescripción SEO',
    metaDescriptionPlaceholder: 'Una selección cuidada de trabajos fotográficos…',
    crawlerTitle: 'Directivas para rastreadores',
    crawlerSub: 'Controla cómo indexan tu sitio Googlebot y otros rastreadores web.',
    noIndex: 'noindex (ocultar en Google)',
    noIndexDesc: 'Indica a los buscadores que NO indexen este sitio en sus resultados',
    noFollow: 'nofollow (no seguir enlaces)',
    noFollowDesc: 'Indica a los rastreadores de los buscadores que no sigan los enlaces salientes',
  },

  security: {
    title: 'Contraseña del sitio',
    sub: 'Protege todo el sitio público con una sola contraseña: útil mientras el portfolio está en construcción, o para un folio que solo ven tus clientes.',
    sitePassword: 'Contraseña del sitio',
    sitePasswordAria: 'Contraseña del sitio',
    sitePasswordPlaceholder: 'Déjala vacía para un sitio público',
    /** {hash}: the `scrypt:…` prefix; {file}: settings.yaml. */
    storedHashed: 'Se guarda en {file} como hash {hash}, nunca tal como la escribes.',
    /** {variable}: SITE_PASSWORD. */
    envOverride: 'La variable de entorno {variable} tiene prioridad sobre este campo.',
    adminSeparate:
      'El panel de administración tiene su propia contraseña y nunca queda detrás de esta protección.',
    protectionTitle: 'Protección de imágenes y marca de agua',
    protectionSub:
      'Configura las reglas de protección de imágenes, el bloqueo del clic derecho y la marca de agua superpuesta.',
    rightClick: 'Desactivar el menú del clic derecho',
    rightClickDesc:
      'Impide el menú contextual sobre las imágenes del portfolio para dificultar descargas no autorizadas',
    imageDrag: 'Desactivar el arrastre de imágenes',
    imageDragDesc: 'Impide que los visitantes arrastren imágenes fuera de la página del portfolio',
    watermarkTitle: 'Marca de agua dinámica',
    watermarkSub: 'Superpone un texto de copyright sobre las imágenes del visor.',
    watermarkEnable: 'Activar la marca de agua',
    watermarkEnableDesc: 'Superpone un texto de copyright al ver las imágenes del portfolio',
    watermarkText: 'Texto de la marca de agua',
    position: 'Posición',
    positionAria: 'Posición de la marca de agua',
    positionBottomRight: 'Abajo a la derecha',
    positionBottomLeft: 'Abajo a la izquierda',
    positionCenter: 'Superpuesta en el centro',
    opacity: (percent: number) => `Opacidad (${percent} %)`,
  },

  about: {
    title: 'Página «Sobre mí»',
    sub: 'Edita el retrato, la biografía y el equipo que aparecen en la página «Sobre mí». En General puedes mostrar u ocultar la página.',
    portrait: 'ID del recurso del retrato',
    portraitPlaceholder: 'UUID del recurso de Immich para la foto de retrato',
    name: 'Nombre',
    namePlaceholder: 'Tu nombre',
    location: 'Ubicación',
    locationPlaceholder: 'Ciudad, país',
    gear: 'Equipo (uno por línea)',
    biography: 'Biografía (Markdown)',
    biographyPlaceholder: 'Fotógrafo afincado en…',
    loadFailed: 'No se ha podido cargar la página «Sobre mí».',
    conflict: 'No se ha guardado: la página «Sobre mí» se ha cambiado en otro lugar.',
  },

  privacy: {
    loadFailed: 'No se ha podido cargar.',
    /** `error` is a short technical reason, e.g. "HTTP 500". */
    loadError: (error: string) =>
      `No se ha podido cargar la política de privacidad (${error}). Recarga la página para intentarlo de nuevo.`,
    conflict: 'No se ha guardado: la política se ha cambiado en otro lugar.',
    saveFailed: (status: number) => `No se ha podido guardar (HTTP ${status}).`,
    saved: 'Política de privacidad guardada.',
    unreachable: 'No se ha podido contactar con el servidor.',
    factsTitle: 'Qué procesa este sitio',
    factsHint:
      'Se deduce de tu configuración actual. Es una lista de comprobación para redactar la política, no un texto para la página.',
    /** Badge beside a processing fact that involves an outside service. */
    thirdParty: 'tercero',
    body: 'Política de privacidad (Markdown)',
    /** Example text in the empty editor; keep the Markdown heading. */
    bodyPlaceholder: '## Responsable\n\nNombre, dirección, correo electrónico…',
    /** {heading}, {list}, {bold}, {link}: Markdown syntax examples in code style. */
    syntaxHint:
      'Encabezados con {heading}, listas con {list}, {bold} y {link}. Se muestra en /privacy y se enlaza en el pie de página en cuanto hay texto. Las versiones anteriores se conservan en Copias de seguridad.',
    insertHeadings: 'Insertar encabezados',
    view: 'Ver /privacy ↗',
    save: 'Guardar la política de privacidad',
  },

  /** Form fields shared with the page builder and the journal. */
  fields: {
    /** Link beside a feature switch to its own settings page. */
    configure: 'Configurar →',
    locked: 'Bloqueado',
    /** {variable}: the environment variable's name. */
    envLockNote:
      'Lo define {variable} en el entorno. Cámbialo o elimínalo allí; editarlo aquí no tendría efecto.',
    columnsPlaceholder: 'Columnas (predeterminado del sitio)',
    columnsAria: 'Columnas',
    gapPlaceholder: 'Espaciado en px (predeterminado del tema)',
    gapAria: 'Espaciado en px',
    passwordPlaceholder: 'Déjala vacía para acceso público',
    passwordProtected: 'Protegido',
    passwordChange: 'Cambiar',
    passwordNew: 'Contraseña nueva',
    passwordHide: 'Ocultar contraseña',
    passwordShow: 'Mostrar contraseña',
    passwordKeep: 'Mantener la contraseña actual',
    zoom: 'Zoom de fotos',
    zoomOn: 'Activado: los visitantes pueden ampliar a resolución completa',
    zoomOff: 'Desactivado',
  },
};
