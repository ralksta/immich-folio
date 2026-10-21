import type { AdminDictionary } from '../index';

// CLDR: French puts 0 in the singular, unlike English.
const isOne = (n: number) => n <= 1;

/** The help page and the backup dialog. */
export const system: AdminDictionary['system'] = {
  help: {
    kicker: 'Système',
    title: 'Aide',
    description: 'Ce que votre portfolio sait faire sans bouton dédié.',
    viewer: 'Visionneuse d’images',
    /** `{question}` and `{h}` are the two keys, drawn as keycaps. */
    viewerIntro:
      'Les touches qu’un visiteur peut utiliser dans la visionneuse. Il n’y a volontairement pas de barre d’outils pour elles — une commande affichée en permanence sur une photographie coûte quelque chose à chaque visiteur — mais les visiteurs peuvent afficher la même liste avec {question} ou {h}.',
    /**
     * When a conditional key is absent, keyed by the shortcut's label key in
     * `lib/lightboxShortcuts.ts`. The shortcut names themselves come from the
     * visitor dictionary of the panel's language.
     */
    notes: {
      shortcutInfo:
        'Masqué lorsque tous les groupes EXIF sont désactivés, ainsi que dans les articles du journal.',
      shortcutFullscreen:
        'Absent des navigateurs sans plein écran d’élément, comme Safari sur iPhone.',
      shortcutSlideshow:
        'Passe de désactivé à 3 s, 5 s, 10 s, puis revient à désactivé. Une flèche ou un balayage l’arrête.',
      shortcutCopyLink:
        'Copie un lien vers la photo affichée. Le lien dépend de la position : réorganiser l’album change la photo sur laquelle il ouvre.',
      shortcutDownload: 'Uniquement pour les albums avec download: true dans gallery.yaml.',
      shortcutZoom:
        'Uniquement là où le zoom est activé (paramètres, page ou album) et si la photo a une source en pleine résolution.',
      shortcutZoomReset:
        'Revient à la photo entière. Esc fait de même avant de fermer la visionneuse.',
    },
    diagnostics: 'Diagnostics',
    /** `{tab}` is the sidebar entry's name (`diagnosticsTab`), shown bold. */
    diagnosticsIntro:
      'Vérifie ce qui échoue sans bruit — un mauvais nombre de proxys, un ID d’album supprimé, un mot de passe en clair, un album qu’Immich ne considère pas comme partagé. Ouvrez-le depuis {tab} dans la barre latérale ; le badge d’état sous le menu indique toujours d’un coup d’œil si quelque chose demande votre attention.',
    diagnosticsTab: 'Diagnostics',
  },

  backups: {
    title: 'Historique & restauration des sauvegardes',
    subtitle:
      'Restaurez une version antérieure de vos pages, de vos paramètres, de la page À propos, du journal ou des pages de contenu — y compris des articles du journal et des pages supprimés.',
    /** One tab per kind of file; `files` names it in the empty state, after "pour". */
    tabs: {
      gallery: 'Galerie',
      settings: 'Paramètres',
      about: 'À propos',
      privacy: 'Confidentialité',
      journal: 'Journal',
      pages: 'Pages de contenu',
    },
    files: {
      gallery: 'gallery.yaml',
      settings: 'settings.yaml',
      about: 'about.md',
      privacy: 'privacy.md',
      journal: 'les articles du journal',
      pages: 'les pages de contenu',
    },
    tabLabel: (label: string, n: number) => `${label} (${n})`,
    restoreFailed: 'Échec de la restauration de la sauvegarde',
    restoreError: 'Erreur lors de la restauration de la sauvegarde',
    restoredPage: (slug: string) => `Page « ${slug} » restaurée.`,
    restoredEntry: (slug: string) => `Article du journal « ${slug} » restauré.`,
    restored: (file: string) => `Sauvegarde restaurée avec succès ! (${file})`,
    confirmTitle: 'Confirmer la restauration',
    /** `{file}` is the backup's file name, set in code. */
    confirmBody:
      'Voulez-vous vraiment restaurer {file} ? Un instantané de sécurité de l’état actuel sera créé automatiquement avant le retour en arrière.',
    restoring: 'Restauration…',
    restoreNow: 'Oui, restaurer maintenant',
    loading: 'Chargement des sauvegardes…',
    empty: (what: string) => `Pas encore de sauvegarde pour ${what}`,
    /** Badge on a deleted page or journal entry. */
    deleted: 'Supprimé',
    deletedTitle: 'Instantané pris lors de la suppression',
    preRestore: 'Avant restauration',
    preRestoreTitle: 'Instantané de sécurité pris avant une restauration',
    restore: 'Restaurer',
    hideOlder: 'Masquer les sauvegardes plus anciennes',
    showOlder: (n: number) =>
      `Afficher ${n} ${isOne(n) ? 'sauvegarde plus ancienne' : 'sauvegardes plus anciennes'}`,
  },
};
