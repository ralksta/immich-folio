import type { AdminDictionary } from '../index';

/**
 * The sidebar's "Visitors" group: the contact form inbox, client proofing
 * links and the view counts.
 */
export const visitors: AdminDictionary['visitors'] = {
  /** The page header's kicker above each of the three screens. */
  kicker: 'Visitantes',
  refresh: 'Actualizar',

  messages: {
    title: 'Mensajes',
    unread: (n: number) => `${n} sin leer`,
    description: (days: number) =>
      `Enviados desde el formulario de contacto de /contact. Se guardan en este servidor y se eliminan pasados ${days} ${days === 1 ? 'día' : 'días'}.`,
    /** `{link}` is a link labelled with `formOffLink`. */
    formOff:
      'El formulario de contacto está desactivado, así que no llegan mensajes nuevos. {link}.',
    formOffLink: 'Actívalo en Ajustes → Información legal',
    noNotify:
      'No hay ninguna notificación configurada, así que los mensajes nuevos solo aparecen aquí. {link}.',
    noNotifyLink: 'Añade una URL de ntfy en Ajustes → Información legal',
    empty: 'No hay mensajes.',
    /** Read out after the sender's name by screen readers. */
    unreadMarker: ' (sin leer)',
    reply: 'Responder por correo',
    markUnread: 'Marcar como no leído',
    delete: 'Eliminar',
    deleteTitle: (name: string) => `¿Eliminar el mensaje de ${name}?`,
    deleteMessage: 'Se borra de este servidor y no se puede restaurar.',
    deleteFailed: (status: number) => `No se ha podido eliminar (HTTP ${status}).`,
    /** The reply mail's subject line, prefilled in the owner's mail client. */
    replySubject: 'Re: tu mensaje',
    /** Introduces the quoted original in the reply mail. */
    replyQuote: (name: string) => `${name} escribió:`,
  },

  proofing: {
    title: 'Selección por clientes',
    description:
      'Un enlace privado por cliente. Las fotos elegidas se guardan sobre la marcha; las verás aquí en cuanto el cliente envíe su selección.',
    /** `{env}` is the PROOFING_WEBHOOK_URL variable name. */
    webhookTip:
      'Consejo: define {env} para recibir un aviso (Discord, Slack, Gotify, n8n…) cuando un cliente envíe su selección.',
    empty: 'Todavía no hay enlaces de clientes.',
    states: {
      open: 'Abierto',
      submitted: 'Enviado',
      expired: 'Caducado',
    },
    downloads: {
      none: 'Sin descargas',
      selection: 'Selección como ZIP',
      album: 'Álbum completo como ZIP',
    },
    create: {
      title: 'Nuevo enlace de cliente',
      client: 'Cliente',
      clientPlaceholder: 'Ana y Pablo',
      album: 'Álbum',
      chooseAlbum: 'Elige un álbum de Immich…',
      loadingAlbums: 'Cargando álbumes…',
      validUntil: 'Válido hasta (opcional)',
      downloads: 'Descargas',
      limit: 'Límite de descargas (opcional)',
      unlimited: 'Ilimitadas',
      creating: 'Creando…',
      submit: 'Crear enlace',
    },
    card: {
      albumMissing: 'No se encuentra el álbum en Immich',
      /** `of` is null when the album's size is unknown. */
      selected: (n: number, of: number | null) => {
        const word = n === 1 ? 'seleccionada' : 'seleccionadas';
        return of === null ? `${n} ${word}` : `${n} de ${of} ${word}`;
      },
      created: (date: string) => `creado el ${date}`,
      validUntil: (date: string) => `válido hasta el ${date}`,
      /** `limit` is null when downloads are unlimited. */
      downloadsUsed: (used: number, limit: number | null) =>
        limit === null
          ? `${used} ${used === 1 ? 'descarga usada' : 'descargas usadas'}`
          : `${used} / ${limit} descargas usadas`,
      submitted: (date: string) => `enviado el ${date}`,
      copied: 'Copiado',
      copyLink: 'Copiar enlace',
      /** Label of the browser prompt shown when the clipboard is unavailable. */
      copyPrompt: 'Copia:',
      open: 'Abrir',
      selection: 'Selección',
      lightroomTitle:
        'Nombres de archivo sin extensión, separados por comas: pégalos en el filtro de nombre de archivo de Lightroom o Capture One para encontrar también los archivos RAW',
      copyLightroom: 'Copiar nombres de archivo (Lightroom)',
      reopen: 'Reabrir para cambios',
      resetDownloads: 'Restablecer descargas',
      deleteLink: 'Eliminar enlace',
      deleteConfirm: (client: string) =>
        `¿Eliminar el enlace de ${client}? Dejará de funcionar de inmediato.`,
      noPicks: 'Todavía no hay fotos seleccionadas.',
    },
  },

  analytics: {
    title: 'Estadísticas',
    description:
      'Recuento de visitas sin cookies, guardado en este servidor. No se recoge ningún dato personal.',
    /** `{title}` is `disabledTitle`, shown bold; `{where}` is `disabledWhere`, in italics. */
    disabled:
      '{title} No se están registrando visitas nuevas. Puedes volver a activar el recuento cuando quieras en {where}.',
    disabledTitle: 'El recuento de visitas está desactivado.',
    disabledWhere: 'Ajustes → General',
    totalViews: 'Visitas totales',
    lifetime: 'Total desde el inicio',
    activeDays: 'Días con registro',
    daysRecorded: 'Días registrados',
    devices: 'Ordenador frente a móvil',
    deviceSplit: 'Reparto por dispositivo',
    dailyTrend: 'Tráfico diario (últimos 14 días)',
    /** Tooltip on one bar of the chart. */
    dayViews: (date: string, n: number) => `${date}: ${n} ${n === 1 ? 'visita' : 'visitas'}`,
    noViews:
      'Todavía no se ha registrado ninguna visita. ¡Visita las páginas del portfolio para empezar el recuento!',
    topPages: 'Páginas más visitadas',
    noPages: 'Todavía no se ha registrado ninguna página.',
    pageViews: (n: number) => `${n} ${n === 1 ? 'visita' : 'visitas'}`,
  },
};
