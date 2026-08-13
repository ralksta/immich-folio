import type { AlbumSortMode } from '../albumSort';

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
  proofing?: boolean;
  essayFile?: string;
  essayText?: string;
  enabled?: boolean;
  /** EXPERIMENTAL: reachable by direct link, but not shown in navigation */
  hidden?: boolean;
}

export interface SubpageObjectValue {
  title?: string;
  subtitle?: string;
  password?: string;
  grid?: Partial<GridConfig>;
  proofing?: boolean;
  essayFile?: string;
  essayText?: string;
  enabled?: boolean;
  /** EXPERIMENTAL: reachable by direct link, but not shown in navigation */
  hidden?: boolean;
  // Both album lists reuse AlbumEntryObject rather than inlining the shape:
  // the inline copies had already drifted (they never gained `heroImage`), and
  // this path is live for map-style subpages.
  albums?: Array<string | Record<string, string | AlbumEntryObject>>;
  sections?: Array<{
    title: string;
    description?: string;
    albums: Array<string | Record<string, string | AlbumEntryObject>>;
  }>;
}

/** EXPERIMENTAL: external link shown in the header navigation. */
export interface NavLinkConfig {
  label: string;
  url: string;
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
  heroStyle: 'split' | 'fullbleed' | 'minimal' | 'stacked' | 'typographic' | 'mosaic' | 'cover';
}

export interface GridConfig {
  columns: number;
  gap: number;
  aspectRatio: string;
  layout:
    | 'masonry'
    | 'uniform'
    | 'showcase'
    | 'filmstrip'
    | 'editorial-flow'
    | 'essay'
    | 'justified';
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
    titleTemplate: string;
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
  analytics: boolean;
  proofing: {
    enabled: boolean;
    allowMailto: boolean;
  };
  albumOverrides: Record<string, string>;
  albumDescriptions: Record<string, string>;
  albumPasswords: Record<string, string>;
  albumHeroImages: Record<string, string>;
  /** Per-album sort mode. Absent means `immich` — the album's own order. */
  albumSortModes: Record<string, AlbumSortMode>;
  /** Pinned asset UUIDs per album for `sort: manual`, in display order. */
  albumManualOrders: Record<string, string[]>;
  /** EXPERIMENTAL: per-album grid overrides, merged over the subpage/global grid. */
  albumGrids: Record<string, Partial<GridConfig>>;
  /** EXPERIMENTAL: per-album focal point for cover crops (CSS object-position). */
  albumCoverPositions: Record<string, string>;
  /** EXPERIMENTAL: external links appended to the header navigation. */
  navLinks: NavLinkConfig[];
  cacheTtl: number;
  /** How long (ms) an expired cache entry may still be served while Immich is unreachable. */
  staleMaxAge: number;
  /** Response-wait budget for Immich API calls. Does not cap image/video body transfer. */
  immichTimeoutMs: number;
  rateLimitRpm: number;
  trustedProxyHops: number;
  needsSetup?: boolean;
  protection?: {
    disableRightClick?: boolean;
    disableImageDrag?: boolean;
  };
  watermark?: {
    enabled?: boolean;
    text?: string;
    opacity?: number;
    position?: 'bottom-right' | 'bottom-left' | 'center';
  };
}

export interface AlbumEntryObject {
  /** Optional: an entry may carry only a sort mode and no title override. */
  title?: string;
  description?: string;
  password?: string;
  heroImage?: string;
  /**
   * Raw YAML shape — narrowed to `AlbumSortMode` in deriveGallery(), which is
   * where an unknown value has to be rejected with a message a human can act on.
   */
  sort?: string;
  /** Pinned asset UUIDs for `sort: manual`. Everything else follows automatically. */
  assetOrder?: string[];
  /** EXPERIMENTAL: per-album grid override, merged over the subpage/global grid */
  grid?: { columns?: number; gap?: number; aspectRatio?: string; layout?: string };
  /** EXPERIMENTAL: focal point for the cover crop, e.g. "50% 25%" or "top" */
  coverPosition?: string;
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
        proofing?: boolean;
        essayFile?: string;
        essayText?: string;
        enabled?: boolean;
        hidden?: boolean;
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
    titleTemplate?: string;
    noIndex?: boolean;
    noFollow?: boolean;
  };
  exifOnHover?: boolean;
  map?: boolean;
  transitions?: boolean;
  analytics?: boolean;
  proofing?: {
    enabled?: boolean;
    allowMailto?: boolean;
  };
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
  /** EXPERIMENTAL: external links appended to the header navigation. */
  navLinks?: Array<{ label?: string; url?: string }>;
  protection?: {
    disableRightClick?: boolean;
    disableImageDrag?: boolean;
  };
  watermark?: {
    enabled?: boolean;
    text?: string;
    opacity?: number;
    position?: 'bottom-right' | 'bottom-left' | 'center';
  };
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
