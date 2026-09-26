/**
 * Shared shape of the settings form (#554). The sections edit one object
 * that mirrors settings.yaml; SettingsEditor owns it and hands each section
 * the object plus the two ways to change it.
 */

export interface Settings {
  title?: string;
  subtitle?: string;
  /** Absolute site URL for sitemap, feed and structured data (#472). */
  url?: string;
  lang?: string;
  sitePassword?: string;
  mode?: 'light' | 'dark' | 'auto';
  exifOnHover?: boolean;
  exif?: {
    camera?: boolean;
    settings?: boolean;
    location?: boolean;
    caption?: boolean;
  };
  map?: boolean;
  transitions?: boolean;
  scrollToTop?: boolean;
  analytics?: boolean;
  theme?: {
    preset?: string;
    accent?: string;
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
  footer?: {
    name?: string;
    instagram?: string;
    email?: string;
    website?: string;
  };
  /** EXPERIMENTAL: external links appended to the header navigation */
  navLinks?: Array<{ label?: string; url?: string }>;
  contact?: { enabled?: boolean; notifyUrl?: string; retentionDays?: number };
  privacy?: { enabled?: boolean };
  legal?: {
    enabled?: boolean;
    heading?: string;
    name?: string;
    address?: string;
    zipCity?: string;
    country?: string;
    email?: string;
    phone?: string;
    contactUrl?: string;
    contactLabel?: string;
    taxId?: string;
    vatId?: string;
    extraInfo?: string;
  };
  seo?: {
    title?: string;
    description?: string;
    titleTemplate?: string;
    noIndex?: boolean;
    noFollow?: boolean;
  };
  protection?: {
    disableRightClick?: boolean;
    disableImageDrag?: boolean;
  };
  proofing?: {
    enabled?: boolean;
    allowMailto?: boolean;
  };
  watermark?: {
    enabled?: boolean;
    text?: string;
    opacity?: number;
    position?: 'bottom-right' | 'bottom-left' | 'center';
  };
  about?: { enabled?: boolean };
}

export interface SectionProps {
  settings: Settings;
  /** Set one dotted path, e.g. `theme.accent`. An empty value removes the key. */
  update: (path: string, value: unknown) => void;
  /** Set several paths in one state update. */
  updateMany: (entries: Record<string, unknown>) => void;
}
