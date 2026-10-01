import type { ThemeConfig, SettingsYaml } from './schema';
import { PRESET_REGISTRY } from './presets.ts';

/** The preset used when none is configured. */
export const DEFAULT_PRESET = 'studio-modern';

/** Every built-in preset by id, derived from PRESET_REGISTRY (lib/config/presets.ts). */
export const THEME_PRESETS: Record<string, ThemeConfig> = Object.fromEntries(
  PRESET_REGISTRY.map((p) => [p.id, { preset: p.id, ...p.theme }]),
);

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
export const THEME_RADIUS_MAX = 64; // Presets top out at 16; generous but not unbounded.
function resolveRadius(raw: unknown, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.min(THEME_RADIUS_MAX, Math.max(0, raw));
}

/**
 * The one form of `--accent` every consumer survives: a `#rrggbb` hex.
 * A value that is not a colour at all is worse than it looks —
 * `background: var(--accent, #e60012)` does not fall back, because the
 * variable is *defined*; the declaration becomes invalid at computed-value
 * time and the background comes out transparent, leaving the button text on
 * the surface below. Named and functional colours (`red`, `rgb(230 0 18)`)
 * would render, but `onAccent()` only reads hex and would answer white for
 * them whatever their lightness. Parsing arbitrary CSS colour syntax
 * server-side is a dependency this does not need: hex is what the admin's
 * picker writes and what every preset uses, so everything else falls back to
 * the preset, the same treatment `resolveRadius` gives `radius`.
 */
const ACCENT_HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Whether `resolveTheme` keeps an accent rather than falling back to the preset's. */
export function isAccentHex(value: string): boolean {
  return ACCENT_HEX.test(value.trim());
}

/** Trim, case-fold and widen to `#rrggbb`; refuse anything that is not hex. */
function resolveAccent(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const value = raw.trim();
  if (!ACCENT_HEX.test(value)) return fallback;
  const hex = value.slice(1).toLowerCase();
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  // 8-digit keeps the hue and drops the alpha — an accent a visitor can read
  // is worth more than the translucency the 12%-dim variants approximate anyway.
  return `#${hex.slice(0, 6)}`;
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

/**
 * The surfaces accent-coloured text is checked against, one per mode: the
 * lightest dark surface (`--bg-card-hover` of the brightest dark preset,
 * rounded up) and the darkest light one (`--bg-secondary` of the studio
 * light palette, rounded down). Clearing these clears every other surface of
 * the same mode.
 */
const ACCENT_TEXT_SURFACE = { dark: '#262626', light: '#e8e8e3' } as const;
const AA_TEXT = 4.5;

function mixHex(a: string, b: string, weightB: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return (
    '#' +
    [0, 1, 2]
      .map((i) => Math.round(channel(a, i) * (1 - weightB) + channel(b, i) * weightB))
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Text in the accent colour (`--accent-text`), lifted to AA. A fill can be any
 * accent: `--on-accent` picks the text on top of it. Text *in* the accent
 * cannot choose its background, and the preset reds measured 3.5–3.7:1 on the
 * dark pages (#e60012 on #121212). The accent is mixed toward white on dark
 * and toward black on light, in 5% steps (the same mix `color-mix(in srgb)`
 * makes), until it reaches 4.5:1 on that mode's worst surface — so an accent
 * that already passes is returned unchanged, and every accent terminates at
 * white or black at the latest. A non-hex value is returned as it is.
 */
export function accentText(accent: string, mode: 'dark' | 'light'): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(accent.trim());
  if (!m) return accent;
  const hex = '#' + (m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]).toLowerCase();
  const surface = ACCENT_TEXT_SURFACE[mode];
  const target = mode === 'dark' ? '#ffffff' : '#000000';
  for (let step = 0; step <= 20; step++) {
    const candidate = mixHex(hex, target, step / 20);
    if ((contrastRatio(candidate, surface) ?? 0) >= AA_TEXT) return candidate;
  }
  return target;
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
