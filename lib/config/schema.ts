export interface SubpageSectionConfig {
  title: string;
  slug: string; // auto-derived from title, used as anchor
  description?: string;
  albumIds: string[];
}

export interface SubpageConfig {
  name: string;
  slug: string;
  title?: string;
  subtitle?: string;
  albumIds: string[]; // flat list (all albums, incl. from sections)
  sections?: SubpageSectionConfig[];
  password?: string;
  grid?: Partial<GridConfig>;
}

export interface SubpageObjectValue {
  title?: string;
  subtitle?: string;
  password?: string;
  grid?: Partial<GridConfig>;
  albums?: Array<
    string | Record<string, string | { title: string; description?: string; password?: string }>
  >;
  sections?: Array<{
    title: string;
    description?: string;
    albums: Array<
      string | Record<string, string | { title: string; description?: string; password?: string }>
    >;
  }>;
}

export interface FooterConfig {
  name?: string;
  instagram?: string;
  email?: string;
  website?: string;
}

export interface LegalConfig {
  enabled: boolean;
  name: string;
  address: string;
  zipCity: string;
  country: string;
  email?: string;
  phone?: string;
  taxId?: string;
  vatId?: string;
  extraInfo?: string;
}

export interface ThemeConfig {
  preset: string;
  accent: string;
  fonts: { heading: string; body: string; caption: string };
  radius: number;
  photoFrame: 'none' | 'passepartout' | 'shadow';
  grain: boolean;
  headerDot: boolean;
  heroStyle: 'split' | 'fullbleed' | 'minimal' | 'stacked' | 'typographic' | 'mosaic';
}

export interface GridConfig {
  columns: number;
  gap: number;
  aspectRatio: string;
  layout: 'masonry' | 'uniform' | 'showcase' | 'filmstrip' | 'editorial-flow';
}

export interface AppConfig {
  immich: { apiUrl: string; apiKey: string };
  authSecret: string;
  albums: string[];
  standaloneAlbums: string[];
  subpages: SubpageConfig[];
  siteTitle: string;
  siteSubtitle: string;
  lang: string;
  seo: {
    title: string;
    description: string;
    noIndex: boolean;
    noFollow: boolean;
  };
  heroImages: string[];
  exifOnHover: boolean;
  grid: GridConfig;
  theme: ThemeConfig;
  footer: FooterConfig | null;
  legal: LegalConfig;
  map: boolean;
  transitions: boolean;
  albumOverrides: Record<string, string>;
  albumDescriptions: Record<string, string>;
  albumPasswords: Record<string, string>;
  albumHeroImages: Record<string, string>;
  cacheTtl: number;
  rateLimitRpm: number;
  trustedProxies: string[];
  needsSetup?: boolean;
}

export interface AlbumEntryObject {
  title: string;
  description?: string;
  password?: string;
  heroImage?: string;
}

export interface GalleryYaml {
  hero?: string | string[];
  albums?: Array<string | Record<string, string | AlbumEntryObject>>;
  subpages?:
    | Record<string, string[] | Array<string | Record<string, string>>>
    | Array<{
        name: string;
        title?: string;
        subtitle?: string;
        albums?: Array<string | Record<string, string | AlbumEntryObject>>;
        sections?: Array<{
          title: string;
          description?: string;
          albums: Array<string | Record<string, string | AlbumEntryObject>>;
        }>;
        password?: string;
        grid?: {
          columns?: number;
          gap?: number;
          aspectRatio?: string;
          layout?: string;
        };
      }>;
}

export interface SettingsYaml {
  title?: string;
  subtitle?: string;
  lang?: string;
  seo?: {
    title?: string;
    description?: string;
    noIndex?: boolean;
    noFollow?: boolean;
  };
  exifOnHover?: boolean;
  map?: boolean;
  transitions?: boolean;
  theme?:
    | string
    | {
        preset?: string;
        accent?: string;
        fonts?: { heading?: string; body?: string; caption?: string };
        radius?: number;
        photoFrame?: string;
        grain?: boolean;
        headerDot?: boolean;
        heroStyle?: string;
      };
  grid?: {
    columns?: number;
    gap?: number;
    aspectRatio?: string;
    layout?: string;
  };
  footer?: FooterConfig;
  legal?: Partial<LegalConfig>;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
