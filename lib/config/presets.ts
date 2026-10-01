import type { ThemeConfig } from './schema';

/**
 * The built-in theme presets, declared once.
 *
 * Everything that lists presets reads this array: `THEME_PRESETS` and
 * `resolveTheme()` (lib/config/theme.ts), the admin theme cards, the install
 * wizard and its allowlist, and the dev toolbar. The parts that cannot import
 * it — the palette blocks in app/tokens.css, app/themes/<id>.css and its
 * `@import`, the docs table, scripts/contrast-audit.mjs — are checked against
 * it by lib/__tests__/preset-registry.test.ts.
 *
 * Client-safe: no `fs`, so client components may import it.
 */
export interface PresetDefinition {
  id: string;
  label: string;
  /** One line under the preset in the install wizard. */
  tagline: string;
  /** The admin theme card's description. */
  description: string;
  /** What the preset applies when settings.yaml overrides nothing. */
  theme: Omit<ThemeConfig, 'preset'>;
  /**
   * The admin card's mini mockup. Font, radius and frame come from `theme`;
   * `gap` is the visual density of the preset's gallery grid.
   */
  card: { bg: string; tile: string; accent: string; type: 'serif' | 'sans' | 'mono'; gap: number };
  /**
   * Whether the preset ships its own palette in app/tokens.css and its own
   * app/themes/<id>.css. Only `studio` does not: it is the look the global
   * defaults describe.
   */
  ownStyles: boolean;
}

export const PRESET_REGISTRY: readonly PresetDefinition[] = [
  {
    id: 'studio-modern',
    label: 'Studio Modern',
    tagline: 'Precision grotesque, hairline rules',
    description: 'Leica precision: Archivo grotesque, mono EXIF, red signal accents.',
    theme: {
      accent: '#e60012',
      fonts: { heading: 'Archivo', body: 'Archivo', caption: 'IBM Plex Mono' },
      radius: 0,
      photoFrame: 'none',
      grain: false,
      headerDot: true,
      heroStyle: 'split',
    },
    card: { bg: '#121212', tile: '#191919', accent: '#e60012', type: 'sans', gap: 3 },
    ownStyles: true,
  },
  {
    id: 'studio',
    label: 'Studio',
    tagline: 'Classic portfolio, red accent',
    description: 'Playfair Display serif headings over DM Sans, matted photos on black.',
    theme: {
      accent: '#e60012',
      fonts: { heading: 'Playfair Display', body: 'DM Sans', caption: 'EB Garamond' },
      radius: 0,
      photoFrame: 'passepartout',
      grain: true,
      headerDot: true,
      heroStyle: 'split',
    },
    card: { bg: '#141414', tile: '#242424', accent: '#e60012', type: 'serif', gap: 4 },
    ownStyles: false,
  },
  {
    id: 'minimal',
    label: 'Minimal',
    tagline: 'Bare-bones, monochrome',
    description: 'Pure raw layouts with tiny gaps and high whitespace.',
    theme: {
      accent: '#000000',
      accentDark: '#ffffff',
      fonts: { heading: 'Geist', body: 'Geist', caption: 'IBM Plex Mono' },
      radius: 0,
      photoFrame: 'none',
      grain: false,
      headerDot: false,
      heroStyle: 'fullbleed',
    },
    card: { bg: '#ffffff', tile: '#f3f3f3', accent: '#111111', type: 'sans', gap: 2 },
    ownStyles: true,
  },
  {
    id: 'editorial',
    label: 'Editorial',
    tagline: 'Magazine-style serif',
    description: 'Warm backgrounds, elegant serifs and large headers.',
    theme: {
      accent: '#8B2500',
      accentDark: '#d9602a',
      fonts: { heading: 'Bodoni Moda', body: 'Newsreader', caption: 'Spectral' },
      radius: 0,
      photoFrame: 'shadow',
      grain: false,
      headerDot: false,
      heroStyle: 'split',
    },
    card: { bg: '#fbf9f4', tile: '#e5dfd4', accent: '#b89053', type: 'serif', gap: 8 },
    ownStyles: true,
  },
  {
    id: 'classic',
    label: 'Classic',
    tagline: 'Warm gold, traditional',
    description: 'Soft traditional portfolio: Cinzel capitals, rounded matted photos.',
    theme: {
      accent: '#c49a3c',
      accentLight: '#8d6f2b',
      fonts: { heading: 'Cinzel', body: 'Crimson Pro', caption: 'Crimson Pro' },
      radius: 12,
      photoFrame: 'passepartout',
      grain: false,
      headerDot: true,
      heroStyle: 'minimal',
    },
    card: { bg: '#f7f7f7', tile: '#ffffff', accent: '#444444', type: 'serif', gap: 7 },
    ownStyles: true,
  },
  {
    id: 'noir',
    label: 'Noir',
    tagline: 'Dark, high-contrast',
    description: 'High drama absolute pitch black, stark high-fashion look.',
    theme: {
      accent: '#ff6b35',
      accentLight: '#c2410c',
      fonts: { heading: 'Libre Baskerville', body: 'Source Sans 3', caption: 'Space Mono' },
      radius: 0,
      photoFrame: 'passepartout',
      grain: true,
      headerDot: false,
      heroStyle: 'fullbleed',
    },
    card: { bg: '#000000', tile: '#151515', accent: '#ffffff', type: 'serif', gap: 6 },
    ownStyles: true,
  },
  {
    id: 'monograph',
    label: 'Monograph',
    tagline: 'Typographic, text-first',
    description: 'Instrument Serif headlines, Inter text, mono captions: a quiet document feel.',
    theme: {
      accent: '#333333',
      accentDark: '#c8c8c8',
      fonts: { heading: 'Instrument Serif', body: 'Inter', caption: 'IBM Plex Mono' },
      radius: 0,
      photoFrame: 'none',
      grain: false,
      headerDot: false,
      heroStyle: 'typographic',
    },
    card: { bg: '#f4f4f6', tile: '#ffffff', accent: '#555555', type: 'serif', gap: 5 },
    ownStyles: true,
  },
  {
    id: 'kunsthalle',
    label: 'Kunsthalle',
    tagline: 'Grey gallery wall, wall labels',
    description:
      'Photos hung on a neutral grey wall with museum wall labels. Libre Franklin, petrol links.',
    theme: {
      accent: '#1d545c',
      accentDark: '#8cc3ca',
      fonts: { heading: 'Libre Franklin', body: 'Libre Franklin', caption: 'Libre Franklin' },
      radius: 0,
      photoFrame: 'shadow',
      grain: false,
      headerDot: false,
      heroStyle: 'mosaic',
    },
    card: { bg: '#2b2b29', tile: '#393937', accent: '#8cc3ca', type: 'sans', gap: 8 },
    ownStyles: true,
  },
];

/** Preset ids in registry order: the order every picker shows them in. */
export const PRESET_IDS: readonly string[] = PRESET_REGISTRY.map((p) => p.id);

export function getPresetDefinition(id: string): PresetDefinition | undefined {
  return PRESET_REGISTRY.find((p) => p.id === id);
}
