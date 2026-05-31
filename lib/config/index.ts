import crypto from 'crypto';
import { env } from '../env';
import { loadYaml, clearYamlCache, validateUuid } from './parser';
import { resolveTheme, VALID_LAYOUTS } from './theme';
import {
  slugify,
  AppConfig,
  SubpageConfig,
  SubpageSectionConfig,
  SubpageObjectValue,
  GalleryYaml,
  SettingsYaml,
  GridConfig,
} from './schema';

export * from './schema';
export * from './theme';

let _config: AppConfig | null = null;
let _fallbackSecret: string | null = null;

/** Invalidate the cached config so the next getConfig() call re-reads YAML files. */
export function invalidateConfigCache(): void {
  _config = null;
  clearYamlCache();
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

export function getConfig(): AppConfig {
  // _config is a per-worker in-memory cache.
  // invalidateConfigCache() clears it + the underlying YAML mtime cache,
  // so after an admin save every worker re-parses on next request.
  // In dev we always re-parse so hot-reload works.
  if (_config && process.env.NODE_ENV === 'production') return _config;

  const apiUrl = env.IMMICH_API_URL;
  const apiKey = env.IMMICH_API_KEY;
  let { AUTH_SECRET } = env;
  if (!AUTH_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SECURITY ERROR: AUTH_SECRET is not set in production. Please set a long random string as AUTH_SECRET in your .env.',
      );
    }
    if (!_fallbackSecret) {
      _fallbackSecret = crypto.randomBytes(32).toString('hex');
    }
    console.warn(
      '\n⚠️  SECURITY WARNING: AUTH_SECRET is not set. Generating a temporary random secret for this session.\n   Please set a long random string as AUTH_SECRET in your .env for better security.\n',
    );
    AUTH_SECRET = _fallbackSecret;
  }
  const authSecret = AUTH_SECRET;

  const gallery = loadYaml<GalleryYaml>('gallery.yaml');
  const settings = loadYaml<SettingsYaml>('settings.yaml') || {};

  if (!gallery || !apiKey || !apiUrl) {
    // Return dummy config if gallery.yaml is missing
    _config = {
      immich: { apiUrl: `${apiUrl}/api`, apiKey },
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
      albumOverrides: {},
      albumDescriptions: {},
      albumPasswords: {},
      albumHeroImages: {},
      cacheTtl: env.CACHE_TTL * 1000,
      rateLimitRpm: env.RATE_LIMIT_RPM,
      trustedProxies: env.TRUSTED_PROXIES,
      needsSetup: true,
    };
    return _config;
  }

  const theme = resolveTheme(settings.theme);

  const albumOverrides: Record<string, string> = {};
  const albumDescriptions: Record<string, string> = {};
  const albumPasswords: Record<string, string> = {};
  const albumHeroImages: Record<string, string> = {};

  function processAlbumEntry(
    entry:
      | string
      | Record<string, string | { title: string; description?: string; password?: string; heroImage?: string }>,
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
      if (value.heroImage) albumHeroImages[validatedUuid] = value.heroImage;
    }
    return validatedUuid;
  }

  const standaloneAlbumIds = (gallery.albums ?? []).map((entry) =>
    processAlbumEntry(entry, 'gallery.yaml albums'),
  );
  if (
    standaloneAlbumIds.length === 0 &&
    (!gallery.subpages ||
      (Array.isArray(gallery.subpages)
        ? gallery.subpages.length === 0
        : Object.keys(gallery.subpages).length === 0))
  ) {
    throw new Error('gallery.yaml must define at least one album or subpage');
  }

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
        ...buildSubpageGrid(sp.grid),
      };
    });
  }

  const subpageAlbumIds = new Set(subpages.flatMap((sp) => sp.albumIds));
  const allAlbumIds = [...new Set([...standaloneAlbumIds, ...subpageAlbumIds])];

  _config = {
    immich: { apiUrl: `${apiUrl}/api`, apiKey },
    authSecret,
    albums: allAlbumIds,
    standaloneAlbums: standaloneAlbumIds.filter((id) => !subpageAlbumIds.has(id)),
    subpages,
    siteTitle: settings.title ?? env.SITE_TITLE,
    siteSubtitle: settings.subtitle ?? env.SITE_SUBTITLE,
    lang: settings.lang ?? 'en',
    seo: {
      title: settings.seo?.title || settings.title || env.SITE_TITLE || 'Gallery',
      description:
        settings.seo?.description ||
        settings.subtitle ||
        env.SITE_SUBTITLE ||
        'A curated photography portfolio',
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
    albumOverrides,
    albumDescriptions,
    albumPasswords,
    albumHeroImages,
    cacheTtl: env.CACHE_TTL * 1000,
    rateLimitRpm: env.RATE_LIMIT_RPM,
    trustedProxies: env.TRUSTED_PROXIES,
    needsSetup: false,
  };
  return _config;
}
