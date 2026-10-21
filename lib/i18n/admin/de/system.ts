import type { AdminDictionary } from '../index';

/** The help page and the backup dialog. */
export const system: AdminDictionary['system'] = {
  help: {
    kicker: 'System',
    title: 'Hilfe',
    description: 'Was dein Portfolio kann, ohne dass es dafür einen eigenen Button gibt.',
    viewer: 'Bildansicht',
    /** `{question}` and `{h}` are the two keys, drawn as keycaps. */
    viewerIntro:
      'Tasten, die Besucher in der Lightbox drücken können. Eine Werkzeugleiste dafür gibt es bewusst nicht — ein dauerhaftes Bedienelement über einem Foto kostet jeden Besucher etwas —, aber Besucher können dieselbe Liste mit {question} oder {h} aufrufen.',
    /**
     * When a conditional key is absent, keyed by the shortcut's label key in
     * `lib/lightboxShortcuts.ts`. The shortcut names themselves come from the
     * visitor dictionary of the panel's language.
     */
    notes: {
      shortcutInfo:
        'Ausgeblendet, wenn alle EXIF-Gruppen ausgeschaltet sind, und in Journal-Einträgen.',
      shortcutFullscreen: 'Fehlt in Browsern ohne Element-Vollbild, etwa Safari auf dem iPhone.',
      shortcutSlideshow:
        'Wechselt zwischen aus, 3 s, 5 s, 10 s und wieder aus. Jeder Pfeil und jedes Wischen beendet sie.',
      shortcutCopyLink:
        'Kopiert einen Link zum angezeigten Foto. Der Link hängt an der Position: Wird das Album umsortiert, zeigt er auf ein anderes Foto.',
      shortcutDownload: 'Nur für Alben mit download: true in gallery.yaml.',
      shortcutZoom:
        'Nur wo der Zoom eingeschaltet ist (Einstellungen, Seite oder Album) und das Foto in voller Auflösung vorliegt.',
      shortcutZoomReset:
        'Zurück zum ganzen Foto. Esc tut zunächst dasselbe, bevor es die Ansicht schließt.',
    },
    diagnostics: 'Diagnose',
    /** `{tab}` is the sidebar entry's name (`diagnosticsTab`), shown bold. */
    diagnosticsIntro:
      'Prüft, was unbemerkt schiefgeht — eine falsche Anzahl an Proxy-Hops, eine gelöschte Album-ID, ein Passwort im Klartext, ein Album, das Immich nicht als geteilt betrachtet. Du öffnest sie über {tab} in der Seitenleiste; das Status-Badge unter dem Menü zeigt weiterhin auf einen Blick, ob gerade etwas Aufmerksamkeit braucht.',
    diagnosticsTab: 'Diagnose',
  },

  backups: {
    title: 'Backup-Verlauf & Wiederherstellung',
    subtitle:
      'Stelle eine frühere Fassung deiner Seiten, Einstellungen, „Über mich“-Seite, deines Journals oder deiner Inhaltsseiten wieder her — auch gelöschte Journal-Einträge und Seiten.',
    /** One tab per kind of file; `files` names it in the empty state. */
    tabs: {
      gallery: 'Galerie',
      settings: 'Einstellungen',
      about: 'Über mich',
      privacy: 'Datenschutz',
      journal: 'Journal',
      pages: 'Inhaltsseiten',
    },
    files: {
      gallery: 'gallery.yaml',
      settings: 'settings.yaml',
      about: 'about.md',
      privacy: 'privacy.md',
      journal: 'Journal-Einträge',
      pages: 'Inhaltsseiten',
    },
    tabLabel: (label: string, n: number) => `${label} (${n})`,
    restoreFailed: 'Backup konnte nicht wiederhergestellt werden',
    restoreError: 'Fehler beim Wiederherstellen des Backups',
    restoredPage: (slug: string) => `Seite „${slug}“ wiederhergestellt.`,
    restoredEntry: (slug: string) => `Journal-Eintrag „${slug}“ wiederhergestellt.`,
    restored: (file: string) => `Backup erfolgreich wiederhergestellt! (${file})`,
    confirmTitle: 'Wiederherstellung bestätigen',
    /** `{file}` is the backup's file name, set in code. */
    confirmBody:
      'Möchtest du {file} wirklich wiederherstellen? Vorher wird automatisch ein Sicherheits-Snapshot des aktuellen Stands angelegt.',
    restoring: 'Wird wiederhergestellt...',
    restoreNow: 'Ja, jetzt wiederherstellen',
    loading: 'Backups werden geladen...',
    empty: (what: string) => `Noch keine Backups für ${what} vorhanden`,
    deleted: 'Gelöschter Eintrag',
    deletedTitle: 'Snapshot, angelegt beim Löschen des Eintrags',
    preRestore: 'Snapshot vor Wiederherstellung',
    preRestoreTitle: 'Sicherheits-Snapshot, angelegt vor einer Wiederherstellung',
    restore: 'Wiederherstellen',
    hideOlder: 'Ältere Backups ausblenden',
    showOlder: (n: number) => `${n} ${n === 1 ? 'älteres Backup' : 'ältere Backups'} anzeigen`,
  },
};
