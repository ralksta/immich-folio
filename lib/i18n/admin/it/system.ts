import type { AdminDictionary } from '../index';

/** The help page and the backup dialog. */
export const system: AdminDictionary['system'] = {
  help: {
    kicker: 'Sistema',
    title: 'Aiuto',
    description: 'Cosa sa fare il tuo portfolio senza un pulsante dedicato.',
    viewer: 'Visualizzatore di immagini',
    /** `{question}` and `{h}` are the two keys, drawn as keycaps. */
    viewerIntro:
      'I tasti che un visitatore può premere nel visualizzatore. Di proposito non c’è una barra degli strumenti per questi comandi — un controllo fisso sopra una fotografia toglie qualcosa a ogni visitatore — ma i visitatori possono richiamare lo stesso elenco con {question} o {h}.',
    /**
     * When a conditional key is absent, keyed by the shortcut's label key in
     * `lib/lightboxShortcuts.ts`. The shortcut names themselves come from the
     * visitor dictionary of the panel's language.
     */
    notes: {
      shortcutInfo:
        'Nascosto dove tutti i gruppi EXIF sono disattivati e negli articoli del diario.',
      shortcutFullscreen:
        'Assente nei browser che non supportano lo schermo intero per un elemento, come Safari su iPhone.',
      shortcutSlideshow:
        'Passa da spenta a 3 s, 5 s, 10 s e di nuovo a spenta. Qualsiasi freccia o swipe la interrompe.',
      shortcutCopyLink:
        'Copia un link alla foto sullo schermo. Il link indica una posizione: se riordini l’album, cambia la foto a cui porta.',
      shortcutDownload: 'Solo per gli album con download: true in gallery.yaml.',
      shortcutZoom:
        'Solo dove lo zoom è attivo (impostazioni, pagina o album) e la foto ha una sorgente a risoluzione piena.',
      shortcutZoomReset:
        'Torna alla foto intera. Esc fa lo stesso, prima di chiudere il visualizzatore.',
    },
    diagnostics: 'Diagnostica',
    /** `{tab}` is the sidebar entry's name (`diagnosticsTab`), shown bold. */
    diagnosticsIntro:
      'Controlla le cose che si guastano senza dare segni — un numero di hop del proxy sbagliato, un ID di album eliminato, una password in chiaro, un album che Immich non considera condiviso. Aprila da {tab} nella barra laterale; il badge di stato sotto il menu ti dice comunque al volo se in questo momento qualcosa richiede attenzione.',
    diagnosticsTab: 'Diagnostica',
  },

  backups: {
    title: 'Cronologia e ripristino dei backup',
    subtitle:
      'Ripristina una versione precedente delle pagine, delle impostazioni, della pagina «Chi sono», del diario o delle pagine di contenuto, compresi gli articoli del diario e le pagine eliminati.',
    /** One tab per kind of file; `files` names it in the empty state. */
    tabs: {
      gallery: 'Galleria',
      settings: 'Impostazioni',
      about: 'Chi sono',
      privacy: 'Privacy',
      journal: 'Diario',
      pages: 'Pagine di contenuto',
    },
    /** Follows «per» in `empty`. */
    files: {
      gallery: 'gallery.yaml',
      settings: 'settings.yaml',
      about: 'about.md',
      privacy: 'privacy.md',
      journal: 'gli articoli del diario',
      pages: 'le pagine di contenuto',
    },
    tabLabel: (label: string, n: number) => `${label} (${n})`,
    restoreFailed: 'Ripristino del backup non riuscito',
    restoreError: 'Errore durante il ripristino del backup',
    restoredPage: (slug: string) => `Pagina «${slug}» ripristinata.`,
    restoredEntry: (slug: string) => `Articolo del diario «${slug}» ripristinato.`,
    restored: (file: string) => `Backup ripristinato correttamente! (${file})`,
    confirmTitle: 'Conferma il ripristino',
    /** `{file}` is the backup's file name, set in code. */
    confirmBody:
      'Vuoi davvero ripristinare {file}? Prima del ripristino viene creata automaticamente un’istantanea di sicurezza dello stato attuale.',
    restoring: 'Ripristino...',
    restoreNow: 'Sì, ripristina ora',
    loading: 'Caricamento dei backup...',
    empty: (what: string) => `Ancora nessun backup disponibile per ${what}`,
    deleted: 'Eliminato',
    deletedTitle: 'Istantanea creata al momento dell’eliminazione',
    preRestore: 'Istantanea pre-ripristino',
    preRestoreTitle: 'Istantanea di sicurezza creata prima di un ripristino',
    restore: 'Ripristina',
    hideOlder: 'Nascondi i backup meno recenti',
    showOlder: (n: number) =>
      `Mostra ${n} ${n === 1 ? 'backup meno recente' : 'backup meno recenti'}`,
  },
};
