import { env } from '../env';
import { resolveAuthSecret } from '../secret';
import { getInstallCredentials } from '../install';
import { loadYaml, clearYamlCache, validateUuid } from './parser';
import { resolveTheme, VALID_LAYOUTS } from './theme';
import { ALBUM_SORT_MODES, isAlbumSortMode, type AlbumSortMode } from '../albumSort';
import {
  slugify,
  AppConfig,
  AlbumEntryObject,
  SubpageConfig,
  SubpageSectionConfig,
  SubpageObjectValue,
  GalleryYaml,
  SettingsYaml,
  GridConfig,
} from './schema';

export * from './schema';
export * from './theme';

/** Invalidate the cached YAML so the next getConfig() call re-parses the files. */
export function invalidateConfigCache(): void {
  clearYamlCache();
}

/**
 * getConfig(), but returns null instead of throwing on a gallery.yaml that
 * cannot be derived.
 *
 * getConfig() throws for three shapes the admin page builder is able to write:
 * a gallery with neither albums nor subpages, a subpage with no name, and a
 * subpage with neither albums nor sections. A throw inside a *layout* is not
 * caught by app/error.tsx — that needs a global-error boundary — so the site
 * and /admin would go down together, locking the user out of the only tool that
 * can undo the save. That is issue #326's failure mode reached through an
 * invalid config rather than a missing one.
 *
 * Callers should treat null exactly like `needsSetup`: show the setup screen,
 * and keep /admin reachable.
 */
export function getConfigOrNull(): AppConfig | null {
  try {
    return getConfig();
  } catch (error) {
    console.error(
      '[Folio] content/gallery.yaml could not be loaded — serving the setup screen. ' +
        'Fix the file or restore a backup from content/.backups/:',
      error,
    );
    return null;
  }
}

/** Converts raw YAML grid overrides into a typed partial GridConfig. */
export function buildSubpageGrid(raw?: {
  columns?: number;
  gap?: number;
  aspectRatio?: string;
  layout?: string;
}): { grid: Partial<GridConfig> } | Record<string, never> {
  if (!raw) return {};
  return {
    grid: {
      ...(raw.columns != null ? { columns: raw.columns } : {}),
      ...(raw.gap != null ? { gap: raw.gap } : {}),
      ...(raw.aspectRatio != null ? { aspectRatio: raw.aspectRatio } : {}),
      ...(raw.layout != null
        ? {
            layout: (VALID_LAYOUTS.includes(raw.layout)
              ? raw.layout
              : 'masonry') as GridConfig['layout'],
          }
        : {}),
    },
  };
}

/** The parts of AppConfig that come from gallery.yaml. */
export interface GalleryDerivation {
  albums: string[];
  standaloneAlbums: string[];
  subpages: SubpageConfig[];
  albumOverrides: Record<string, string>;
  albumDescriptions: Record<string, string>;
  albumPasswords: Record<string, string>;
  albumHeroImages: Record<string, string>;
  albumSortModes: Record<string, AlbumSortMode>;
  albumManualOrders: Record<string, string[]>;
  albumGrids: Record<string, Partial<GridConfig>>;
}

/**
 * Derive the gallery half of AppConfig, throwing on a structure that cannot be
 * represented: a subpage with no name, a subpage with neither albums nor
 * sections. A gallery with no albums and no subpages is NOT an error — an
 * empty gallery still renders (title, hero-less homepage) so the owner can
 * add albums later via /admin.
 *
 * Extracted from getConfig() so the admin PUT can run the *real* derivation
 * against a proposed gallery before writing it. Re-implementing the three
 * checks in the route would guarantee drift; write-then-verify-then-roll-back
 * would leave a window where other requests read the broken config.
 */
export function deriveGallery(gallery: GalleryYaml): GalleryDerivation {
  const albumOverrides: Record<string, string> = {};
  const albumDescriptions: Record<string, string> = {};
  const albumPasswords: Record<string, string> = {};
  const albumHeroImages: Record<string, string> = {};
  const albumSortModes: Record<string, AlbumSortMode> = {};
  const albumManualOrders: Record<string, string[]> = {};
  const albumGrids: Record<string, Partial<GridConfig>> = {};

  function processAlbumEntry(
    entry: string | Record<string, string | AlbumEntryObject>,
    context: string,
  ): string {
    if (typeof entry === 'string') {
      return validateUuid(entry, context);
    }
    const [uuid, value] = Object.entries(entry)[0];
    const validatedUuid = validateUuid(uuid, context);

    if (typeof value === 'string') {
      albumOverrides[validatedUuid] = value;
    } else {
      if (value.title) albumOverrides[validatedUuid] = value.title;
      if (value.description) albumDescriptions[validatedUuid] = value.description;
      if (value.password) albumPasswords[validatedUuid] = value.password;
      // The album ID (the key) is validated above; the hero asset ID is a
      // separate UUID and was previously stored raw. It flows to encodeAssetId
      // via app/[...path]/page.tsx, which encrypts whatever it is handed — so a
      // typo here produced a well-formed URL that 404s forever, with nothing in
      // the log naming the cause. Every other ID in this file goes through
      // validateUuid; this one was the gap.
      if (value.heroImage) {
        albumHeroImages[validatedUuid] = validateUuid(
          value.heroImage,
          `${context} heroImage for album ${validatedUuid}`,
        );
      }

      // Throw rather than fall back to the default: a typo would otherwise be
      // invisible — the album would just keep rendering in Immich order and the
      // owner would be left wondering why the setting does nothing. Throwing
      // also gives the admin PUT its 400 for free via the deriveGallery
      // dry-run, and getConfigOrNull() degrades a hand-edited file to the setup
      // screen rather than taking the site down. Name the album and the legal
      // values so the log line is enough to fix it.
      if (value.sort != null) {
        if (!isAlbumSortMode(value.sort)) {
          throw new Error(
            `${context}: album ${validatedUuid} has an unknown sort "${value.sort}". ` +
              `Valid values are: ${ALBUM_SORT_MODES.join(', ')}.`,
          );
        }
        albumSortModes[validatedUuid] = value.sort;
      }

      // Kept regardless of the mode, so switching manual → newest → manual does
      // not silently destroy a hand-curated order.
      if (value.assetOrder?.length) {
        albumManualOrders[validatedUuid] = value.assetOrder.map((assetId, i) =>
          validateUuid(assetId, `${context} assetOrder[${i}] for album ${validatedUuid}`),
        );
      }

      // EXPERIMENTAL: per-album grid override — reuses the subpage-grid
      // normalisation so unknown layouts degrade identically.
      if (value.grid) {
        const built = buildSubpageGrid(value.grid);
        if ('grid' in built) albumGrids[validatedUuid] = built.grid;
      }
    }
    return validatedUuid;
  }

  const standaloneAlbumIds = (gallery.albums ?? []).map((entry) =>
    processAlbumEntry(entry, 'gallery.yaml albums'),
  );

  let subpages: SubpageConfig[] = [];

  if (Array.isArray(gallery.subpages)) {
    subpages = gallery.subpages.map((sp) => {
      if (!sp.name) {
        throw new Error(`Subpage "(unnamed)" must have a name`);
      }

      // Parse sections if present
      let sections: SubpageSectionConfig[] | undefined;
      let albumIds: string[];

      if (sp.sections && sp.sections.length > 0) {
        sections = sp.sections.map((sec) => ({
          title: sec.title,
          slug: slugify(sec.title),
          description: sec.description,
          albumIds: sec.albums.map((entry) =>
            processAlbumEntry(entry, `subpage "${sp.name}" section "${sec.title}"`),
          ),
        }));
        // flat union of all section albums
        albumIds = sections.flatMap((s) => s.albumIds);
        // Also include any top-level albums (outside sections)
        const topLevel = (sp.albums ?? []).map((entry) =>
          processAlbumEntry(entry, `subpage "${sp.name}"`),
        );
        albumIds = [...topLevel, ...albumIds];
      } else {
        const albums = sp.albums ?? [];
        if (albums.length === 0) {
          throw new Error(`Subpage "${sp.name}" must have albums or sections`);
        }
        albumIds = albums.map((entry) => processAlbumEntry(entry, `subpage "${sp.name}"`));
      }

      return {
        name: sp.name,
        slug: slugify(sp.name),
        title: sp.title,
        subtitle: sp.subtitle,
        albumIds,
        sections,
        password: sp.password,
        proofing: sp.proofing,
        essayFile: sp.essayFile,
        essayText: sp.essayText,
        enabled: sp.enabled !== false,
        hidden: sp.hidden === true,
        ...buildSubpageGrid(sp.grid),
      };
    });
  } else if (gallery.subpages) {
    subpages = Object.entries(gallery.subpages).map(([name, value]) => {
      if (Array.isArray(value)) {
        return {
          name,
          slug: slugify(name),
          albumIds: value.map((entry) => processAlbumEntry(entry, `subpage "${name}"`)),
          enabled: true,
        };
      }
      const sp = value as SubpageObjectValue;
      const albumEntries = sp.albums || [];
      return {
        name,
        slug: slugify(name),
        title: sp.title,
        subtitle: sp.subtitle,
        albumIds: albumEntries.map((entry) => processAlbumEntry(entry, `subpage "${name}"`)),
        password: sp.password,
        proofing: sp.proofing,
        essayFile: sp.essayFile,
        essayText: sp.essayText,
        enabled: sp.enabled !== false,
        hidden: sp.hidden === true,
        ...buildSubpageGrid(sp.grid),
      };
    });
  }

  const subpageAlbumIds = new Set(subpages.flatMap((sp) => sp.albumIds));
  const allAlbumIds = [...new Set([...standaloneAlbumIds, ...subpageAlbumIds])];

  return {
    albums: allAlbumIds,
    standaloneAlbums: standaloneAlbumIds.filter((id) => !subpageAlbumIds.has(id)),
    subpages,
    albumOverrides,
    albumDescriptions,
    albumPasswords,
    albumHeroImages,
    albumSortModes,
    albumManualOrders,
    albumGrids,
  };
}

export function getConfig(): AppConfig {
  // No in-memory config cache: admin saves can land in a different
  // worker/process than page rendering, so a per-worker cache goes stale
  // until restart. Freshness comes from the mtime-checked YAML cache in
  // loadYaml() — a statSync per file, negligible next to Immich API calls.
  const { apiUrl, apiKey } = getInstallCredentials();
  const authSecret = resolveAuthSecret();

  // The API URL may already end with /api (a user-supplied env var or a
  // wizard-installed value). Appending unconditionally produces a double
  // suffix and breaks every Immich request.
  const immichApiUrl = apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;

  const gallery = loadYaml<GalleryYaml>('gallery.yaml');
  const settings = loadYaml<SettingsYaml>('settings.yaml') || {};

  if (!gallery || !apiKey || !apiUrl) {
    // Return dummy config if gallery.yaml is missing
    return {
      immich: { apiUrl: immichApiUrl, apiKey },
      authSecret,
      albums: [],
      standaloneAlbums: [],
      subpages: [],
      siteTitle: env.SITE_TITLE || 'Immich Folio',
      siteSubtitle: env.SITE_SUBTITLE || 'Setup Required',
      lang: 'en',
      seo: {
        title: 'Setup Required',
        description: 'Please configure Immich Folio',
        titleTemplate: '%s | Setup Required',
        noIndex: true,
        noFollow: true,
      },
      heroImages: [],
      exifOnHover: true,
      grid: { columns: 3, gap: 12, aspectRatio: '1', layout: 'masonry' },
      theme: resolveTheme('studio'),
      footer: null,
      legal: { enabled: false, name: '', address: '', zipCity: '', country: '' },
      map: false,
      transitions: false,
      analytics: true,
      proofing: { enabled: false, allowMailto: false },
      albumOverrides: {},
      albumDescriptions: {},
      albumPasswords: {},
      albumHeroImages: {},
      albumSortModes: {},
      albumManualOrders: {},
      albumGrids: {},
      cacheTtl: env.CACHE_TTL * 1000,
      staleMaxAge: env.STALE_MAX_AGE * 1000,
      immichTimeoutMs: env.IMMICH_TIMEOUT_MS,
      rateLimitRpm: env.RATE_LIMIT_RPM,
      trustedProxyHops: env.TRUSTED_PROXY_HOPS,
      needsSetup: true,
    };
  }

  const theme = resolveTheme(settings.theme);

  const {
    albums: allAlbumIds,
    standaloneAlbums,
    subpages,
    albumOverrides,
    albumDescriptions,
    albumPasswords,
    albumHeroImages,
    albumSortModes,
    albumManualOrders,
    albumGrids,
  } = deriveGallery(gallery);

  const siteSeoTitle = settings.seo?.title || settings.title || env.SITE_TITLE || 'Gallery';

  return {
    immich: { apiUrl: immichApiUrl, apiKey },
    authSecret,
    albums: allAlbumIds,
    standaloneAlbums,
    subpages,
    siteTitle: settings.title ?? env.SITE_TITLE,
    siteSubtitle: settings.subtitle ?? env.SITE_SUBTITLE,
    lang: settings.lang ?? 'en',
    seo: {
      title: siteSeoTitle,
      description:
        settings.seo?.description ||
        settings.subtitle ||
        env.SITE_SUBTITLE ||
        'A curated photography portfolio',
      titleTemplate: settings.seo?.titleTemplate || `%s | ${siteSeoTitle}`,
      noIndex: settings.seo?.noIndex === true,
      noFollow: settings.seo?.noFollow === true,
    },
    heroImages: gallery.hero
      ? (Array.isArray(gallery.hero) ? gallery.hero : [gallery.hero]).map((id) =>
          validateUuid(id, 'gallery.yaml hero'),
        )
      : [],
    exifOnHover: settings.exifOnHover !== false,
    grid: {
      columns: settings.grid?.columns ?? 3,
      gap: settings.grid?.gap ?? 12,
      aspectRatio: settings.grid?.aspectRatio ?? '1',
      layout: (VALID_LAYOUTS.includes(settings.grid?.layout ?? '')
        ? settings.grid!.layout
        : 'masonry') as GridConfig['layout'],
    },
    theme,
    footer: settings.footer
      ? {
          name: settings.footer.name,
          instagram: settings.footer.instagram,
          email: settings.footer.email,
          website: settings.footer.website,
        }
      : null,
    legal: {
      enabled: settings.legal?.enabled === true,
      name: settings.legal?.name || '',
      address: settings.legal?.address || '',
      zipCity: settings.legal?.zipCity || '',
      country: settings.legal?.country || '',
      email: settings.legal?.email,
      phone: settings.legal?.phone,
      taxId: settings.legal?.taxId,
      vatId: settings.legal?.vatId,
      extraInfo: settings.legal?.extraInfo,
    },
    map: settings.map === true,
    transitions: settings.transitions !== false,
    analytics: settings.analytics !== false,
    proofing: {
      enabled: settings.proofing?.enabled !== false,
      allowMailto: settings.proofing?.allowMailto !== false,
    },
    protection: settings.protection,
    watermark: settings.watermark,
    albumOverrides,
    albumDescriptions,
    albumPasswords,
    albumHeroImages,
    albumSortModes,
    albumManualOrders,
    albumGrids,
    cacheTtl: env.CACHE_TTL * 1000,
    staleMaxAge: env.STALE_MAX_AGE * 1000,
    immichTimeoutMs: env.IMMICH_TIMEOUT_MS,
    rateLimitRpm: env.RATE_LIMIT_RPM,
    trustedProxyHops: env.TRUSTED_PROXY_HOPS,
    needsSetup: false,
  };
}
