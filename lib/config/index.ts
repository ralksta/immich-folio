import { env } from '../env';
import { loadYaml, validateUuid } from './parser';
import { resolveTheme, VALID_LAYOUTS } from './theme';
import {
  slugify,
  AppConfig,
  SubpageConfig,
  SubpageSectionConfig,
  GalleryYaml,
  SettingsYaml,
  GridConfig,
} from './schema';

export * from './schema';
export * from './theme';

let _config: AppConfig | null = null;
export function getConfig(): AppConfig {
  const isDev = process.env.NODE_ENV !== 'production';
  if (_config && !isDev) return _config;

  const apiUrl = env.IMMICH_API_URL;
  const apiKey = env.IMMICH_API_KEY;
  const authSecret = env.AUTH_SECRET || apiKey;

  if (!env.AUTH_SECRET && process.env.NODE_ENV === 'production') {
    console.warn(
      '\n⚠️  SECURITY WARNING: AUTH_SECRET is not set. Falling back to IMMICH_API_KEY.\n   Please set a long random string as AUTH_SECRET in your .env for better security.\n',
    );
  }

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
      cacheTtl: env.CACHE_TTL * 1000,
      rateLimitRpm: env.RATE_LIMIT_RPM,
      needsSetup: true,
    };
    return _config;
  }

  const theme = resolveTheme(settings.theme);

  const albumOverrides: Record<string, string> = {};

  function processAlbumEntry(entry: string | Record<string, string>, context: string): string {
    if (typeof entry === 'string') {
      return validateUuid(entry, context);
    }
    const [uuid, name] = Object.entries(entry)[0];
    const validatedUuid = validateUuid(uuid, context);
    albumOverrides[validatedUuid] = name;
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
        ...(sp.grid
          ? {
              grid: {
                ...(sp.grid.columns != null ? { columns: sp.grid.columns } : {}),
                ...(sp.grid.gap != null ? { gap: sp.grid.gap } : {}),
                ...(sp.grid.aspectRatio != null ? { aspectRatio: sp.grid.aspectRatio } : {}),
                ...(sp.grid.layout != null
                  ? {
                      layout: (VALID_LAYOUTS.includes(sp.grid.layout)
                        ? sp.grid.layout
                        : 'masonry') as GridConfig['layout'],
                    }
                  : {}),
              },
            }
          : {}),
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
      interface SubpageObjectValue {
        title?: string;
        subtitle?: string;
        albums?: Array<string | Record<string, string>>;
        password?: string;
        grid?: { columns?: number; gap?: number; aspectRatio?: string; layout?: string };
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
        ...(sp.grid
          ? {
              grid: {
                ...(sp.grid.columns != null ? { columns: sp.grid.columns } : {}),
                ...(sp.grid.gap != null ? { gap: sp.grid.gap } : {}),
                ...(sp.grid.aspectRatio != null ? { aspectRatio: sp.grid.aspectRatio } : {}),
                ...(sp.grid.layout != null
                  ? {
                      layout: (VALID_LAYOUTS.includes(sp.grid.layout)
                        ? sp.grid.layout
                        : 'masonry') as GridConfig['layout'],
                    }
                  : {}),
              },
            }
          : {}),
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
    cacheTtl: env.CACHE_TTL * 1000,
    rateLimitRpm: env.RATE_LIMIT_RPM,
    needsSetup: false,
  };
  return _config;
}
