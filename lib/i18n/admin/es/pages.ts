import type { AdminDictionary } from '../index';

/**
 * Admin → Pages: the page builder (home page hero, standalone albums,
 * pages, content pages), its drawers and the story block editor.
 *
 * File names (gallery.yaml, content/pages/), CSS values and units in the
 * strings below are literal — keep them as written.
 */
export const pages: AdminDictionary['pages'] = {
  /** The page header above the builder. */
  header: {
    kicker: 'Contenido',
    title: 'Páginas',
    description:
      'La portada de la página de inicio, los álbumes independientes, las páginas y las páginas de contenido. Arrastra para reordenar; los cambios se publican al guardar.',
  },

  builder: {
    /** A subpage the server would refuse: it has no albums and no sections. */
    pageNeedsAlbum: (pages: string) =>
      `${pages} necesita al menos un álbum. Añade uno o elimina la página.`,
    albumListFailed: (error: string) =>
      `Los álbumes de Immich no se cargaron, por eso el selector de álbumes está vacío. ${error}`,
    pageListFailed: (error: string) =>
      `Las páginas de contenido no se cargaron; sus entradas del menú se quedan como están. ${error}`,
    loadFailed: 'No se ha podido cargar la estructura de páginas.',
    loadFailedNote:
      'No se ha cambiado nada. Guardar seguirá desactivado hasta que se cargue, para que un editor vacío no pueda sobrescribir tu galería.',
    notSavedConflict: 'No se ha guardado: gallery.yaml se ha cambiado en otro lugar.',
    saved: '¡Guardado correctamente!',
    /** Inserted into "Error: …" (common.errorWith). */
    saveFailed: 'No se ha podido guardar',
    saveChanges: 'Guardar cambios',
    createFailed: 'No se ha podido crear la página',
    createdInMenu: 'Página creada como borrador. Pulsa «Guardar cambios» para añadirla al menú.',
    created: 'Página creada como borrador.',
    createOffline: 'No se ha podido crear la página. Comprueba la conexión e inténtalo de nuevo.',
    /** Toasts after a removal; each offers `undo`. */
    pageRemoved: 'Página quitada.',
    albumRemoved: 'Álbum quitado.',
    albumRemovedFromPage: 'Álbum quitado de la página.',
    albumRemovedFromSection: 'Álbum quitado de la sección.',
    heroRemoved: 'Foto de portada quitada.',
    undo: 'Deshacer',
    undoFailed:
      'No se ha podido deshacer: la estructura de páginas ha cambiado desde entonces. Todavía no se ha guardado nada.',
    /**
     * What screen readers call a dragged item ("Se ha levantado la página
     * «Viajes»."). Each carries its article, since `pickers.dnd` puts it
     * into a sentence.
     */
    drag: {
      page: (name: string) => `la página «${name}»`,
      untitled: 'Sin título',
      hero: (n: number) => `la foto de portada ${n} de la página de inicio`,
      album: (name: string) => `el álbum «${name}»`,
      item: 'el elemento',
    },
    /** The structure list on the left. */
    tree: 'Estructura de páginas',
    searchLabel: 'Buscar álbumes o páginas',
    searchPlaceholder: 'Buscar álbumes o páginas…',
    clearSearch: 'Borrar la búsqueda',
    homePage: 'Página de inicio',
    heroPhotos: 'Fotos de portada',
    menu: 'Menú',
    subpagesLive: (live: number, total: number) =>
      `${live} de ${total} ${total === 1 ? 'página publicada' : 'páginas publicadas'}`,
    noMatches: 'No hay entradas que coincidan.',
    newSubpage: 'Nueva página',
    newPage: 'Nueva página de contenido',
    notInMenu: 'Fuera del menú',
    offMenuEmpty:
      'Páginas accesibles solo mediante su enlace. Arrastra una página aquí para sacarla del menú.',
    standaloneGroup: 'Álbumes independientes',
    onHomePage: 'En la página de inicio',
    /** The panel for standalone albums. */
    standaloneHeading: 'Álbumes independientes',
    addAlbum: '+ Añadir álbum',
    noMatchingStandalone: 'No se han encontrado álbumes independientes que coincidan.',
    noStandalone: 'No hay álbumes independientes. Se muestran directamente en la página de inicio.',
    /** The panel for the home page hero. */
    addHero: 'Añadir portada',
    heroPickerTitle: 'Elegir imágenes de portada para la página de inicio',
    noHero:
      'No hay imágenes de portada configuradas. Añade fotos para mostrar un carrusel de portada en la página de inicio.',
  },

  /** Seed values for a new page or section, written into gallery.yaml. */
  defaults: {
    subpageName: (n: number) => `Nueva página ${n}`,
    sectionTitle: 'Nueva sección',
  },

  /** The per-album photo order (Listbox options and the card's badge tooltip). */
  sort: {
    immich: 'Orden de Immich (predeterminado)',
    newest: 'Más recientes primero',
    oldest: 'Más antiguas primero',
    filename: 'Nombre de archivo',
    manual: 'Manual',
  },

  albumCard: {
    unlisted: 'Álbum independiente no listado',
    reorder: (name: string) => `Reordenar ${name}`,
    dragToReorder: 'Arrastra para reordenar',
    editDetails: 'Editar detalles',
    removeAlbum: 'Quitar álbum',
    passwordProtected: 'Protegido con contraseña',
    customHero: 'Foto de portada personalizada definida',
    /** `label` is one of the `sort` labels. */
    photoOrder: (label: string) => `Orden de las fotos: ${label}`,
    photos: (n: number) => `${n} ${n === 1 ? 'foto' : 'fotos'}`,
  },

  albumDrawer: {
    link: 'Enlace',
    linkHint:
      'Es la dirección que usan los visitantes. Deja el slug vacío para derivarlo del título.',
    randomLink: 'Enlace aleatorio',
    copyLink: 'Copiar enlace',
    linkCopied: 'Copiado',
    visibility: 'Visibilidad',
    unlisted: 'No listado',
    unlistedDesc:
      'Solo accesible mediante enlace directo: no aparece en el menú, la página de inicio, el sitemap ni el mapa. Una URL basada en el título se puede adivinar, un enlace aleatorio apenas; añade una contraseña para lo que deba ser privado.',
    listedDesc:
      'Se muestra en el menú, la página de inicio y el sitemap, como cualquier otro álbum independiente.',
    heading: 'Editar detalles del álbum',
    close: 'Cerrar detalles',
    photos: (n: number) => `${n} ${n === 1 ? 'foto' : 'fotos'}`,
    /** Shown after the photo count when the title is overridden. */
    original: (name: string) => `Título original: ${name}`,
    titleOverride: 'Título propio',
    description: 'Descripción',
    descriptionPlaceholder: 'Descripción opcional para los visitantes',
    passwordProtection: 'Protección con contraseña',
    albumPassword: 'Contraseña del álbum',
    downloads: 'Descargas',
    allowDownloads: 'Permitir descargar los originales',
    allowDownloadsDesc:
      'Los visitantes pueden descargar todo el álbum o las fotos que hayan seleccionado en un ZIP',
    zoomInherit: 'Heredar de la página o de los ajustes del sitio',
    zoomHint:
      'Permite a los visitantes ampliar una foto en el visor para comprobar la nitidez. Los originales JPEG y AVIF se muestran sin sus datos GPS; HEIC y RAW necesitan las vistas previas a tamaño completo de Immich. PNG, WebP, GIF y las fotos editadas en Immich nunca se amplían. Se aplica allí donde el álbum aparece aquí.',
    layoutOverride: 'Diseño propio (experimental)',
    layoutOverrideAria: 'Diseño propio',
    layoutInherit: 'Heredar de la página o de los ajustes globales',
    coverFocalPoint: 'Punto focal de la portada (experimental)',
    /** "50% 25%" and "top" are CSS values; keep them as written. */
    coverFocalPointPlaceholder: 'p. ej. "50% 25%" o "top": dónde se ancla el recorte de la portada',
    customHero: 'Foto de portada personalizada',
    heroAlt: 'Portada',
    removeHero: 'Quitar la foto de portada personalizada',
    defaultCover: 'Se usa la portada predeterminada del álbum',
    pickHeroTitle: (name: string) => `Elegir foto de portada para ${name}`,
    changeImage: 'Cambiar foto',
    pickHero: 'Elegir foto de portada',
    photoOrder: 'Orden de las fotos',
    manualHint:
      'Las fotos fijadas van primero, en el orden que elijas. Las demás siguen en el orden del álbum en Immich.',
    immichHint: 'El orden de Immich sigue el ajuste de ordenación del propio álbum en Immich.',
    reorderPhotos: 'Reordenar fotos',
    reorderPhotosPinned: (n: number) => `Reordenar fotos (${n} ${n === 1 ? 'fijada' : 'fijadas'})`,
    removeAlbum: 'Quitar álbum',
    uuidTitle: 'UUID del álbum de Immich',
    copyUuid: 'Copiar UUID',
    copyUuidAria: 'Copiar el UUID del álbum de Immich',
    done: 'Listo',
  },

  subpageDrawer: {
    breadcrumb: 'Páginas',
    untitled: 'Página sin título',
    /** Accessible name of the Edit / Live Preview switch. */
    view: 'Vista',
    livePreview: 'Vista previa en directo',
    openLive: 'Abrir la página publicada en una pestaña nueva (sin caché)',
    close: 'Cerrar el panel',
    pageName: 'Nombre de la página (identificador de URL)',
    pageNamePlaceholder: 'p. ej. dubai, viajes, bodas',
    displayTitle: 'Título visible (opcional)',
    /** Sits in a half-width field; keep it short. */
    displayTitlePlaceholder: 'Igual que el nombre',
    subtitle: 'Subtítulo',
    subtitlePlaceholder: 'Texto del subtítulo',
    visibility: 'Visibilidad y acceso',
    visibilityOptions: {
      published: {
        title: 'Publicada',
        desc: 'Aparece en el menú de la cabecera y en las listas de la página de inicio; accesible por URL',
      },
      unlisted: {
        title: 'Oculta (experimental)',
        desc: 'No aparece en los menús ni en la página de inicio, pero es accesible con el enlace directo',
      },
      disabled: {
        title: 'Desactivada',
        desc: 'Totalmente fuera de línea: devuelve 404 incluso con acceso directo',
      },
    },
    passwordPlaceholder: 'Protección con contraseña (opcional): déjala vacía para acceso público',
    pagePassword: 'Contraseña de la página',
    layoutStyle: 'Estilo de diseño de la página',
    layoutStyleAria: 'Estilo de diseño de la página',
    zoomInherit: 'Heredar de los ajustes del sitio',
    zoomHint:
      'Se aplica a todos los álbumes de esta página que no tengan un ajuste propio. El interruptor para todo el sitio está en Ajustes › General.',
    coverGrid: 'Cuadrícula de portadas de álbumes',
    coverGridHint:
      'Cambia cómo se distribuyen las portadas de los álbumes en esta página; las fotos de dentro de los álbumes no se ven afectadas. Deja vacío el número de columnas para seguir el ajuste de cuadrícula del sitio, y el espaciado vacío para mantener el del tema. En anchos de tableta se muestran como máximo dos portadas por fila.',
    photoGrid: 'Cuadrícula de fotos (álbumes de esta página)',
    photoGridHint:
      'Cómo se distribuyen las fotos dentro de cada álbum de esta página. Deja ambos vacíos para seguir Ajustes › Cuadrícula; un álbum concreto aún puede cambiarlo en gallery.yaml.',
    essayHeading: 'Editor de relatos',
    essayIntro: 'Compón visualmente textos, citas y fotos anchas o a sangre.',
    essayPickerTitle: 'Seleccionar foto para el relato',
    albums: 'Álbumes de esta página',
    addAlbum: '+ Añadir álbum',
    noAlbums: 'Todavía no hay álbumes. Pulsa «+ Añadir álbum» para elegir uno de Immich.',
    /** Placeholder and accessible name of a section's title field. */
    sectionTitle: 'Título de la sección',
    removeSection: 'Quitar sección',
    sectionDescPlaceholder: 'Descripción de la sección (opcional)',
    sectionDesc: 'Descripción de la sección',
    addSection: '+ Añadir sección',
    addLooseAlbum: '+ Añadir álbum sin sección',
    deleteSubpage: 'Eliminar página',
    done: 'Listo',
  },

  /** The page drawer's Live Preview tab. */
  preview: {
    note: 'Se muestra con el preajuste de tema guardado del sitio, a ancho de escritorio. Los cambios sin guardar de este panel aparecen aquí; los cambios de tema, una vez guardados en Ajustes.',
    settingsFailed: (error: string) =>
      `La vista previa usa la cuadrícula predeterminada y el inglés hasta que se carguen los ajustes del sitio. ${error}`,
  },

  /** Rows and tiles of the structure list. */
  tiles: {
    reorderHero: (n: number) => `Reordenar la foto de portada ${n}`,
    reorder: (name: string) => `Reordenar ${name}`,
    /** Stands in for a page without a name in `reorder`. */
    pageFallback: 'página',
    dragToReorder: 'Arrastra para reordenar',
    disabledTitle: 'La página está desactivada',
    disabled: 'Desactivada',
    unlistedTitle: 'Oculta en la navegación, accesible con el enlace directo',
    /** Short state badges in a list row; one word. */
    unlisted: 'Oculta',
    off: 'Inactiva',
    missing: 'Falta',
    draft: 'Borrador',
    /** Tag marking a content page, as opposed to a page that groups albums. */
    page: 'Contenido',
    passwordProtected: 'Protegida con contraseña',
    password: 'Contraseña',
    editPage: 'Editar página',
    albums: (n: number) => `${n} ${n === 1 ? 'álbum' : 'álbumes'}`,
  },

  newPage: {
    title: 'Nueva página de contenido',
    titleLabel: 'Título',
    titlePlaceholder: 'p. ej. Tarifas',
    url: 'URL',
    /** An example slug: lowercase letters, digits and dashes only. */
    slugPlaceholder: 'tarifas',
    /** Shown as "/slug" while no slug is typed; same rules as above. */
    slugFallback: 'ruta',
    exists: (slug: string) => `Ya existe una página de contenido «${slug}».`,
    hint: 'Empieza en blanco y como borrador. Puedes cambiar la URL más adelante.',
    showInMenu: 'Mostrar en el menú',
    showInMenuDesc: 'La añade al final del menú; se guarda con «Guardar cambios».',
    creating: 'Creando…',
    create: 'Crear página',
  },

  pagePanel: {
    noFile: 'No hay ningún archivo para esta página en content/pages/.',
    exists: (slug: string) => `Ya existe una página «${slug}».`,
    moveTitle: (slug: string) => `¿Mover esta página a /${slug}?`,
    linksBreak: (slug: string) =>
      `Los enlaces a /${slug} dejarán de funcionar. No hay redirección automática.`,
    movePage: 'Mover página',
    notSavedConflict:
      'No se ha guardado: la página se ha cambiado en otro lugar. Tus cambios siguen aquí.',
    saveFailed: 'No se ha podido guardar la página',
    saved: 'Página guardada.',
    saveOffline: 'No se ha podido guardar la página. Comprueba la conexión e inténtalo de nuevo.',
    deleteTitle: (name: string) => `¿Eliminar «${name}»?`,
    deleteMessageInMenu:
      'La página también se quita del menú en gallery.yaml. Antes se hace una copia de seguridad de ambos archivos, que puedes restaurar en Copias de seguridad.',
    deleteMessage: 'Se conserva una copia que puedes restaurar en Copias de seguridad.',
    deletePage: 'Eliminar página',
    deleteFailed: 'No se ha podido eliminar la página',
    deleted: 'Página eliminada.',
    deleteOffline:
      'No se ha podido eliminar la página. Comprueba la conexión e inténtalo de nuevo.',
    loadFailed: 'No se ha podido cargar esta página.',
    menuStillLists:
      'El menú todavía la incluye. Desactiva «Mostrar en el menú» y guarda la estructura para quitar la entrada.',
    removeFromMenu: 'Quitar del menú',
    openLive: 'Abrir la página publicada en una pestaña nueva',
    title: 'Título',
    url: 'URL',
    slugHint:
      'Se comprueba con las páginas, los álbumes, las entradas del diario y las rutas integradas.',
    showInMenu: 'Mostrar en el menú',
    inMenuDesc:
      'Aparece en el menú de la cabecera. Arrástrala en la lista de estructura para moverla.',
    offMenuDesc:
      'No está en el menú, pero es accesible en su URL: para páginas que se comparten por enlace.',
    /** Follows `inMenuDesc` / `offMenuDesc`. */
    savedWithStructure: 'Se guarda con «Guardar cambios».',
    draft: 'Borrador',
    draftDesc: 'Solo tú puedes ver un borrador. No aparece en el menú ni en el sitemap.',
    password: 'Contraseña (opcional)',
    pagePassword: 'Contraseña de la página',
    seoDescription: 'Descripción SEO',
    seoPlaceholder: 'Una o dos frases para los buscadores y las vistas previas de enlaces',
    editContent: 'Editar contenido →',
    savePage: 'Guardar página',
  },

  /** The story block editor in a page set to "Story Layout". */
  essay: {
    /** The starting story of an empty essay: a "# heading" and a paragraph. */
    starterTitle: 'Título',
    starterBody: 'Escribe tu historia aquí…',
    /** Text a newly added block starts with. */
    newHeading: 'Nuevo encabezado de sección',
    newParagraph: 'Escribe aquí el párrafo…',
    newQuote: 'Escribe aquí la cita…',
    toolbar: 'Añadir bloque:',
    add: {
      paragraph: '+ Párrafo',
      heading: '+ Encabezado',
      quote: '+ Cita destacada',
      facts: '+ Datos',
      photo: '+ Foto',
      photoPair: '+ Pareja de fotos',
      photoGrid: '+ Cuadrícula de fotos',
      album: '+ Álbum',
      map: '+ Mapa',
    },
    empty: 'Todavía no hay bloques. ¡Usa los botones de arriba para construir tu relato!',
    moveUp: 'Subir',
    moveDown: 'Bajar',
    deleteBlock: 'Eliminar bloque',
    headingLevel: 'Nivel de encabezado',
    headingPlaceholder: 'Encabezado de sección…',
    /** `**bold**` and `*italic*` are markdown syntax; keep the asterisks. */
    paragraphPlaceholder: 'Escribe el párrafo… (admite Markdown: **negrita**, *cursiva*)',
    quotePlaceholder: 'Texto de la cita…',
    authorPlaceholder: '— Autor / atribución (opcional)',
    noPhoto: 'Sin foto',
    changePhoto: 'Cambiar foto',
    selectPhoto: 'Seleccionar foto',
    /** Width options of a photo block; the measures are CSS units. */
    contained: 'Contenida (68ch)',
    wide: 'Ancha (1100px)',
    fullbleed: 'A sangre (100vw)',
    assetUuidPlaceholder: 'UUID del recurso de Immich…',
    photoCaption: 'Pie de foto (opcional)',
    photoN: (n: number) => `Foto ${n}`,
    selectPhotoN: (n: number) => `Seleccionar foto ${n}`,
    uuidN: (n: number) => `UUID ${n}…`,
    swapPhotos: 'Intercambiar foto 1 y foto 2',
    pairCaption: 'Pie común para las dos fotos (opcional)',
    removePhoto: 'Quitar foto',
    select: 'Elegir',
    change: 'Cambiar',
    addPhoto: 'Añadir foto',
    gridCaption: 'Pie de la cuadrícula (opcional)',
    factLabel: 'Etiqueta, p. ej. Distancia',
    factValue: 'Valor, p. ej. 21 km',
    removeFact: 'Quitar dato',
    addFact: 'Añadir dato',
    albumUuidPlaceholder:
      'UUID del álbum de Immich (el selector de álbumes de Páginas muestra los ID)',
    countPlaceholder: 'Cantidad (todas)',
    count: 'Cantidad',
    skipPlaceholder: 'Omitir (0)',
    skip: 'Omitir',
    layout: 'Diseño',
    albumLayouts: {
      grid: 'Cuadrícula (filas de tres)',
      pairs: 'Parejas (filas de dos)',
      wide: 'Ancho (una por fila)',
    },
    albumCaption: 'Pie del conjunto (opcional)',
    albumHint:
      'Al mostrarse la página se convierte en bloques de foto, en el orden del álbum (primero un orden manual de la galería). Deja la cantidad vacía para todo el álbum.',
    mapCaption: 'Pie, p. ej. Busan → Seúl (opcional)',
    pointLabel: 'Etiqueta (opcional)',
    latitude: 'Latitud',
    /** Placeholders of the latitude / longitude fields; keep them short. */
    lat: 'Lat.',
    longitude: 'Longitud',
    lng: 'Long.',
    photoUuidPlaceholder: 'UUID de la foto…',
    allPhotosItem: 'Todas las fotos geolocalizadas de los álbumes de esta página, en orden',
    removePin: 'Quitar marcador',
    invalidPoint:
      'Un punto necesita una latitud entre ±90 y una longitud entre ±180; los puntos sin coordenadas válidas no se guardan.',
    addPoint: 'Punto',
    addPhotoPin: 'Marcador de foto',
    addAllPhotos: 'Todas las fotos geolocalizadas',
    connectLine: 'Unir los marcadores con una línea',
    mapHint:
      'Los puntos introducidos se publican tal cual. Los marcadores de foto se colocan en la página publicada según el GPS de la foto, con la precisión de ubicación del álbum. Solo se muestra mientras el mapa esté activado en Ajustes.',
  },
  collision: {
    invalid: (slug: string) =>
      `«${slug}» no es una ruta válida: usa solo letras, números, «-» y «_».`,
    reserved: (slug: string) => `/${slug} es una ruta propia del sitio.`,
    subpage: (slug: string) => `/${slug} ya es una página.`,
    album: (slug: string) => `/${slug} ya es un álbum independiente.`,
    journal: (slug: string) => `Una entrada del diario ya usa la ruta «${slug}».`,
  },
};
