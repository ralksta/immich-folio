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
    'masonry' | 'uniform' | 'showcase' | 'filmstrip' | 'editorial-flow' | 'essay' | 'justified';
}

/**
 * Bounds for the album-cover grid on a subpage. Shared with the admin inputs so
 * the form and the renderer cannot drift apart.
 */
export const COVER_GRID_COLUMNS_MIN = 1;
export const COVER_GRID_COLUMNS_MAX = 6;
export const COVER_GRID_GAP_MAX = 80;

/** Tablet widths show at most two covers side by side, like the photo grids. */
export const COVER_GRID_TABLET_COLUMNS_MAX = 2;

/**
 * The CSS custom properties that size the album-cover grid on a subpage.
 *
 * `columns` follows the same config as the photo grids (global `settings.yaml`
 * < per-subpage override), so "3 columns" in the admin means three columns
 * everywhere. `gap` deliberately does not: each theme preset picks the cover
 * spacing as part of its look (1px monograph, 20px studio-modern), so the
 * variable is only emitted when a subpage sets `gap` explicitly — otherwise the
 * preset's own `--subpage-gap` stands.
 *
 * `--subpage-columns-tablet` is computed here rather than in CSS because
 * `repeat()` does not reliably accept a `min()` expression.
 */
export function buildCoverGridVars(
  overrides: Partial<GridConfig> | undefined,
  globalColumns: number,
): Record<string, string | number> {
  // A hand-edited `columns: 0` would emit `repeat(0, 1fr)` and collapse the
  // grid, so the count is clamped rather than trusted.
  const columns = clamp(
    overrides?.columns ?? globalColumns,
    COVER_GRID_COLUMNS_MIN,
    COVER_GRID_COLUMNS_MAX,
  );
  const vars: Record<string, string | number> = {
    '--subpage-columns': columns,
    '--subpage-columns-tablet': Math.min(columns, COVER_GRID_TABLET_COLUMNS_MAX),
  };
  if (overrides?.gap != null) {
    vars['--subpage-gap'] = `${clamp(overrides.gap, 0, COVER_GRID_GAP_MAX)}px`;
  }
  return vars;
}

function clamp(value: number, min: number, max: number): number {
  // NaN from a malformed YAML value would survive Math.min/Math.max, and
  // `repeat(NaN, 1fr)` is an invalid declaration that drops the whole rule.
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
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
  /** Floating back-to-top arrow in the frontend. */
  scrollToTop: boolean;
  analytics: boolean;
  proofing: {
    enabled: boolean;
    allowMailto: boolean;
  };
  aboutEnabled: boolean;
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
  /**
   * True while the app is not fully installed — either credentials or
   * `gallery.yaml` are missing. Kept as the union of the two flags below for
   * callers that only care whether the setup screen is due.
   */
  needsSetup?: boolean;
  /**
   * No Immich URL or API key. Nothing can talk to Immich, and the setup wizard
   * is the only way forward.
   */
  needsCredentials?: boolean;
  /**
   * Credentials are present but `content/gallery.yaml` is not. The public site
   * has nothing to show, yet Immich is perfectly reachable — the admin panel
   * must stay usable so the file can be created from there.
   */
  needsGallery?: boolean;
  /**
   * Password for the whole public site, or `''` when the site is open.
   * Plaintext or `scrypt:salt:hash`, same as every other password in the app.
   */
  sitePassword: string;
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
  scrollToTop?: boolean;
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
  /** Puts the whole public site behind one password. `SITE_PASSWORD` overrides it. */
  sitePassword?: string;
  watermark?: {
    enabled?: boolean;
    text?: string;
    opacity?: number;
    position?: 'bottom-right' | 'bottom-left' | 'center';
  };
  about?: { enabled?: boolean };
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
