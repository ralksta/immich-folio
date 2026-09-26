import type { ThemeConfig, SettingsYaml } from './schema';

/** The preset used when none is configured. */
export const DEFAULT_PRESET = 'studio-modern';

export const THEME_PRESETS: Record<string, ThemeConfig> = {
  'studio-modern': {
    preset: 'studio-modern',
    accent: '#e60012',
    fonts: { heading: 'Archivo', body: 'Archivo', caption: 'IBM Plex Mono' },
    radius: 0,
    photoFrame: 'none',
    grain: false,
    headerDot: true,
    heroStyle: 'split',
  },
  studio: {
    preset: 'studio',
    accent: '#e60012',
    fonts: { heading: 'Playfair Display', body: 'DM Sans', caption: 'EB Garamond' },
    radius: 0,
    photoFrame: 'passepartout',
    grain: true,
    headerDot: true,
    heroStyle: 'split',
  },
  minimal: {
    preset: 'minimal',
    accent: '#000000',
    accentDark: '#ffffff',
    fonts: { heading: 'Geist', body: 'Geist', caption: 'IBM Plex Mono' },
    radius: 0,
    photoFrame: 'none',
    grain: false,
    headerDot: false,
    heroStyle: 'fullbleed',
  },
  editorial: {
    preset: 'editorial',
    accent: '#8B2500',
    accentDark: '#d9602a',
    fonts: { heading: 'Bodoni Moda', body: 'Newsreader', caption: 'Spectral' },
    radius: 0,
    photoFrame: 'shadow',
    grain: false,
    headerDot: false,
    heroStyle: 'split',
  },
  classic: {
    preset: 'classic',
    accent: '#c49a3c',
    accentLight: '#8d6f2b',
    fonts: { heading: 'Cinzel', body: 'Crimson Pro', caption: 'Crimson Pro' },
    radius: 12,
    photoFrame: 'passepartout',
    grain: false,
    headerDot: true,
    heroStyle: 'minimal',
  },
  noir: {
    preset: 'noir',
    accent: '#ff6b35',
    accentLight: '#c2410c',
    fonts: { heading: 'Libre Baskerville', body: 'Source Sans 3', caption: 'Space Mono' },
    radius: 0,
    photoFrame: 'passepartout',
    grain: true,
    headerDot: false,
    heroStyle: 'fullbleed',
  },
  monograph: {
    preset: 'monograph',
    accent: '#333333',
    accentDark: '#c8c8c8',
    fonts: { heading: 'Instrument Serif', body: 'Inter', caption: 'IBM Plex Mono' },
    radius: 0,
    photoFrame: 'none',
    grain: false,
    headerDot: false,
    heroStyle: 'typographic',
  },
};

export const VALID_PHOTO_FRAMES = ['none', 'passepartout', 'shadow'];
export const VALID_HERO_STYLES = [
  'split',
  'fullbleed',
  'minimal',
  'stacked',
  'typographic',
  'mosaic',
  'cover', // EXPERIMENTAL: fullscreen splash with a single "Enter" link
];
export const VALID_LAYOUTS = [
  'masonry',
  'uniform',
  'showcase',
  'filmstrip',
  'editorial-flow',
  'essay',
  'justified', // EXPERIMENTAL: row-based layout with equal heights
];

/**
 * Corner radius reaches CSS as `${radius}px` (app/layout.tsx: `--radius-sm`)
 * and `${radius * 1.5}px` (`--radius-md`), so a value that is not actually a
 * number — `radius: "8px"` in hand-edited YAML, say — does not fail loudly,
 * it becomes `8pxpx` and `NaNpx` (#633). photoFrame and heroStyle, on either
 * side of this field, are already checked against an allowlist; this is the
 * same treatment for the one numeric scalar in ThemeConfig.
 */
const THEME_RADIUS_MAX = 64; // Presets top out at 16; generous but not unbounded.
function resolveRadius(raw: unknown, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.min(THEME_RADIUS_MAX, Math.max(0, raw));
}

/** `--accent` and `--accent-dim` (app/layout.tsx) take this verbatim. */
function resolveAccent(raw: unknown, fallback: string): string {
  return typeof raw === 'string' && raw.trim() ? raw : fallback;
}

/** The accent a colour mode renders with (`--accent-dark` / `--accent-light`). */
export function accentForMode(theme: ThemeConfig, mode: 'dark' | 'light'): string {
  return (mode === 'dark' ? theme.accentDark : theme.accentLight) ?? theme.accent;
}

/** WCAG relative luminance of a `#rgb` / `#rrggbb` colour, or null for anything else. */
export function relativeLuminance(color: string): number | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two hex colours; null when either is not hex. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Text colour for a button filled with the accent (`--on-accent`): black or
 * white, whichever contrasts more. Buttons used `--bg-primary` for this, which
 * is the one colour guaranteed to vanish when the accent matches the page —
 * Minimal's black-on-black gate button. A non-hex accent keeps white.
 */
export function onAccent(accent: string): string {
  const toBlack = contrastRatio(accent, '#000000');
  const toWhite = contrastRatio(accent, '#ffffff');
  if (toBlack === null || toWhite === null) return '#ffffff';
  return toBlack > toWhite ? '#000000' : '#ffffff';
}

/** `String(theme.grain)`/`String(theme.headerDot)` become a `data-*` attribute
 * either way, but a non-boolean is a sign the value was never meant for this
 * field at all — a typo'd key one level up, say — so it falls back rather
 * than being coerced into something that reads as intentional. */
function resolveThemeBoolean(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback;
}

export function resolveTheme(raw?: SettingsYaml['theme']): ThemeConfig {
  if (!raw) return { ...THEME_PRESETS[DEFAULT_PRESET] };

  if (typeof raw === 'string') {
    const preset = THEME_PRESETS[raw];
    if (!preset) {
      throw new Error(
        `Unknown theme preset "${raw}". Valid presets: ${Object.keys(THEME_PRESETS).join(', ')}`,
      );
    }
    return { ...preset };
  }

  const baseName = raw.preset ?? DEFAULT_PRESET;
  const base = THEME_PRESETS[baseName];
  if (!base) {
    throw new Error(
      `Unknown theme preset "${baseName}". Valid presets: ${Object.keys(THEME_PRESETS).join(', ')}`,
    );
  }

  const accent = resolveAccent(raw.accent, base.accent);
  // An accent of the owner's own is their choice in both modes. The preset's
  // per-mode variants stand in only for the preset's accent — which the admin
  // may also have written into settings.yaml verbatim.
  const ownAccent = accent.trim().toLowerCase() !== base.accent.toLowerCase();

  return {
    preset: baseName,
    accent,
    ...(!ownAccent && base.accentDark ? { accentDark: base.accentDark } : {}),
    ...(!ownAccent && base.accentLight ? { accentLight: base.accentLight } : {}),
    fonts: {
      heading: raw.fonts?.heading ?? base.fonts.heading,
      body: raw.fonts?.body ?? base.fonts.body,
      caption: raw.fonts?.caption ?? base.fonts.caption,
    },
    radius: resolveRadius(raw.radius, base.radius),
    photoFrame: VALID_PHOTO_FRAMES.includes(raw.photoFrame ?? '')
      ? (raw.photoFrame as ThemeConfig['photoFrame'])
      : base.photoFrame,
    grain: resolveThemeBoolean(raw.grain, base.grain),
    headerDot: resolveThemeBoolean(raw.headerDot, base.headerDot),
    heroStyle: VALID_HERO_STYLES.includes(raw.heroStyle ?? '')
      ? (raw.heroStyle as ThemeConfig['heroStyle'])
      : base.heroStyle,
  };
}

/**
 * The stylesheet for a set of Google Fonts families, served from this origin
 * by /api/fonts/css (lib/fonts.ts) so a visitor's browser never contacts
 * Google. Client-safe: the dev toolbar builds the same URL.
 */
export function getFontsCssUrl(families: string[]): string {
  const unique = [...new Set(families)];
  return `/api/fonts/css?${unique.map((f) => `family=${encodeURIComponent(f)}`).join('&')}`;
}

export function getThemeFontsUrl(theme: ThemeConfig): string {
  return getFontsCssUrl([theme.fonts.heading, theme.fonts.body, theme.fonts.caption]);
}
