/**
 * Spanish dictionary.
 *
 * Typed as `Dictionary` (derived from `en.ts`), so a key added to English but
 * forgotten here fails the type-check rather than falling through to English
 * at runtime.
 */

import type { Dictionary } from '../index';

const plural = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`;

export const es: Dictionary = {
  dateLocale: 'es-ES',

  nav: {
    home: 'Inicio',
    about: 'Sobre mí',
    map: 'Mapa',
    journal: 'Diario',
    skipToContent: 'Saltar al contenido',
    openMenu: 'Abrir menú',
    closeMenu: 'Cerrar menú',
  },

  common: {
    backTo: (label: string) => `Volver a ${label}`,
    backToGallery: 'Volver a la galería',
    backToJournal: 'Volver al diario',
    email: 'Correo electrónico',
    website: 'Sitio web',
    home: 'Inicio',
    photos: (n: number) => plural(n, 'foto', 'fotos'),
    albums: (n: number) => plural(n, 'álbum', 'álbumes'),
    collections: (n: number) => plural(n, 'colección', 'colecciones'),
    prevAlbum: 'Álbum anterior',
    nextAlbum: 'Álbum siguiente',
    prevAlbumAria: (name: string) => `Álbum anterior: ${name}`,
    nextAlbumAria: (name: string) => `Álbum siguiente: ${name}`,
    albumNavAria: 'Navegación entre álbumes',
    prevEntry: 'Entrada anterior',
    nextEntry: 'Entrada siguiente',
    prevEntryAria: (title: string) => `Entrada anterior: ${title}`,
    nextEntryAria: (title: string) => `Entrada siguiente: ${title}`,
    entryNavAria: 'Navegación entre entradas del diario',
    loadingGallery: 'Cargando la galería',
    loadingPhotos: 'Cargando fotos',
    downloadAlbum: 'Descargar álbum',
  },

  home: {
    enter: 'Entrar',
  },

  error: {
    notFoundTitle: 'No encontrado',
    notFoundText: 'Esta página no existe o el álbum ya no está publicado.',
    errorTitle: 'Algo ha salido mal',
    errorText:
      'No se ha podido cargar esta página. Suele ser algo temporal: inténtalo de nuevo en un momento.',
    siteErrorText:
      'No se ha podido cargar este sitio. Suele ser algo temporal: inténtalo de nuevo en un momento.',
    tryAgain: 'Reintentar',
    reference: (digest: string) => `Referencia: ${digest}`,
  },

  download: {
    unavailableTitle: 'Descarga no disponible',
    notAvailable: 'Esta descarga no está disponible.',
    rateLimited: 'Demasiadas solicitudes de descarga. Espera un momento y vuelve a intentarlo.',
    immichUnavailable:
      'La fototeca no está disponible en este momento. Vuelve a intentarlo en breve.',
    back: 'Volver a la galería',
  },

  theme: {
    switchToLight: 'Cambiar a modo claro',
    switchToDark: 'Cambiar a modo oscuro',
    scrollToTop: 'Volver arriba',
  },

  password: {
    subtitle: 'Esta galería está protegida con contraseña.',
    siteSubtitle: 'Este sitio está protegido con contraseña.',
    placeholder: 'Introduce la contraseña',
    submit: 'Entrar',
    verifying: 'Verificando…',
    incorrect: 'Contraseña incorrecta. Inténtalo de nuevo.',
    failed: 'No se ha podido verificar la contraseña. Inténtalo más tarde.',
  },

  about: {
    kicker: 'Sobre mí',
    title: 'Sobre mí',
    metaTitle: (name: string) => `Sobre mí — ${name}`,
    portraitAlt: 'Retrato',
    gear: 'Equipo',
  },

  map: {
    title: 'Mapa',
    kicker: 'Dónde',
    subtitle: 'Dónde se tomaron las fotos',
    loading: 'Cargando el mapa…',
    loadFailed: (status: number) => `No se pudieron cargar los datos del mapa (${status})`,
    initFailed: 'No se pudo inicializar el mapa',
  },

  subpage: {
    collectionKicker: (index: string) => `${index} — Colección`,
    sectionsNav: 'Secciones',
    coverAria: (albumName: string, count: string) => `${albumName}, ${count}`,
    nextSubpage: 'Siguiente',
    nextSubpageAria: (name: string) => `Siguiente: ${name}`,
  },

  journal: {
    title: 'Diario',
    kicker: 'Historias y ensayos',
    subtitle: 'Ensayos fotográficos, historias visuales y notas de campo.',
    description: 'Ensayos fotográficos, relatos de viaje y diarios entre bastidores.',
    entryDescription: 'Entrada del diario',
    empty: 'Todavía no hay entradas publicadas.',
    readStory: 'Leer historia →',
    minRead: (n: number) => `${n} min de lectura`,
    draft: 'Borrador',
    by: (author: string) => `por ${author}`,
    notFound: 'No encontrado',
  },

  lightbox: {
    viewer: 'Visor de imágenes',
    openPhoto: (n: number) => `Ver foto ${n}`,
    close: 'Cerrar',
    closeTitle: 'Cerrar (Esc)',
    previous: 'Foto anterior',
    previousTitle: 'Foto anterior (flecha izquierda)',
    next: 'Foto siguiente',
    nextTitle: 'Foto siguiente (flecha derecha)',
    toggleInfo: 'Mostrar/ocultar información',
    toggleInfoTitle: 'Mostrar/ocultar información (i)',
    hideInfo: 'Ocultar info',
    info: 'Info',
    loading: 'Cargando…',
    camera: 'Cámara',
    lens: 'Objetivo',
    focalLength: 'Distancia focal',
    aperture: 'Apertura',
    shutter: 'Obturación',
    iso: 'ISO',
    location: 'Ubicación',
    noExif: 'No hay datos EXIF disponibles',
    copyLink: 'Copiar enlace a esta foto',
    copyLinkTitle: 'Copiar enlace a esta foto (c)',
    copyLinkShort: 'Enlace',
    copied: 'Copiado',
    copyManual: 'Copia este enlace',
    shortcuts: 'Atajos de teclado',
    shortcutNavigate: 'Foto anterior / siguiente',
    shortcutInfo: 'Información de la foto',
    shortcutFullscreen: 'Pantalla completa',
    shortcutExitFullscreen: 'Salir de pantalla completa',
    download: 'Descargar el archivo original',
    downloadTitle: 'Descargar el archivo original (d)',
    downloadShort: 'Original',
    shortcutDownload: 'Descargar el original',
    shortcutSlideshow: 'Presentación',
    shortcutSlideshowRunning: (seconds: number) => `Presentación — cada ${seconds} s`,
    slideshowStopped: 'Presentación detenida',
    slideshowRunning: (seconds: number) => `Presentación en curso, avanza cada ${seconds} segundos`,
    shortcutCopyLink: 'Copiar enlace a esta foto',
    shortcutList: 'Esta lista',
    shortcutClose: 'Cerrar el visor',
  },

  proofing: {
    addFavorite: 'Añadir favorito',
    removeFavorite: 'Quitar favorito',
    addToFavorites: 'Añadir a favoritos',
    removeFromFavorites: 'Quitar de favoritos',
    saved: 'Guardado',
    favorite: 'Favorito',
    showAll: 'Mostrar todo',
    selected: (n: number) => `❤️ ${n} ${n === 1 ? 'seleccionada' : 'seleccionadas'}`,
    shareExport: 'Compartir y exportar',
    modalTitle: (n: number) => `❤️ Selección (${n})`,
    closeModal: 'Cerrar ventana',
    intro: (n: number) =>
      `Has seleccionado ${plural(n, 'foto', 'fotos')}. Elige una opción de exportación para compartir tu selección:`,
    copyLink: 'Copiar enlace para compartir',
    linkCopied: '¡Enlace copiado!',
    copyList: 'Copiar lista de texto (#1, #2…)',
    listCopied: '¡Lista copiada!',
    copyManualLink: 'Copia este enlace',
    copyManualList: 'Copia esta lista',
    sendEmail: '✉️ Enviar correo al fotógrafo',
    downloadSelected: 'Descargar selección (.zip)',
    clearSelection: 'Borrar selección',
    confirmClear: '¿Quitar todos los favoritos seleccionados?',
    listEmpty: (albumName: string) => `${albumName}: ninguna foto seleccionada.`,
    listSummary: (albumName: string, count: number, indices: string) =>
      `${albumName} — Fotos seleccionadas (${count}): ${indices}`,
    mailSubject: (n: number) => `Selección de fotos (${n})`,
    mailBody: (list: string, url: string) =>
      `Hola:\n\nEsta es mi selección de fotos:\n\n${list}\n\nEnlace: ${url}\n\nUn saludo,`,
  },

  legal: {
    navLabel: 'Aviso legal',
    title: 'Aviso legal',
    subtitle: 'Información conforme al § 5 DDG',
    address: 'Dirección',
    contact: 'Contacto',
    email: 'Correo electrónico',
    phone: 'Teléfono',
    contactForm: 'Formulario de contacto',
    taxSection: 'Información fiscal',
    taxId: 'Número de identificación fiscal',
    vatId: 'Número de IVA',
    extraInfo: 'Información adicional',
  },
};
