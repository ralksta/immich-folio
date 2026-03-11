import type { ThemeConfig, SettingsYaml } from './schema';

export const THEME_PRESETS: Record<string, ThemeConfig> = {
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
    fonts: { heading: 'Instrument Serif', body: 'Inter', caption: 'IBM Plex Mono' },
    radius: 0,
    photoFrame: 'none',
    grain: false,
    headerDot: false,
    heroStyle: 'typographic',
  },
  botanica: {
    preset: 'botanica',
    accent: '#4a7c59',
    fonts: { heading: 'Cormorant Garamond', body: 'Nunito Sans', caption: 'Inconsolata' },
    radius: 8,
    photoFrame: 'none',
    grain: false,
    headerDot: true,
    heroStyle: 'split',
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
];
export const VALID_LAYOUTS = ['masonry', 'uniform', 'showcase', 'filmstrip', 'editorial-flow'];

export function resolveTheme(raw?: SettingsYaml['theme']): ThemeConfig {
  if (!raw) return { ...THEME_PRESETS.studio };

  if (typeof raw === 'string') {
    const preset = THEME_PRESETS[raw];
    if (!preset) {
      throw new Error(
        `Unknown theme preset "${raw}". Valid presets: ${Object.keys(THEME_PRESETS).join(', ')}`,
      );
    }
    return { ...preset };
  }

  const baseName = raw.preset ?? 'studio';
  const base = THEME_PRESETS[baseName];
  if (!base) {
    throw new Error(
      `Unknown theme preset "${baseName}". Valid presets: ${Object.keys(THEME_PRESETS).join(', ')}`,
    );
  }

  return {
    preset: baseName,
    accent: raw.accent ?? base.accent,
    fonts: {
      heading: raw.fonts?.heading ?? base.fonts.heading,
      body: raw.fonts?.body ?? base.fonts.body,
      caption: raw.fonts?.caption ?? base.fonts.caption,
    },
    radius: raw.radius ?? base.radius,
    photoFrame: VALID_PHOTO_FRAMES.includes(raw.photoFrame ?? '')
      ? (raw.photoFrame as ThemeConfig['photoFrame'])
      : base.photoFrame,
    grain: raw.grain ?? base.grain,
    headerDot: raw.headerDot ?? base.headerDot,
    heroStyle: VALID_HERO_STYLES.includes(raw.heroStyle ?? '')
      ? (raw.heroStyle as ThemeConfig['heroStyle'])
      : base.heroStyle,
  };
}

export function getGoogleFontsUrl(theme: ThemeConfig): string {
  const weights = '300;400;500;600';
  const families = [...new Set([theme.fonts.heading, theme.fonts.body, theme.fonts.caption])];
  const params = families.map((f) => `family=${f.replace(/ /g, '+')}:wght@${weights}`).join('&');
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}
