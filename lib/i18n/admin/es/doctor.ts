import type { AdminDictionary } from '../index';

/**
 * Config doctor findings (`lib/admin/doctor.ts`, `app/api/admin/doctor/route.ts`),
 * one group per check. Built on the server and shown on /admin/diagnostics.
 *
 * Environment variable names, YAML keys, file paths and header names stay as
 * written in every language — they are what the operator has to type.
 */
export const doctor: AdminDictionary['doctor'] = {
  authSecret: {
    missingTitle: 'AUTH_SECRET no está definido',
    missingDetail:
      'Los tokens de los recursos y todas las cookies de autenticación se firman con un secreto que se ' +
      'regenera en cada reinicio, así que los enlaces y las sesiones se rompen cada vez que se reinicia ' +
      'el servidor. Define AUTH_SECRET con una cadena aleatoria larga.',
    shortTitle: (length: number) =>
      `AUTH_SECRET solo tiene ${length} ${length === 1 ? 'carácter' : 'caracteres'}`,
    shortDetail: (min: number) =>
      `Usa al menos ${min} caracteres aleatorios: es la clave de todos los tokens de recursos y cookies de autenticación.`,
    okTitle: 'AUTH_SECRET está definido',
    okDetail: (length: number) => `${length} ${length === 1 ? 'carácter' : 'caracteres'}.`,
  },

  proxyHops: {
    noProxyTitle: 'No se ha detectado ningún proxy inverso',
    noProxyInconclusiveDetail:
      'La única entrada de X-Forwarded-For es la que Next añade a una petición directa, lo que coincide con TRUSTED_PROXY_HOPS=0.',
    noProxyDetail:
      'Esta petición ha llegado sin X-Forwarded-For, lo que coincide con TRUSTED_PROXY_HOPS=0.',
    notSeenTitle: (configured: number) =>
      `TRUSTED_PROXY_HOPS vale ${configured}, pero esta petición no muestra ningún proxy`,
    notSeenDetail:
      'O bien has accedido al panel de administración directamente mientras el tráfico público pasa por un proxy ' +
      '(en ese caso no pasa nada), o el valor es demasiado alto y todos los visitantes comparten un mismo cupo de límite de peticiones.',
    unsetTitle: (seen: number) =>
      `Se ha visto una cadena de ${seen} ${seen === 1 ? 'proxy' : 'proxies'}, pero TRUSTED_PROXY_HOPS vale 0`,
    unsetDetail: (seen: number) =>
      'La IP del cliente se lee de una cabecera que el propio cliente puede fijar, así que el límite de peticiones ' +
      `se puede eludir falsificándola. Define TRUSTED_PROXY_HOPS como ${seen} (solo nginx, Traefik o Caddy = 1).`,
    tooHighTitle: (configured: number, seen: number) =>
      `TRUSTED_PROXY_HOPS vale ${configured}, pero solo se ${
        seen === 1 ? 'ha visto 1 salto' : `han visto ${seen} saltos`
      } de proxy`,
    tooHighDetail: (seen: number) =>
      'La posición que se lee queda antes del inicio de la cadena, así que la IP del cliente recurre a ' +
      `algo poco fiable. Esta petición sugiere ${seen}.`,
    tooLowTitle: (configured: number, seen: number) =>
      `TRUSTED_PROXY_HOPS vale ${configured}, pero se ha visto una cadena de ${seen} saltos de proxy`,
    tooLowDetail: (seen: number) =>
      'La IP del cliente se lee de una posición que todavía está dentro de la cadena de proxies, no del cliente real: ' +
      `todos los visitantes detrás de ese salto pueden compartir un mismo cupo de límite de peticiones. Esta petición sugiere ${seen}.`,
    okTitle: (configured: number) =>
      `TRUSTED_PROXY_HOPS=${configured} coincide con la cadena observada`,
    okDetail: (seen: number) =>
      `X-Forwarded-For llevaba ${seen} ${seen === 1 ? 'entrada' : 'entradas'} en esta petición.`,
  },

  cdn: {
    passwordTitle: 'CDN_URL está definido, pero las fotos se sirven desde este servidor',
    passwordDetail:
      'El sitio está protegido con contraseña y una CDN entregaría las fotos en caché a cualquiera con un ' +
      'enlace, así que el modo CDN sigue desactivado. Quita la contraseña del sitio o elimina CDN_URL.',
    noHopsTitle: 'El modo CDN está activado, pero TRUSTED_PROXY_HOPS vale 0',
    noHopsDetail: (cdnUrl: string) =>
      `Las fotos se sirven a través de ${cdnUrl} y, sin TRUSTED_PROXY_HOPS, el limitador de peticiones ` +
      'cuenta el nodo de la CDN en lugar del visitante. Defínelo con el número de proxies delante de ' +
      'la aplicación, incluida la CDN.',
    okTitle: 'El modo CDN está activado',
    okDetail: (cdnUrl: string) => `Las fotos y los vídeos se sirven a través de ${cdnUrl}.`,
  },

  albumIds: {
    noneTitle: 'No hay álbumes configurados',
    noneDetail:
      'gallery.yaml no incluye ningún álbum, así que la galería no tiene nada que mostrar.',
    missingTitle: (missing: number, total: number) =>
      `${missing} de ${total} ID de álbum no existen en Immich`,
    /** `ids` is a comma-separated list of album IDs. */
    missingDetail: (ids: string) =>
      `Esas páginas quedan vacías sin avisar. Revisa en gallery.yaml: ${ids}`,
    okTitle: (total: number) => `Los ${total} ID de álbum se resuelven`,
    okDetail: 'Todos los álbumes de gallery.yaml existen en Immich.',
  },

  albumsShared: {
    okTitle: 'Todos los álbumes publicados están compartidos en Immich',
    okDetail: 'No se publica nada que Immich todavía considere privado.',
    warnTitle: (n: number) =>
      n === 1
        ? `${n} álbum publicado no está compartido en Immich`
        : `${n} álbumes publicados no están compartidos en Immich`,
    /** `names` is a comma-separated list of album names. */
    warnDetail: (names: string) =>
      'Se sirven a los visitantes de todos modos: lo que decide es la lista de permitidos de gallery.yaml. ' +
      `Merece la pena revisarlo si no era intencionado: ${names}`,
  },

  downloadMetadata: {
    okTitle: 'Las descargas salen sin GPS',
    okDetail: (albums: number) =>
      `Todos los originales ${albums === 1 ? 'del álbum de descarga' : `de los ${albums} álbumes de descarga`} son JPEG, HEIC, AVIF, MP4 o MOV y se sirven sin la ubicación.`,
    warnTitle: (files: number) =>
      files === 1
        ? `${files} original descargable conserva todos los metadatos`
        : `${files} originales descargables conservan todos los metadatos`,
    /** `located`: how many of the files Immich has GPS for (0 = say nothing). `albums`: "Name (3), …". */
    warnDetail: (located: number, albums: string) =>
      'Los archivos RAW, DNG, PNG, TIFF y WebP, y los vídeos que no son MP4 ni MOV, se sirven tal como están guardados, con sus ' +
      `coordenadas GPS${located ? ` (Immich tiene la ubicación de ${located} de ellos)` : ''}. ` +
      'Desactiva las descargas o quita estos archivos si su ubicación debe seguir siendo privada: ' +
      albums,
  },

  zoomRenditions: {
    okTitle: 'Immich tiene vistas previas a tamaño completo para el zoom',
    okDetail: (photos: number) =>
      `${photos} ${photos === 1 ? 'foto' : 'fotos'} HEIC, RAW o similares de los álbumes con zoom se amplían mediante la versión a tamaño completo de Immich, sin la ubicación.`,
    missingTitle: (photos: number) =>
      `${photos} ${photos === 1 ? 'foto no se puede' : 'fotos no se pueden'} ampliar: Immich no tiene vista previa a tamaño completo`,
    /** `albums`: "Name (3), …". The menu path is Immich's own English UI. */
    missingDetail: (albums: string) =>
      'HEIC, RAW y otros formatos que un navegador no puede mostrar se amplían mediante la versión a ' +
      'tamaño completo de Immich, y Immich no tiene ninguna (se ha comprobado una foto de muestra). Los ' +
      'visitantes ven el botón de zoom y después «no disponible». En Immich, activa Administration › ' +
      'Settings › Image Settings › Full-size image (JPEG) y ejecuta la tarea Generate Thumbnails para ' +
      'los recursos que faltan. Álbumes: ' +
      albums,
    formatTitle: (photos: number) =>
      `${photos} ${photos === 1 ? 'foto no se puede' : 'fotos no se pueden'} ampliar: el formato a tamaño completo de Immich no es JPEG`,
    /** `contentType` is empty when Immich did not name one. */
    formatDetail: (contentType: string, albums: string) =>
      `Immich genera sus vistas previas a tamaño completo como ${contentType || 'un tipo desconocido'}, y ` +
      'el zoom solo sirve versiones JPEG: sus metadatos de ubicación se eliminan al salir, algo que ' +
      'Folio no puede hacer con WebP. Fija Administration › Settings › Image Settings › Full-size image ' +
      '› Format en JPEG y ejecuta la tarea Generate Thumbnails. Álbumes: ' +
      albums,
  },

  albumSlugs: {
    /** Where a set of albums shares one URL prefix — the top level of the site… */
    contextStandalone: 'álbumes de gallery.yaml',
    /** …or a page. */
    contextSubpage: (name: string) => `página «${name}»`,
    collision: (context: string, names: string[], slug: string) =>
      `${context}: «${names.join('» y «')}» apuntan todos a /${slug}`,
    errorTitle: (n: number) =>
      n === 1
        ? `Se ha encontrado ${n} colisión de slugs de álbum`
        : `Se han encontrado ${n} colisiones de slugs de álbum`,
    /** `collisions` is the `collision` lines joined with "; ". */
    errorDetail: (collisions: string) =>
      'En cada colisión, todos los álbumes después del primero son inaccesibles en su propia URL, y sus ' +
      `ajustes se toman del anterior. ${collisions}`,
    okTitle: 'No hay colisiones de slugs de álbum',
    okDetail: 'Todos los álbumes accesibles bajo el mismo prefijo de URL tienen un slug distinto.',
  },

  passwords: {
    /** Where a password lives, listed in the findings below. */
    labelSite: 'Contraseña del sitio',
    labelSubpage: (slug: string) => `Página ${slug}`,
    labelAlbum: (slug: string) => `Álbum ${slug}`,
    labelJournal: (slug: string) => `Diario ${slug}`,
    bcryptTitle: (n: number) =>
      n === 1 ? `${n} contraseña sigue usando bcrypt` : `${n} contraseñas siguen usando bcrypt`,
    bcryptDetail: (labels: string) =>
      'Ya no se admite bcrypt, así que nadie puede desbloquearlas. Sustitúyelas una vez por texto plano, ' +
      `inicia sesión y pega el hash scrypt: del registro: ${labels}`,
    plaintextTitle: (n: number) =>
      n === 1
        ? `${n} contraseña está guardada en texto plano`
        : `${n} contraseñas están guardadas en texto plano`,
    plaintextDetail: (labels: string) =>
      'Quien lea el archivo lee la contraseña. Guardar una vez la página, la entrada o el ajuste ' +
      'en el panel de administración la guarda con hash; en un archivo editado a mano, inicia sesión una vez y pega el ' +
      `hash scrypt: que aparece en el registro del servidor: ${labels}`,
    noneTitle: 'No hay contraseñas configuradas',
    noneDetail: 'Nada en este sitio está protegido con contraseña.',
    okTitle: (n: number) => `Todas las contraseñas (${n}) tienen hash`,
    okDetail: 'Todas las contraseñas configuradas usan un hash scrypt:.',
  },

  legal: {
    /** Impressum fields, listed after `missing`. */
    fieldName: 'nombre',
    fieldAddress: 'dirección',
    fieldZipCity: 'código postal y ciudad',
    missing: (fields: string) => `Falta: ${fields}.`,
    noEmail: 'No hay dirección de correo electrónico; el § 5 DDG la exige.',
    badContactUrl: 'Se ignora la URL del formulario de contacto porque no empieza por http(s)://.',
    emailOnly:
      'El correo es el único canal de contacto. Añade un teléfono, una URL de formulario de contacto o activa el formulario de contacto integrado.',
    gapsTitle: (n: number) =>
      `Al aviso legal le ${n === 1 ? 'falta' : 'faltan'} ${n} ${n === 1 ? 'dato' : 'datos'}`,
    okTitle: 'El aviso legal está completo',
    okDetail: 'Están definidos el nombre, la dirección, el correo y un segundo canal de contacto.',
  },

  contact: {
    noNotifyTitle: 'Los mensajes del formulario de contacto no avisan a nadie',
    noNotifyDetail:
      'Los mensajes nuevos solo aparecen en Mensajes, en el panel de administración. Define una URL de ntfy para enterarte.',
    badUrlTitle: 'Se ignora la URL de notificación de contacto',
    badUrlDetail: 'No empieza por http(s)://, así que no se envía ninguna notificación.',
    okTitle: 'El formulario de contacto te avisa',
    okDetail: 'Cada mensaje nuevo genera una notificación.',
  },

  settingValues: {
    /** Names of the settings `validateSettingValues` checks. */
    labels: {
      url: 'URL del sitio',
      themeAccent: 'color de acento',
      themeRadius: 'radio de las esquinas',
      gridColumns: 'columnas de la cuadrícula',
      gridGap: 'espaciado de la cuadrícula',
      retentionDays: 'conservación de mensajes',
      navLinks: 'enlaces de la cabecera',
    },
    okTitle: 'Los ajustes se usan tal como están escritos',
    okDetail:
      'La URL del sitio, el tema, la cuadrícula, la conservación de mensajes y los enlaces de la cabecera de settings.yaml son válidos.',
    oneIgnoredTitle: (name: string) => `Se ignora el ajuste «${name}»`,
    manyIgnoredTitle: (n: number) => `Se ignoran ${n} ajustes`,
    ignoredDetail: (names: string) =>
      `settings.yaml contiene un valor que el sitio no puede usar para: ${names}. ` +
      'En su lugar, el sitio usa un valor predeterminado o el valor permitido más cercano. Abre el ajuste para ver qué espera.',
  },

  privacy: {
    okTitle: 'La política de privacidad está publicada',
    okDetail: 'Se muestra en /privacy y se enlaza en el pie de página.',
    missingTitle: 'No hay política de privacidad',
    switchedOffDetail:
      'El texto existe, pero la página de privacidad está desactivada, así que /privacy responde 404.',
    noTextDetail:
      'El aviso legal está activado, pero /privacy no tiene texto. Ajustes → Información legal enumera lo que procesa este sitio, como punto de partida.',
  },

  writable: {
    errorTitle: (n: number) =>
      n === 1
        ? `${n} ruta de contenido no tiene permiso de escritura`
        : `${n} rutas de contenido no tienen permiso de escritura`,
    errorDetail: (paths: string) =>
      'Guardar desde el panel de administración fallará, y también las copias de seguridad. Revisa el propietario del ' +
      `volumen montado: ${paths}`,
    okTitle: 'content/ tiene permiso de escritura',
    okDetail: 'Se pueden guardar la configuración, el diario y las copias de seguridad.',
  },

  immichApi: {
    notConfiguredTitle: 'No hay ninguna URL ni clave de API de Immich configurada',
    notConfiguredDetail:
      'Define IMMICH_API_URL e IMMICH_API_KEY, o ejecuta el asistente de configuración en /install.',
    failedTitle: (failed: number, total: number) =>
      `${failed} de ${total} llamadas a Immich han fallado`,
    failedDetail: (endpoints: string) =>
      `Revisa IMMICH_API_URL y la clave de API. Fallan: ${endpoints}`,
    okTitle: 'Immich responde a todas las llamadas que hace Folio',
  },

  contentPages: {
    takenTitle: (n: number) =>
      n === 1
        ? `${n} página de contenido tiene un slug que ya está ocupado`
        : `${n} páginas de contenido tienen un slug que ya está ocupado`,
    /** `reasons`: one sentence per page, in English (from lib/pages). `missing`: '' or a list. */
    takenDetail: (reasons: string, missing: string) =>
      reasons +
      ' Cambia el nombre de la página en Páginas para que los visitantes puedan llegar a ella.' +
      (missing ? ` El menú también incluye páginas que no existen: ${missing}.` : ''),
    missingTitle: (n: number) =>
      `El menú incluye ${n} ${n === 1 ? 'página que no existe' : 'páginas que no existen'}`,
    missingDetail: (list: string) =>
      `gallery.yaml hace referencia a ${list}, pero content/pages/ no tiene ese archivo. ` +
      'El menú omite la entrada; quita la referencia o crea la página.',
    okTitle: (n: number) =>
      `${n} ${n === 1 ? 'página de contenido' : 'páginas de contenido'}, ningún slug repetido`,
    okDetail: (inMenu: number) => `${inMenu} de ellas en el menú.`,
  },
};
