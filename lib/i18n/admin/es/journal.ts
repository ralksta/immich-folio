import type { AdminDictionary } from '../index';

/**
 * The journal studio: the entry list, the create dialog, the block editor
 * (also used for content pages), its settings and the live preview.
 */
export const journal: AdminDictionary['journal'] = {
  studio: {
    /** The page header's kicker. */
    kicker: 'Contenido',
    title: 'Diario',
    description:
      'Historias, notas de campo y ensayos fotográficos extensos, escritos con vista previa en directo.',
    newEntry: 'Nueva entrada del diario',
    emptyTitle: 'Todavía no hay entradas en el diario',
    emptyText: 'Crea tu primera historia para compartir diarios de viaje o reportajes de boda.',
    createFirst: 'Crear la primera entrada',
    /** Reading time on an entry card. */
    readingTime: (minutes: number) => `${minutes} min`,
    draft: 'Borrador',
    published: 'Publicada',
    /** Shown on a card when the entry has a password. */
    password: 'Contraseña',
    editInStudio: 'Editar en el estudio',
    viewLive: 'Ver la página publicada',
    /** The delete button's tooltip and the confirm dialog's button. */
    deleteEntry: 'Eliminar entrada',
    deleteTitle: (name: string) => `¿Eliminar «${name}»?`,
    deleteMessage: 'Se conserva una copia que puedes restaurar en Copias de seguridad.',
    deleteFailed: 'No se ha podido eliminar la entrada del diario',
    deleteError:
      'No se ha podido eliminar la entrada del diario. Comprueba la conexión e inténtalo de nuevo.',
    createFailed: 'No se ha podido crear la entrada del diario',
    createError:
      'No se ha podido crear la entrada del diario. Comprueba la conexión e inténtalo de nuevo.',
    albumsError:
      'No se han podido cargar los álbumes. Comprueba la conexión con Immich e inténtalo de nuevo.',

    create: {
      title: 'Crear una entrada del diario',
      titleLabel: 'Título',
      titlePlaceholder: 'p. ej. Expedición al Cabo Norte',
      slugLabel: 'Slug de la URL',
      slugPlaceholder: 'p. ej. expedicion-cabo-norte',
      /** `slug` is the entry's slug, or `slugFallback` while it is empty. */
      slugHint: (slug: string) => `Estará disponible en /journal/${slug}`,
      slugFallback: 'ruta',
      startFrom: 'Empezar desde',
      startFromLabel: 'Punto de partida de la entrada',
      tabTemplates: 'Plantillas',
      tabAlbums: 'Álbumes',
      blank: 'En blanco',
      blankDescription: 'Empieza con un editor vacío.',
      loadingAlbums: 'Cargando álbumes…',
      changeAlbum: 'Cambiar álbum',
      selectAlbum: 'Seleccionar álbum',
      choosePhotos: 'Elegir fotos',
      choosePhotosSelected: (n: number) =>
        `Elegir fotos (${n} ${n === 1 ? 'seleccionada' : 'seleccionadas'})`,
      selectedPhotos: 'Fotos seleccionadas',
      albumNote: 'Solo se añadirán a la entrada las fotos que selecciones de este álbum.',
      pickerTitle: 'Elegir fotos de este álbum',
      creating: 'Creando…',
      submit: 'Crear y abrir el estudio',
    },
  },

  /**
   * The names and descriptions of the starting templates, by template id
   * (`lib/journalTemplates.ts`). The blocks a template inserts stay as written.
   */
  templates: {
    wedding: {
      name: 'Boda',
      description:
        'Fecha y lugar al principio, una imagen de portada, una frase de los votos y los invitados en una cuadrícula.',
    },
    hiking: {
      name: 'Senderismo / aire libre',
      description:
        'Distancia y desnivel como datos, el sendero en una cuadrícula y la ruta en un mapa.',
    },
    travel: {
      name: 'Viaje',
      description: 'El viaje en un mapa y después una parada por sección, con dos fotos cada una.',
    },
    birthday: {
      name: 'Cumpleaños / familia',
      description: 'Casi sin texto: todo el álbum en una cuadrícula y una imagen a sangre.',
    },
    'portrait-session': {
      name: 'Sesión de retrato',
      description:
        'Imágenes anchas sueltas con espacio para respirar y una frase en sus propias palabras.',
    },
    'behind-the-scenes': {
      name: 'Entre bastidores',
      description: 'Preparación y sesión como pareja de fotos, y al final el resultado terminado.',
    },
    pets: {
      name: 'Mascotas',
      description: 'Parejas de fotos espontáneas y un primer plano con personalidad.',
    },
    'new-series': {
      name: 'Nueva serie',
      description:
        'Empieza con una declaración y sigue con parejas de foto y texto que presentan el proyecto.',
    },
  },

  /** The editor of one entry, also used for content pages. */
  editor: {
    loadFailedFallback: 'No se ha podido cargar la entrada.',
    conflictKept: 'No se ha guardado: se ha cambiado en otro lugar. Tus cambios siguen aquí.',
    saveFailed: 'No se ha podido guardar',
    saveErrorEntry:
      'No se ha podido guardar la entrada. Comprueba la conexión e inténtalo de nuevo.',
    saveErrorPage: 'No se ha podido guardar la página. Comprueba la conexión e inténtalo de nuevo.',
    openingEntry: 'Abriendo el estudio del diario…',
    openingPage: 'Abriendo el editor de páginas…',
    loadFailedEntry: 'No se ha podido cargar esta entrada.',
    loadFailedPage: 'No se ha podido cargar esta página.',
    albumListFailed: (error: string) => `Lista de álbumes: ${error}`,
    loadFailedNote:
      'No se ha cambiado nada. Guardar seguirá desactivado hasta que se cargue, para que un editor vacío no pueda sobrescribirla.',
    backToEntries: 'Volver a las entradas',
    backToPages: 'Volver a las páginas',
    /** The top bar's back button. */
    allEntries: '← Todas las entradas',
    pages: '← Páginas',
    storyTitlePlaceholder: 'Título de la historia…',
    storyTitleLabel: 'Título de la historia',
    pageTitlePlaceholder: 'Título de la página…',
    pageTitleLabel: 'Título de la página',
    modeLabel: 'Modo del editor',
    modeBlocks: 'Bloques visuales',
    modeMarkdown: 'Markdown sin formato',
    storySettings: 'Ajustes de la historia',
    pageSettings: 'Ajustes de la página',
    publish: 'Publicar',
    unpublish: 'Despublicar',
    publishTitle: 'Publicar la página y guardarla ahora',
    unpublishTitle: 'Volver a convertir la página en borrador y guardarla ahora',
    /** Link to the published page. */
    live: 'En directo',
    saving: 'Guardando…',
    saveChanges: 'Guardar cambios',
    saved: 'Guardado',
    markdownPlaceholder: 'Escribe Markdown aquí…',
    addBlock: 'Añadir bloque:',
    addText: '+ Texto',
    addHeading: '+ Encabezado',
    addQuote: '+ Cita',
    addFacts: '+ Datos',
    addPhoto: '+ Foto',
    addPhotos: '+ Fotos',
    addPair: '+ Pareja de fotos',
    addGrid: '+ Cuadrícula de fotos',
    addAlbum: '+ Álbum',
    addMap: '+ Mapa',
    moveUp: 'Subir el bloque',
    moveDown: 'Bajar el bloque',
    deleteBlock: 'Eliminar el bloque',
    resize: 'Cambiar el tamaño del editor y la vista previa',
  },

  /** Titles of the photo picker, by what it is opened for. */
  pickerTitles: {
    storyPhoto: 'Seleccionar foto para la historia',
    photos: 'Añadir fotos (un bloque por foto)',
    pair: 'Seleccionar fotos para la pareja',
    pairPhoto: (n: number) => `Seleccionar la foto n.º ${n} de la pareja`,
    grid: 'Seleccionar fotos para la cuadrícula',
    gridPhoto: (n: number) => `Seleccionar la foto n.º ${n} de la cuadrícula`,
    mapPhoto: 'Seleccionar una foto para colocarla en el mapa',
    cover: 'Seleccionar foto de portada',
  },

  /**
   * The text a new block starts with. It is written into the entry, so it is
   * in the panel's language at the time the block is added.
   */
  blockDefaults: {
    heading: 'Nuevo encabezado',
    paragraph: 'Escribe aquí el texto del párrafo…',
    quote: 'Escribe el texto de la cita…',
  },

  /** The fields of each block type. */
  blocks: {
    headingLevel: 'Nivel de encabezado',
    text: 'Texto',
    /** Keep the Markdown markers (`**`, `*`, `[…](…)`) as they are. */
    textPlaceholder: 'Texto (**negrita**, *cursiva*, [enlace](https://…))',
    quotePlaceholder: 'Texto de la cita…',
    authorPlaceholder: 'Autoría (opcional)',
    legacyRef: (ref: string) =>
      `La referencia «${ref}» es una posición de álbum antigua, no una foto. No aparecerá en la página publicada: elige una foto abajo.`,
    legacyRefs: (refs: string[]) =>
      `Las referencias «${refs.join('», «')}» son posiciones de álbum antiguas, no fotos. No aparecerán en la página publicada: elige fotos abajo.`,
    changePhoto: 'Cambiar foto',
    pickPhoto: 'Elegir una foto',
    /** An empty photo tile. */
    pick: '+ Elegir',
    photoLayout: 'Diseño de la foto',
    layoutContained: 'Contenida (ancho de columna)',
    layoutWide: 'Ancha (ancho ampliado)',
    layoutFullbleed: 'A sangre (de borde a borde)',
    changePhotoButton: 'Cambiar foto',
    captionPlaceholder: 'Pie de foto (opcional)',
    changePairPhoto: (n: number) => `Cambiar la foto ${n} de la pareja`,
    pickPairPhoto: (n: number) => `Elegir la foto ${n} de la pareja`,
    pickPairSlot: (n: number) => `+ Elegir foto n.º ${n}`,
    pickBoth: 'Elegir las dos fotos',
    pairCaptionPlaceholder: 'Pie común para la pareja (opcional)',
    /** Alt text of a picked photo's thumbnail. */
    thumb: 'Miniatura',
    pickGridSlot: (n: number) => `+ Elegir n.º ${n}`,
    removePhoto: (n: number) => `Quitar la foto n.º ${n}`,
    addPhoto: 'Añadir foto',
    pickSeveral: 'Elegir varias',
    gridHint: 'Tres fotos o más, distribuidas en filas de tres.',
    gridCaptionPlaceholder: 'Pie común para la cuadrícula (opcional)',
    factLabelPlaceholder: 'Etiqueta, p. ej. Distancia',
    factValuePlaceholder: 'Valor, p. ej. 21 km',
    removeFact: (n: number) => `Quitar el dato n.º ${n}`,
    addFact: 'Añadir dato',
    changeAlbum: 'Cambiar álbum',
    pickAlbum: 'Elegir álbum',
    albumPhotoCount: (n: number) => `${n} ${n === 1 ? 'foto en el álbum' : 'fotos en el álbum'}`,
    albumLoading: 'cargando…',
    count: 'Cantidad',
    /** Placeholder of the empty Count field: every photo. */
    countAll: 'todas',
    skip: 'Omitir',
    layout: 'Diseño',
    albumLayoutGrid: 'Cuadrícula (filas de tres)',
    albumLayoutPairs: 'Parejas (filas de dos)',
    albumLayoutWide: 'Ancho (una por fila)',
    albumCaptionPlaceholder: 'Pie del conjunto (opcional)',
    albumHint:
      'Las fotos siguen el orden del álbum (primero un orden manual de la galería). Cantidad y Omitir eligen un tramo; deja la cantidad vacía para todas.',
    mapOff:
      'El mapa está desactivado en Ajustes → General. Este bloque no se mostrará hasta que se active.',
    mapCaptionPlaceholder: 'Pie, p. ej. Busan → Seúl (opcional)',
    pointLabelPlaceholder: 'Etiqueta (opcional)',
    /** Short placeholders of the coordinate fields. */
    lat: 'Lat.',
    latitude: 'Latitud',
    lng: 'Long.',
    longitude: 'Longitud',
    pickPhotoTile: '+ Elegir foto',
    allPhotosItem: 'Todas las fotos geolocalizadas de esta entrada, en orden',
    movePinUp: 'Subir el marcador',
    movePinDown: 'Bajar el marcador',
    removePin: 'Quitar marcador',
    invalidCoordinates:
      'Un punto necesita una latitud entre ±90 y una longitud entre ±180. Los puntos sin coordenadas válidas no se guardan.',
    addPoint: 'Punto',
    addPhotoPin: 'Marcador de foto',
    addAllPhotos: 'Todas las fotos geolocalizadas',
    connectLine: 'Unir los marcadores con una línea',
    mapHint:
      'Los puntos introducidos aparecen al instante en la vista previa. Los marcadores de foto se colocan en la página publicada según el GPS de la foto, con la precisión de ubicación del álbum.',
  },

  storySettings: {
    title: 'Ajustes y metadatos de la historia',
    subtitle: 'Subtítulo',
    subtitlePlaceholder: 'p. ej. Notas de campo de nuestro viaje de invierno',
    author: 'Autor',
    authorPlaceholder: 'p. ej. Ralf',
    date: 'Fecha de publicación',
    cover: 'Foto de portada',
    coverAlt: 'Portada',
    chooseCover: 'Elegir portada',
    password: 'Protección con contraseña (opcional)',
    draft: 'Mantener como borrador (oculta en la lista pública de /journal)',
    done: 'Listo',
  },

  pageSettings: {
    title: 'Ajustes de la página',
    description: 'Descripción SEO',
    descriptionPlaceholder: 'Una o dos frases para los buscadores y las vistas previas de enlaces',
    draft: 'Borrador',
    draftDescription: 'Solo tú puedes ver un borrador, y no aparece en el menú ni en el sitemap.',
    password: 'Contraseña (opcional)',
    passwordLabel: 'Contraseña de la página',
    note: 'Los ajustes se guardan con la página. La URL y el lugar en el menú se definen en Páginas.',
  },

  preview: {
    label: 'Vista previa del tema en tiempo real',
    widthLabel: 'Ancho de la vista previa',
    desktop: 'Escritorio',
    mobile: 'Móvil',
  },
};
