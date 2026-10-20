import type { AdminDictionary } from '../index';

// CLDR: French puts 0 in the singular, unlike English.
const isOne = (n: number) => n <= 1;

/**
 * Config doctor findings (`lib/admin/doctor.ts`, `app/api/admin/doctor/route.ts`),
 * one group per check. Built on the server and shown on /admin/diagnostics.
 *
 * Environment variable names, YAML keys, file paths and header names stay as
 * written in every language — they are what the operator has to type. Menu
 * paths in Immich's own (English) interface stay in English too.
 */
export const doctor: AdminDictionary['doctor'] = {
  authSecret: {
    missingTitle: 'AUTH_SECRET n’est pas défini',
    missingDetail:
      'Les jetons des médias et tous les cookies d’authentification sont signés avec un secret ' +
      'régénéré à chaque redémarrage : les liens et les connexions cessent de fonctionner dès que ' +
      'le serveur redémarre. Donnez à AUTH_SECRET une longue chaîne aléatoire.',
    shortTitle: (length: number) =>
      `AUTH_SECRET ne fait que ${length} ${isOne(length) ? 'caractère' : 'caractères'}`,
    shortDetail: (min: number) =>
      `Utilisez au moins ${min} caractères aléatoires — c’est la clé derrière chaque jeton de média et chaque cookie d’authentification.`,
    okTitle: 'AUTH_SECRET est défini',
    okDetail: (length: number) => `${length} ${isOne(length) ? 'caractère' : 'caractères'}.`,
  },

  proxyHops: {
    noProxyTitle: 'Aucun proxy inverse détecté',
    noProxyInconclusiveDetail:
      'La seule entrée X-Forwarded-For est celle que Next ajoute pour une requête directe, ce qui correspond à TRUSTED_PROXY_HOPS=0.',
    noProxyDetail:
      'Cette requête est arrivée sans X-Forwarded-For, ce qui correspond à TRUSTED_PROXY_HOPS=0.',
    notSeenTitle: (configured: number) =>
      `TRUSTED_PROXY_HOPS vaut ${configured}, mais cette requête ne montre aucun proxy`,
    notSeenDetail:
      'Soit vous accédez directement au panneau d’administration alors que le trafic public passe par un proxy — ' +
      'auquel cas tout va bien —, soit la valeur est trop élevée et tous les visiteurs partagent le même compteur de limitation de débit.',
    unsetTitle: (seen: number) =>
      `Une chaîne de ${seen} ${isOne(seen) ? 'proxy a été observée' : 'proxys a été observée'}, mais TRUSTED_PROXY_HOPS vaut 0`,
    unsetDetail: (seen: number) =>
      'L’IP du client est lue dans un en-tête que le client peut définir lui-même : la limitation de débit ' +
      `peut donc être contournée en le falsifiant. Réglez TRUSTED_PROXY_HOPS sur ${seen} (nginx, Traefik ou Caddy seul = 1).`,
    tooHighTitle: (configured: number, seen: number) =>
      `TRUSTED_PROXY_HOPS vaut ${configured}, mais seulement ${seen} ${
        isOne(seen) ? 'saut de proxy a été observé' : 'sauts de proxy ont été observés'
      }`,
    tooHighDetail: (seen: number) =>
      'La position lue se situe avant le début de la chaîne, si bien que l’IP du client se rabat sur ' +
      `une valeur peu fiable. Cette requête suggère ${seen}.`,
    tooLowTitle: (configured: number, seen: number) =>
      `TRUSTED_PROXY_HOPS vaut ${configured}, mais une chaîne de ${seen} ${
        isOne(seen) ? 'saut de proxy' : 'sauts de proxy'
      } a été observée`,
    tooLowDetail: (seen: number) =>
      'L’IP du client est lue à une position encore située dans la chaîne de proxys, et non chez le vrai client — ' +
      `tous les visiteurs derrière ce saut peuvent partager le même compteur de limitation de débit. Cette requête suggère ${seen}.`,
    okTitle: (configured: number) =>
      `TRUSTED_PROXY_HOPS=${configured} correspond à la chaîne observée`,
    okDetail: (seen: number) =>
      `X-Forwarded-For contenait ${seen} ${isOne(seen) ? 'entrée' : 'entrées'} dans cette requête.`,
  },

  cdn: {
    passwordTitle: 'CDN_URL est défini, mais les photos sont servies par ce serveur',
    passwordDetail:
      'Le site est protégé par un mot de passe, et un CDN remettrait les photos en cache à toute personne ' +
      'disposant d’un lien ; le mode CDN reste donc désactivé. Supprimez le mot de passe du site ou retirez CDN_URL.',
    noHopsTitle: 'Le mode CDN est actif, mais TRUSTED_PROXY_HOPS vaut 0',
    noHopsDetail: (cdnUrl: string) =>
      `Les photos sont servies via ${cdnUrl}, et sans TRUSTED_PROXY_HOPS le limiteur de débit ` +
      'compte le nœud du CDN au lieu du visiteur. Réglez-le sur le nombre de proxys placés devant ' +
      'l’application, CDN compris.',
    okTitle: 'Le mode CDN est actif',
    okDetail: (cdnUrl: string) => `Les photos et les vidéos sont servies via ${cdnUrl}.`,
  },

  albumIds: {
    noneTitle: 'Aucun album configuré',
    noneDetail: 'gallery.yaml ne liste aucun album, la galerie n’a donc rien à montrer.',
    missingTitle: (missing: number, total: number) =>
      isOne(missing)
        ? `${missing} identifiant d’album sur ${total} n’existe pas dans Immich`
        : `${missing} identifiants d’album sur ${total} n’existent pas dans Immich`,
    /** `ids` is a comma-separated list of album IDs. */
    missingDetail: (ids: string) =>
      `Ces pages sont vides, sans le moindre avertissement. Vérifiez dans gallery.yaml : ${ids}`,
    okTitle: (total: number) => `Tous les identifiants d’album (${total}) sont résolus`,
    okDetail: 'Chaque album de gallery.yaml existe dans Immich.',
  },

  albumsShared: {
    okTitle: 'Chaque album publié est partagé dans Immich',
    okDetail: 'Rien n’est publié qu’Immich considère encore comme privé.',
    warnTitle: (n: number) =>
      isOne(n)
        ? `${n} album publié n’est pas partagé dans Immich`
        : `${n} albums publiés ne sont pas partagés dans Immich`,
    /** `names` is a comma-separated list of album names. */
    warnDetail: (names: string) =>
      'Ils sont servis aux visiteurs malgré tout — c’est la liste d’autorisation de gallery.yaml qui décide. ' +
      `À vérifier si ce n’était pas voulu : ${names}`,
  },

  downloadMetadata: {
    okTitle: 'Les téléchargements partent sans GPS',
    okDetail: (albums: number) =>
      `Chaque original ${isOne(albums) ? 'de l’album de téléchargement' : `des ${albums} albums de téléchargement`} est en JPEG, HEIC ou AVIF, et il est servi sans sa localisation.`,
    warnTitle: (files: number) =>
      isOne(files)
        ? `${files} original téléchargeable conserve toutes ses métadonnées`
        : `${files} originaux téléchargeables conservent toutes leurs métadonnées`,
    /** `located`: how many of the files Immich has GPS for (0 = say nothing). `albums`: "Name (3), …". */
    warnDetail: (located: number, albums: string) =>
      'Les fichiers RAW, DNG, PNG, TIFF, WebP et vidéo sont servis tels qu’ils sont stockés, avec leurs éventuelles ' +
      `coordonnées GPS${located ? ` (Immich connaît la position de ${located} d’entre eux)` : ''}. ` +
      'Désactivez les téléchargements ou retirez ces fichiers si leur localisation doit rester privée : ' +
      albums,
  },

  zoomRenditions: {
    okTitle: 'Immich dispose d’aperçus en taille réelle pour le zoom',
    okDetail: (photos: number) =>
      isOne(photos)
        ? `${photos} photo HEIC, RAW ou similaire des albums avec zoom est zoomée via le rendu en taille réelle d’Immich, sans sa localisation.`
        : `${photos} photos HEIC, RAW ou similaires des albums avec zoom sont zoomées via le rendu en taille réelle d’Immich, sans leur localisation.`,
    missingTitle: (photos: number) =>
      isOne(photos)
        ? `${photos} photo ne peut pas être zoomée : Immich n’a pas d’aperçu en taille réelle`
        : `${photos} photos ne peuvent pas être zoomées : Immich n’a pas d’aperçu en taille réelle`,
    /** `albums`: "Name (3), …". The menu path is Immich's own English UI. */
    missingDetail: (albums: string) =>
      'Les formats HEIC, RAW et autres qu’un navigateur ne sait pas afficher sont zoomés via le rendu en taille ' +
      'réelle d’Immich, et Immich n’en a aucun (une photo testée). Les visiteurs voient le bouton de zoom, puis ' +
      '« non disponible ». Dans Immich, activez Administration › Settings › Image Settings › Full-size ' +
      'image (JPEG), puis lancez la tâche Generate Thumbnails pour les médias manquants. Albums : ' +
      albums,
    formatTitle: (photos: number) =>
      isOne(photos)
        ? `${photos} photo ne peut pas être zoomée : le format taille réelle d’Immich n’est pas JPEG`
        : `${photos} photos ne peuvent pas être zoomées : le format taille réelle d’Immich n’est pas JPEG`,
    /** `contentType` is empty when Immich did not name one. */
    formatDetail: (contentType: string, albums: string) =>
      `Immich génère ses aperçus en taille réelle au format ${contentType || 'inconnu'}, et ` +
      'le zoom ne sert que des rendus JPEG — leurs métadonnées de localisation sont retirées au passage, ce que ' +
      'Folio ne peut pas faire pour le WebP. Réglez Administration › Settings › Image Settings › Full-size image ' +
      '› Format sur JPEG, puis lancez la tâche Generate Thumbnails. Albums : ' +
      albums,
  },

  albumSlugs: {
    /** Where a set of albums shares one URL prefix — the top level of the site… */
    contextStandalone: 'albums de gallery.yaml',
    /** …or a subpage. */
    contextSubpage: (name: string) => `sous-page « ${name} »`,
    collision: (context: string, names: string[], slug: string) =>
      `${context} : « ${names.join(' » et « ')} » mènent tous à /${slug}`,
    errorTitle: (n: number) =>
      isOne(n)
        ? `${n} collision de slug d’album trouvée`
        : `${n} collisions de slug d’album trouvées`,
    /** `collisions` is the `collision` lines joined with "; ". */
    errorDetail: (collisions: string) =>
      'Dans une collision, chaque album après le premier est inaccessible à sa propre URL, et ses ' +
      `réglages proviennent de celui qui le précède. ${collisions}`,
    okTitle: 'Aucune collision de slug d’album',
    okDetail: 'Chaque album accessible sous un même préfixe d’URL a un slug distinct.',
  },

  passwords: {
    /** Where a password lives, listed in the findings below. */
    labelSite: 'Mot de passe du site',
    labelSubpage: (slug: string) => `Sous-page ${slug}`,
    labelAlbum: (slug: string) => `Album ${slug}`,
    labelJournal: (slug: string) => `Article du journal ${slug}`,
    bcryptTitle: (n: number) =>
      isOne(n)
        ? `${n} mot de passe utilise encore bcrypt`
        : `${n} mots de passe utilisent encore bcrypt`,
    bcryptDetail: (labels: string) =>
      'La prise en charge de bcrypt a été supprimée : personne ne peut plus les déverrouiller. Remplacez-les ' +
      'une fois par du texte en clair, connectez-vous, puis collez le hachage scrypt: affiché dans le journal ' +
      `du serveur : ${labels}`,
    plaintextTitle: (n: number) =>
      isOne(n)
        ? `${n} mot de passe est stocké en clair`
        : `${n} mots de passe sont stockés en clair`,
    plaintextDetail: (labels: string) =>
      'Quiconque lit le fichier lit le mot de passe. Enregistrer une fois la page, l’article ou le réglage ' +
      'dans le panneau d’administration le stocke haché ; pour un fichier modifié à la main, connectez-vous une ' +
      `fois et collez le hachage scrypt: affiché dans le journal du serveur : ${labels}`,
    noneTitle: 'Aucun mot de passe configuré',
    noneDetail: 'Rien sur ce site n’est protégé par un mot de passe.',
    okTitle: (n: number) => `Tous les mots de passe (${n}) sont hachés`,
    okDetail: 'Chaque mot de passe configuré utilise un hachage scrypt:.',
  },

  legal: {
    /** Impressum fields, listed after `missing`. */
    fieldName: 'nom',
    fieldAddress: 'adresse',
    fieldZipCity: 'code postal et ville',
    missing: (fields: string) => `Manquant : ${fields}.`,
    noEmail: 'Aucune adresse e-mail ; le § 5 DDG en exige une.',
    badContactUrl:
      'L’URL du formulaire de contact est ignorée, car elle ne commence pas par http(s)://.',
    emailOnly:
      'L’e-mail est le seul moyen de contact. Ajoutez un numéro de téléphone, une URL de formulaire de contact, ou activez le formulaire de contact intégré.',
    gapsTitle: (n: number) => `L’Impressum présente ${n} ${isOne(n) ? 'lacune' : 'lacunes'}`,
    okTitle: 'L’Impressum est complet',
    okDetail: 'Le nom, l’adresse, l’e-mail et un second moyen de contact sont renseignés.',
  },

  contact: {
    noNotifyTitle: 'Les messages du formulaire de contact ne préviennent personne',
    noNotifyDetail:
      'Les nouveaux messages n’apparaissent que sous Messages, dans le panneau d’administration. Indiquez une URL ntfy pour en être averti.',
    badUrlTitle: 'L’URL de notification du contact est ignorée',
    badUrlDetail: 'Elle ne commence pas par http(s)://, donc aucune notification n’est envoyée.',
    okTitle: 'Le formulaire de contact vous prévient',
    okDetail: 'Chaque nouveau message déclenche une notification.',
  },

  settingValues: {
    /** Names of the settings `validateSettingValues` checks. */
    labels: {
      url: 'URL du site',
      themeAccent: 'couleur d’accent',
      themeRadius: 'rayon des coins',
      gridColumns: 'colonnes de la grille',
      gridGap: 'espacement de la grille',
      retentionDays: 'conservation des messages',
      navLinks: 'liens de l’en-tête',
    },
    okTitle: 'Les réglages sont appliqués tels qu’ils sont écrits',
    okDetail:
      'L’URL du site, le thème, la grille, la conservation des messages et les liens de l’en-tête dans settings.yaml sont tous valides.',
    oneIgnoredTitle: (name: string) => `Le réglage « ${name} » est ignoré`,
    manyIgnoredTitle: (n: number) =>
      isOne(n) ? `${n} réglage est ignoré` : `${n} réglages sont ignorés`,
    ignoredDetail: (names: string) =>
      `settings.yaml contient une valeur que le site ne peut pas utiliser pour : ${names}. ` +
      'Le site utilise à la place une valeur par défaut ou la valeur autorisée la plus proche. Ouvrez le réglage pour voir ce qu’il attend.',
  },

  privacy: {
    okTitle: 'La politique de confidentialité est publiée',
    okDetail: 'Affichée sur /privacy et liée dans le pied de page.',
    missingTitle: 'Il n’y a pas de politique de confidentialité',
    switchedOffDetail:
      'Le texte existe, mais la page de confidentialité est désactivée, donc /privacy répond 404.',
    noTextDetail:
      'L’Impressum est activé, mais /privacy n’a pas de texte. Paramètres → Mentions légales liste ce que traite ce site, comme point de départ.',
  },

  writable: {
    errorTitle: (n: number) =>
      isOne(n)
        ? `${n} chemin de contenu n’est pas accessible en écriture`
        : `${n} chemins de contenu ne sont pas accessibles en écriture`,
    errorDetail: (paths: string) =>
      'Les enregistrements depuis le panneau d’administration échoueront, tout comme les sauvegardes. ' +
      `Vérifiez le propriétaire du volume monté : ${paths}`,
    okTitle: 'content/ est accessible en écriture',
    okDetail: 'La configuration, le journal et les sauvegardes peuvent être enregistrés.',
  },

  immichApi: {
    notConfiguredTitle: 'Aucune URL Immich ni clé API configurée',
    notConfiguredDetail:
      'Définissez IMMICH_API_URL et IMMICH_API_KEY, ou lancez l’assistant d’installation sur /install.',
    failedTitle: (failed: number, total: number) =>
      isOne(failed)
        ? `${failed} appel Immich sur ${total} a échoué`
        : `${failed} appels Immich sur ${total} ont échoué`,
    failedDetail: (endpoints: string) =>
      `Vérifiez IMMICH_API_URL et la clé API. En échec : ${endpoints}`,
    okTitle: 'Immich répond à chaque appel de Folio',
  },

  contentPages: {
    takenTitle: (n: number) =>
      isOne(n)
        ? `${n} page de contenu a un slug déjà pris`
        : `${n} pages de contenu ont un slug déjà pris`,
    /** `reasons`: one sentence per page, in English (from lib/pages). `missing`: '' or a list. */
    takenDetail: (reasons: string, missing: string) =>
      reasons +
      ' Renommez la page dans Pages pour que les visiteurs puissent y accéder.' +
      (missing ? ` Le menu liste aussi des pages manquantes : ${missing}.` : ''),
    missingTitle: (n: number) =>
      `Le menu liste ${n} ${isOne(n) ? 'page manquante' : 'pages manquantes'}`,
    missingDetail: (list: string) =>
      `gallery.yaml fait référence à ${list}, mais content/pages/ ne contient pas ce fichier. ` +
      'Le menu ignore l’entrée ; supprimez la référence ou créez la page.',
    okTitle: (n: number) =>
      isOne(n)
        ? `${n} page de contenu, slug libre`
        : `${n} pages de contenu, tous les slugs sont libres`,
    okDetail: (inMenu: number) => `Dont ${inMenu} dans le menu.`,
  },
};
