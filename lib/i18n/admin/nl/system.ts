import type { AdminDictionary } from '../index';

/** The help page and the backup dialog. */
export const system: AdminDictionary['system'] = {
  help: {
    kicker: 'Systeem',
    title: 'Help',
    description: 'Wat je portfolio kan zonder dat er een eigen knop voor is.',
    viewer: 'Fotoviewer',
    /** `{question}` and `{h}` are the two keys, drawn as keycaps. */
    viewerIntro:
      'Toetsen die een bezoeker in de fotoviewer kan gebruiken. Er is bewust geen werkbalk voor — een vast bedieningselement over een foto kost elke bezoeker iets — maar bezoekers kunnen dezelfde lijst oproepen met {question} of {h}.',
    /**
     * When a conditional key is absent, keyed by the shortcut's label key in
     * `lib/lightboxShortcuts.ts`. The shortcut names themselves come from the
     * visitor dictionary of the panel's language.
     */
    notes: {
      shortcutInfo: 'Verborgen als elke EXIF-groep is uitgeschakeld, en in journalverhalen.',
      shortcutFullscreen:
        'Ontbreekt in browsers die geen elementen op volledig scherm kunnen tonen, zoals Safari op de iPhone.',
      shortcutSlideshow:
        'Wisselt tussen uit, 3 s, 5 s, 10 s en weer uit. Elke pijltoets of veegbeweging stopt de diavoorstelling.',
      shortcutCopyLink:
        'Kopieert een link naar de foto op het scherm. De link volgt de positie: als je het album herschikt, verandert de foto waar hij uitkomt.',
      shortcutDownload: 'Alleen voor albums met download: true in gallery.yaml.',
      shortcutZoom:
        'Alleen waar fotozoom aanstaat (in de instellingen, op de pagina of het album) en de foto een bron op volledige resolutie heeft.',
      shortcutZoomReset:
        'Terug naar de hele foto. Esc doet hetzelfde voordat de viewer wordt gesloten.',
    },
    diagnostics: 'Diagnose',
    /** `{tab}` is the sidebar entry's name (`diagnosticsTab`), shown bold. */
    diagnosticsIntro:
      'Controleert de dingen die ongemerkt misgaan — een verkeerd aantal proxyhops, een verwijderd album-ID, een wachtwoord in platte tekst, een album dat Immich niet als gedeeld beschouwt. Open het via {tab} in de zijbalk; het statuslabel onder het menu laat nog steeds snel zien of er nu iets aandacht nodig heeft.',
    diagnosticsTab: 'Diagnose',
  },

  backups: {
    title: 'Back-upgeschiedenis & terugzetten',
    subtitle:
      'Zet een eerdere versie van je pagina’s, instellingen, Over-mij-pagina, journal of inhoudspagina’s terug — ook van verwijderde journalverhalen en pagina’s.',
    /** One tab per kind of file; `files` names it in the empty state. */
    tabs: {
      gallery: 'Galerij',
      settings: 'Instellingen',
      about: 'Over mij',
      privacy: 'Privacy',
      journal: 'Journal',
      pages: 'Inhoudspagina’s',
    },
    files: {
      gallery: 'gallery.yaml',
      settings: 'settings.yaml',
      about: 'about.md',
      privacy: 'privacy.md',
      journal: 'journalverhalen',
      pages: 'inhoudspagina’s',
    },
    tabLabel: (label: string, n: number) => `${label} (${n})`,
    restoreFailed: 'Back-up terugzetten mislukt',
    restoreError: 'Fout bij het terugzetten van de back-up',
    restoredPage: (slug: string) => `Pagina “${slug}” teruggezet.`,
    restoredEntry: (slug: string) => `Journalverhaal “${slug}” teruggezet.`,
    restored: (file: string) => `Back-up teruggezet! (${file})`,
    confirmTitle: 'Terugzetten bevestigen',
    /** `{file}` is the backup's file name, set in code. */
    confirmBody:
      'Weet je zeker dat je {file} wilt terugzetten? Voordat er iets wordt teruggezet, wordt automatisch een veiligheidskopie van de huidige staat gemaakt.',
    restoring: 'Terugzetten…',
    restoreNow: 'Ja, nu terugzetten',
    loading: 'Back-ups laden…',
    empty: (what: string) => `Nog geen back-ups beschikbaar voor ${what}`,
    deleted: 'Verwijderd',
    deletedTitle: 'Momentopname gemaakt toen het item werd verwijderd',
    preRestore: 'Vóór terugzetten',
    preRestoreTitle: 'Veiligheidskopie gemaakt vóór het terugzetten',
    restore: 'Terugzetten',
    hideOlder: 'Oudere back-ups verbergen',
    showOlder: (n: number) => `${n} oudere ${n === 1 ? 'back-up' : 'back-ups'} tonen`,
  },
};
