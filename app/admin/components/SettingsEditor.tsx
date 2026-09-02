'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as Icons from './Icons';
import SaveBar from './SaveBar';
import { useUnsavedGuard } from './useUnsavedGuard';
import ToggleCard from './fields/ToggleCard';
import OptionGrid, { toOptions } from './fields/OptionGrid';
// Direct import from the theme module, not from '@/lib/config': the config
// index pulls in `fs` and cannot be bundled into a client component.
import { DEFAULT_PRESET } from '@/lib/config/theme';
import {
  PHOTO_GRID_COLUMNS_MAX,
  PHOTO_GRID_COLUMNS_MIN,
  PHOTO_GRID_GAP_MAX,
  resolveExifDisplay,
  resolveWatermarkOpacity,
} from '@/lib/config/schema';
import { SUPPORTED_LOCALES } from '@/lib/i18n';

interface Settings {
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
  legal?: {
    enabled?: boolean;
    name?: string;
    address?: string;
    zipCity?: string;
    country?: string;
    email?: string;
    phone?: string;
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

const PRESETS = [
  'studio-modern',
  'studio',
  'minimal',
  'editorial',
  'falodu',
  'classic',
  'noir',
  'monograph',
];
const LAYOUTS = ['masonry', 'uniform', 'showcase', 'filmstrip', 'editorial-flow', 'justified'];
const PHOTO_FRAMES = ['none', 'passepartout', 'shadow'];
const HERO_STYLES = ['split', 'fullbleed', 'minimal', 'stacked', 'typographic', 'mosaic', 'cover'];
const ASPECT_RATIOS = ['1', '3/2', '2/3', '16/9', 'auto'];

const PHOTO_FRAME_INFO: Record<string, { label: string; desc: string }> = {
  none: { label: 'None', desc: 'Flush image with crisp edges' },
  passepartout: {
    label: 'Passepartout',
    desc: 'Classic gallery matting border',
  },
  shadow: { label: 'Shadow', desc: 'Soft floating drop shadow' },
};
const PHOTO_FRAME_OPTIONS = toOptions(PHOTO_FRAMES, PHOTO_FRAME_INFO);

function PhotoFramePreview({ value }: { value: string }) {
  return (
    <div className="frame-card-preview">
      <div className={`mini-frame-demo frame-${value}`}>
        <div className="mini-frame-photo" />
      </div>
    </div>
  );
}

const HERO_STYLE_INFO: Record<string, { label: string; desc: string }> = {
  split: { label: 'Split', desc: 'Side-by-side title & photo' },
  fullbleed: { label: 'Fullbleed', desc: 'Edge-to-edge full width banner' },
  minimal: { label: 'Minimal', desc: 'Centered title with subtle photo' },
  stacked: { label: 'Stacked', desc: 'Title stacked directly over photo' },
  typographic: { label: 'Typographic', desc: 'Oversized magazine masthead' },
  mosaic: { label: 'Mosaic', desc: 'Dynamic photo collage layout' },
  cover: {
    label: 'Cover (Experimental)',
    desc: 'Fullscreen splash with a single Enter link',
  },
};
const HERO_STYLE_OPTIONS = toOptions(HERO_STYLES, HERO_STYLE_INFO);

function HeroStylePreview({ value }: { value: string }) {
  return (
    <div className="hero-card-preview">
      <div className={`mini-hero-demo hero-demo-${value}`}>
        {value === 'split' && (
          <>
            <div className="hero-demo-text">
              <div className="demo-line title" />
              <div className="demo-line sub" />
            </div>
            <div className="hero-demo-photo" />
          </>
        )}
        {value === 'fullbleed' && (
          <div className="hero-demo-full">
            <div className="demo-line title light" />
          </div>
        )}
        {value === 'minimal' && (
          <>
            <div className="hero-demo-center-text">
              <div className="demo-line title short" />
            </div>
            <div className="hero-demo-photo small" />
          </>
        )}
        {value === 'stacked' && (
          <>
            <div className="hero-demo-text">
              <div className="demo-line title" />
            </div>
            <div className="hero-demo-photo banner" />
          </>
        )}
        {value === 'typographic' && (
          <>
            <div className="demo-line title giant" />
            <div className="hero-demo-grid2">
              <div className="hero-demo-photo" />
              <div className="hero-demo-photo" />
            </div>
          </>
        )}
        {value === 'mosaic' && (
          <div className="hero-demo-mosaic">
            <div className="hero-demo-photo big" />
            <div className="hero-demo-photo-col">
              <div className="hero-demo-photo" />
              <div className="hero-demo-photo" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const LAYOUT_INFO: Record<string, { label: string; desc: string }> = {
  masonry: {
    label: 'Masonry',
    desc: 'Dynamic pinterest-style staggered columns',
  },
  uniform: { label: 'Uniform Grid', desc: 'Clean equal aspect ratio grid' },
  showcase: {
    label: 'Showcase',
    desc: 'Featured hero photos mixed with smaller tiles',
  },
  filmstrip: {
    label: 'Filmstrip',
    desc: 'Horizontal scrollable film strip timeline',
  },
  'editorial-flow': {
    label: 'Editorial Flow',
    desc: 'Magazine story layout with varying photo sizes',
  },
  justified: {
    label: 'Justified (Experimental)',
    desc: 'Equal-height rows that fill the full width',
  },
};
const LAYOUT_OPTIONS = toOptions(LAYOUTS, LAYOUT_INFO);

function LayoutPreview({ value }: { value: string }) {
  return (
    <div className="grid-card-preview">
      <div className={`mini-layout-demo layout-demo-${value}`}>
        {value === 'masonry' && (
          <div className="demo-masonry-col-group">
            <div className="demo-col">
              <div className="demo-tile h-high" />
              <div className="demo-tile h-low" />
            </div>
            <div className="demo-col">
              <div className="demo-tile h-low" />
              <div className="demo-tile h-high" />
            </div>
            <div className="demo-col">
              <div className="demo-tile h-med" />
              <div className="demo-tile h-med" />
            </div>
          </div>
        )}
        {value === 'uniform' && (
          <div className="demo-uniform-grid">
            <div className="demo-tile" />
            <div className="demo-tile" />
            <div className="demo-tile" />
            <div className="demo-tile" />
            <div className="demo-tile" />
            <div className="demo-tile" />
          </div>
        )}
        {value === 'showcase' && (
          <div className="demo-showcase-grid">
            <div className="demo-tile demo-hero" />
            <div className="demo-col">
              <div className="demo-tile" />
              <div className="demo-tile" />
            </div>
          </div>
        )}
        {value === 'filmstrip' && (
          <div className="demo-filmstrip-row">
            <div className="demo-tile strip" />
            <div className="demo-tile strip" />
            <div className="demo-tile strip" />
          </div>
        )}
        {value === 'editorial-flow' && (
          <div className="demo-editorial-flow">
            <div className="demo-tile wide" />
            <div className="demo-row">
              <div className="demo-tile" />
              <div className="demo-tile" />
            </div>
          </div>
        )}
        {value === 'justified' && (
          <div className="demo-editorial-flow">
            <div className="demo-row">
              <div className="demo-tile wide" />
              <div className="demo-tile" />
            </div>
            <div className="demo-row">
              <div className="demo-tile" />
              <div className="demo-tile wide" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const ASPECT_RATIO_INFO: Record<string, { label: string; desc: string }> = {
  '1': { label: 'Square (1:1)', desc: '1:1 ratio square crops' },
  '3/2': { label: 'Landscape (3:2)', desc: 'Standard 35mm DSLR landscape' },
  '2/3': { label: 'Portrait (2:3)', desc: 'Vertical portrait orientation' },
  '16/9': { label: 'Cinema (16:9)', desc: 'Widescreen 16:9 cinematic ratio' },
  auto: {
    label: 'Original Auto',
    desc: 'Uncropped original image proportions',
  },
};
const ASPECT_RATIO_OPTIONS = toOptions(ASPECT_RATIOS, ASPECT_RATIO_INFO);

function AspectRatioPreview({ value }: { value: string }) {
  return (
    <div className="ratio-card-preview">
      <div className={`mini-aspect-box ratio-${value.replace('/', '-')}`}>
        <div className="mini-aspect-inner" />
      </div>
    </div>
  );
}

/**
 * Card metadata for the theme picker. `font`, `radius` and `frame` mirror the
 * real preset definitions in lib/config/theme.ts so the mini mockups show what
 * the preset actually does; `gap` is the visual density of its gallery grid.
 */
const THEME_INFO: Record<
  string,
  {
    desc: string;
    label: string;
    accent: string;
    bg: string;
    tile: string;
    font: string;
    type: 'serif' | 'sans' | 'mono';
    radius: number;
    frame: 'none' | 'passepartout' | 'shadow';
    gap: number;
  }
> = {
  studio: {
    label: 'Studio',
    desc: 'Clean, high-contrast grid with sans-serif type.',
    bg: '#141414',
    tile: '#242424',
    accent: '#e60012',
    font: 'Playfair Display',
    type: 'serif',
    radius: 0,
    frame: 'passepartout',
    gap: 4,
  },
  'studio-modern': {
    label: 'Studio Modern',
    desc: 'Leica precision: Archivo grotesque, mono EXIF, red signal accents.',
    bg: '#121212',
    tile: '#191919',
    accent: '#e60012',
    font: 'Archivo',
    type: 'sans',
    radius: 0,
    frame: 'none',
    gap: 3,
  },
  minimal: {
    label: 'Minimal',
    desc: 'Pure raw layouts with tiny gaps and high whitespace.',
    bg: '#ffffff',
    tile: '#f3f3f3',
    accent: '#111111',
    font: 'Geist',
    type: 'sans',
    radius: 0,
    frame: 'none',
    gap: 2,
  },
  editorial: {
    label: 'Editorial',
    desc: 'Warm backgrounds, elegant serifs and large headers.',
    bg: '#fbf9f4',
    tile: '#e5dfd4',
    accent: '#b89053',
    font: 'Bodoni Moda',
    type: 'serif',
    radius: 0,
    frame: 'shadow',
    gap: 8,
  },
  falodu: {
    label: 'Falodu',
    desc: 'Fullbleed landscape portfolio: serif display, airy masonry.',
    bg: '#faf9f6',
    tile: '#ffffff',
    accent: '#6f6a58',
    font: 'Cormorant Garamond',
    type: 'serif',
    radius: 0,
    frame: 'none',
    gap: 7,
  },
  classic: {
    label: 'Classic',
    desc: 'Soft traditional photographer portfolio with shadows.',
    bg: '#f7f7f7',
    tile: '#ffffff',
    accent: '#444444',
    font: 'Cinzel',
    type: 'serif',
    radius: 12,
    frame: 'passepartout',
    gap: 7,
  },
  noir: {
    label: 'Noir',
    desc: 'High drama absolute pitch black, stark high-fashion look.',
    bg: '#000000',
    tile: '#151515',
    accent: '#ffffff',
    font: 'Libre Baskerville',
    type: 'serif',
    radius: 0,
    frame: 'passepartout',
    gap: 6,
  },
  monograph: {
    label: 'Monograph',
    desc: 'Typewriter monospace font, grid borders and document feel.',
    bg: '#f4f4f6',
    tile: '#ffffff',
    accent: '#555555',
    font: 'Instrument Serif',
    type: 'mono',
    radius: 0,
    frame: 'none',
    gap: 5,
  },
};

/* The preset group sits below THEME_INFO on purpose. PRESET_OPTIONS is built
   at module evaluation and reads it through themeInfo(); declared above, it
   hit the temporal dead zone and the whole Settings page failed to load with
   "Cannot access 'THEME_INFO' before initialization". tsc does not catch it
   because the read goes through a hoisted function, and a production build
   succeeds because the module is only evaluated in the browser (#542). */
/** The theme picker's own metadata, with the fallback the card grid needs. */
function themeInfo(value: string) {
  return (
    THEME_INFO[value] || {
      label: value,
      desc: '',
      bg: '#fff',
      tile: '#eee',
      accent: '#333',
      font: 'System',
      type: 'sans' as const,
      radius: 0,
      frame: 'none' as const,
      gap: 4,
    }
  );
}

const PRESET_OPTIONS = PRESETS.map((value) => ({
  value,
  label: themeInfo(value).label,
  desc: themeInfo(value).desc,
}));

function PresetPreview({ value }: { value: string }) {
  const i = themeInfo(value);
  return (
    <div className="preset-card-preview" data-frame={i.frame}>
      <div className="mini-header">
        <span className={`mini-specimen type-${i.type}`}>Aa</span>
        <span className="mini-line" />
      </div>
      <div className="mini-grid">
        <div className="mini-tile" />
        <div className="mini-tile" />
        <div className="mini-tile" />
      </div>
    </div>
  );
}

function PresetSpecs({ value }: { value: string }) {
  const i = themeInfo(value);
  return (
    <span className="preset-card-specs">
      {i.font} &middot; radius {i.radius} &middot; {i.frame}
    </span>
  );
}

const SETTINGS_SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'theme', label: 'Theme' },
  { id: 'grid', label: 'Grid' },
  { id: 'footer', label: 'Footer' },
  { id: 'legal', label: 'Legal' },
  { id: 'seo', label: 'SEO' },
  { id: 'security', label: 'Security & Protection' },
  { id: 'about', label: 'About' },
];

interface SettingsEditorProps {
  /** Sub-section to show, taken from the /admin/settings/[section] route. */
  section?: string;
}

/**
 * One labelled block of related switches.
 *
 * The features panel was a single flat grid of identical cards, so nothing said
 * which switches belonged together — and a switch that publishes private notes
 * looked exactly like one that controls a fade (#510).
 */
function FeatureGroup({
  icon,
  title,
  description,
  chip,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  /** Short marker for a group that needs its own weight, e.g. what visitors see. */
  chip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-group">
      <div className="settings-group-head">
        <span className="settings-group-title">
          {icon}
          {title}
          {chip && <span className="settings-group-chip">{chip}</span>}
        </span>
        <span className="settings-group-desc">{description}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * A switch inside a group panel. Deliberately lighter than a toggle card: these
 * are settings *of* the panel they sit in, and rendering them as peers of the
 * top-level cards is what hid the structure in the first place.
 */
function SettingRow({
  title,
  description,
  checked,
  onToggle,
  disabled,
  hint,
  indented,
}: {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  /** A row whose parent switch is off — shown, but inert and explained. */
  disabled?: boolean;
  hint?: string;
  indented?: boolean;
}) {
  return (
    <button
      type="button"
      className={`setting-row${indented ? ' setting-row--indented' : ''}${
        disabled ? ' setting-row--disabled' : ''
      }`}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={checked}
    >
      <span className="setting-row-info">
        <span className="setting-row-title">{title}</span>
        <span className="setting-row-desc">{description}</span>
        {hint && (
          <span className="setting-row-hint">
            <Icons.IconBan size={11} /> {hint}
          </span>
        )}
      </span>
      <span className={`switch-toggle switch-toggle--sm ${checked && !disabled ? 'on' : ''}`}>
        <span className="switch-slider" />
      </span>
    </button>
  );
}

export default function SettingsEditor({ section }: SettingsEditorProps) {
  const router = useRouter();
  // An unknown section in the URL falls back to General instead of an empty panel.
  const activeSection = SETTINGS_SECTIONS.some((sec) => sec.id === section)
    ? (section as string)
    : 'general';
  const [settings, setSettings] = useState<Settings>({});
  /** Resolved site URL and its origin, so the panel can name SITE_URL (#472). */
  const [siteUrlInfo, setSiteUrlInfo] = useState<{
    effective: string | null;
    source: 'env' | 'settings' | 'none';
  } | null>(null);
  const [loading, setLoading] = useState(true);
  // Collapsed by default: the four metadata switches are a detail of one
  // decision, and showing them permanently is what made the section a wall (#510).
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const [currentMode, setCurrentMode] = useState<'dark' | 'light'>('dark');
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [faviconMessage, setFaviconMessage] = useState('');

  // About content state (independent of main settings save)
  const [aboutMeta, setAboutMeta] = useState<{
    portrait?: string;
    name?: string;
    location?: string;
    gear?: string[];
  }>({});
  const [aboutBody, setAboutBody] = useState('');
  const [aboutLoading, setAboutLoading] = useState(false);
  const [aboutSaving, setAboutSaving] = useState(false);
  const [aboutDirty, setAboutDirty] = useState(false);
  const [aboutMessage, setAboutMessage] = useState('');
  const [aboutGearText, setAboutGearText] = useState('');

  useEffect(() => {
    loadSettings();
    if (typeof window !== 'undefined') {
      const mode =
        (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark';
      setCurrentMode(mode);
    }
  }, []);

  // Sync picked preset & accent color to document element immediately for live feedback
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (settings.theme?.preset) {
        document.documentElement.setAttribute('data-preset', settings.theme.preset);
      }
      if (settings.theme?.accent) {
        document.documentElement.style.setProperty('--accent', settings.theme.accent);
        document.documentElement.style.setProperty('--admin-accent', settings.theme.accent);
      }
    }
  }, [settings.theme?.preset, settings.theme?.accent]);

  // The About panel has its own route, so load its content when that section opens
  useEffect(() => {
    if (activeSection === 'about') loadAboutContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  const toggleMode = (mode: 'dark' | 'light') => {
    setCurrentMode(mode);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', mode);
      localStorage.setItem('theme', mode);
    }
  };

  // ── Keyboard shortcut: ⌘+S / Ctrl+S ─────────────────────────
  const handleSaveRef = useCallback(() => {
    if (activeSection === 'about') {
      if (aboutDirty && !aboutSaving) saveAboutContent();
      return;
    }
    if (dirty && !saving) {
      handleSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dirty,
    saving,
    settings,
    activeSection,
    aboutDirty,
    aboutSaving,
    aboutMeta,
    aboutBody,
    aboutGearText,
  ]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveRef();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveRef]);

  useUnsavedGuard(dirty);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const { settings: data, siteUrl } = await res.json();
        setSettings(data || {});
        setSiteUrlInfo(siteUrl ?? null);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }

  /** Write several paths in one state update — used by the metadata master switch. */
  function updateMany(entries: Record<string, unknown>) {
    setSettings((s) => {
      const copy = JSON.parse(JSON.stringify(s));
      for (const [path, value] of Object.entries(entries)) {
        const parts = path.split('.');
        let obj = copy;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!obj[parts[i]]) obj[parts[i]] = {};
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
      }
      return copy;
    });
    setDirty(true);
    setSaveMessage('');
  }

  function update(path: string, value: unknown) {
    setSettings((s) => {
      const copy = JSON.parse(JSON.stringify(s));
      const parts = path.split('.');
      let obj = copy;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      const key = parts[parts.length - 1];
      if (value === '' || value === undefined) {
        delete obj[key];
      } else {
        obj[key] = value;
      }
      return copy;
    });
    setDirty(true);
    setSaveMessage('');
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage('');

    // Clean up empty objects
    const cleaned = JSON.parse(JSON.stringify(settings));
    for (const key of Object.keys(cleaned)) {
      if (typeof cleaned[key] === 'object' && Object.keys(cleaned[key]).length === 0) {
        delete cleaned[key];
      }
    }

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: cleaned }),
      });

      if (res.ok) {
        const data = await res.json();
        setDirty(false);
        setSaveMessage(data.message || 'Saved!');
        router.refresh();
        setTimeout(() => setSaveMessage(''), 5000);
      } else {
        const err = await res.json();
        setSaveMessage(`Error: ${err.error}`);
      }
    } catch {
      setSaveMessage('Error: Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function loadAboutContent() {
    setAboutLoading(true);
    try {
      const res = await fetch('/api/admin/about');
      if (res.ok) {
        const data = await res.json();
        setAboutMeta(data.meta || {});
        setAboutBody(data.body || '');
        setAboutGearText(data.meta?.gear?.join('\n') || '');
      }
    } catch (err) {
      console.error('Failed to load about content:', err);
    } finally {
      setAboutLoading(false);
    }
  }

  async function saveAboutContent() {
    setAboutSaving(true);
    setAboutMessage('');
    const cleanedMeta = { ...aboutMeta };
    for (const [k, v] of Object.entries(cleanedMeta)) {
      if (v === '' || v === undefined) delete cleanedMeta[k as keyof typeof cleanedMeta];
    }
    const gearLines = aboutGearText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (gearLines.length > 0) {
      cleanedMeta.gear = gearLines;
    } else {
      delete cleanedMeta.gear;
    }

    try {
      const res = await fetch('/api/admin/about', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meta: cleanedMeta, body: aboutBody }),
      });
      if (res.ok) {
        const data = await res.json();
        setAboutDirty(false);
        setAboutMessage(data.message || 'Saved!');
        setTimeout(() => setAboutMessage(''), 4000);
      } else {
        const err = await res.json();
        setAboutMessage(`Error: ${err.error}`);
      }
    } catch {
      setAboutMessage('Error: Failed to save');
    } finally {
      setAboutSaving(false);
    }
  }

  function updateAboutMeta(key: string, value: unknown) {
    setAboutMeta((m) => ({ ...m, [key]: value }));
    setAboutDirty(true);
    setAboutMessage('');
  }

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
      </div>
    );
  }

  // Resolved the same way the site resolves it, so the switches show what a
  // visitor actually sees — including a config that only ever set the older
  // `exifOnHover`.
  const exif = resolveExifDisplay(settings.exif, settings.exifOnHover);

  // The master switch has no key of its own and needs none: "off" is all four
  // groups off, a state the site already acts on — with nothing left to show,
  // the lightbox withdraws its info button and the `i` key entirely (#506).
  const anyMetadata = exif.camera || exif.settings || exif.location || exif.caption;
  const metadataSummary =
    [
      exif.camera && 'Camera & lens',
      exif.settings && 'Exposure',
      exif.location && 'Location',
      exif.caption && 'Description',
    ]
      .filter(Boolean)
      .join(' · ') || 'Nothing published — the lightbox hides its info panel';

  /** Turning it back on selects everything; the details below narrow it again. */
  const toggleMetadata = () =>
    updateMany({
      'exif.camera': !anyMetadata,
      'exif.settings': !anyMetadata,
      'exif.location': !anyMetadata,
      'exif.caption': !anyMetadata,
    });

  return (
    <div className="settings-editor">
      {/* The About panel edits about.md, not settings.yaml, so it drives the bar itself. */}
      {activeSection === 'about' ? (
        <SaveBar
          dirty={aboutDirty}
          saving={aboutSaving}
          saveMessage={aboutMessage}
          onSave={saveAboutContent}
          label="Save About"
        />
      ) : (
        <SaveBar
          dirty={dirty}
          saving={saving}
          saveMessage={saveMessage}
          onSave={handleSave}
          label="Save Settings"
        />
      )}

      <p className="settings-live-sync-note">
        <Icons.IconRefresh size={13} /> Live Sync (No Docker restart required)
      </p>

      <div className="settings-layout">
        {/* Sidebar */}
        <nav className="settings-nav">
          {SETTINGS_SECTIONS.map((sec) => (
            <Link
              key={sec.id}
              href={`/admin/settings/${sec.id}`}
              className={`settings-nav-item ${activeSection === sec.id ? 'active' : ''}`}
            >
              {sec.label}
            </Link>
          ))}
        </nav>

        {/* Content */}
        <div className="settings-content">
          {activeSection === 'general' && (
            <div className="settings-panel">
              <div className="settings-section-header">
                <h3>
                  <Icons.IconGear size={18} /> General Site Settings
                </h3>
                <p className="settings-section-sub">
                  Configure basic site identity, language, and core feature toggles.
                </p>
              </div>

              <div className="admin-field">
                <label>Site Title</label>
                <input
                  value={settings.title || ''}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="My Portfolio"
                />
              </div>
              <div className="admin-field">
                <label>Subtitle</label>
                <input
                  value={settings.subtitle || ''}
                  onChange={(e) => update('subtitle', e.target.value)}
                  placeholder="A visual journal"
                />
              </div>
              <div className="admin-field">
                <label>Language</label>
                <select
                  value={settings.lang || 'en'}
                  onChange={(e) => update('lang', e.target.value)}
                >
                  <option value="en">English (US)</option>
                  <option value="de">Deutsch (DE)</option>
                  <option value="fr">Français (FR)</option>
                  <option value="es">Español (ES)</option>
                  <option value="ja">日本語 (JA)</option>
                </select>
                <p className="admin-field-hint">
                  The visitor-facing interface is translated for {SUPPORTED_LOCALES.join(', ')}.
                  Other languages still set <code>&lt;html lang&gt;</code> and date formatting, but
                  show the English interface. The admin panel is always English.
                </p>
              </div>

              <div className="settings-section-divider" />

              <div className="settings-section-header">
                <h3>
                  <Icons.IconSparkles size={18} /> Portfolio Features &amp; Modules
                </h3>
                <p className="settings-section-sub">
                  Enable or disable optional portfolio modules, privacy analytics, and map widgets.
                </p>
              </div>

              <FeatureGroup
                icon={<Icons.IconFrame size={13} />}
                title="Pages &amp; motion"
                description="Chrome the visitor sees on every page."
              >
                <div className="admin-toggle-cards-grid">
                  <ToggleCard
                    icon={<Icons.IconCamera size={16} />}
                    title="About Page"
                    description="Show a portrait, bio, and gear section on your portfolio"
                    checked={settings.about?.enabled !== false}
                    onToggle={() => update('about.enabled', settings.about?.enabled === false)}
                  />

                  <ToggleCard
                    icon={<Icons.IconSparkles size={16} />}
                    title="Smooth Page Transitions"
                    description="Enable subtle fade-in animations between page navigation"
                    checked={settings.transitions !== false}
                    onToggle={() => update('transitions', settings.transitions === false)}
                  />

                  <ToggleCard
                    icon={<Icons.IconArrowUp size={16} />}
                    title="Scroll-to-Top Button"
                    description="Show a floating arrow that returns visitors to the top of long pages"
                    checked={settings.scrollToTop !== false}
                    onToggle={() => update('scrollToTop', settings.scrollToTop === false)}
                  />
                </div>
              </FeatureGroup>

              <FeatureGroup
                icon={<Icons.IconShieldCheck size={13} />}
                title="What each photo reveals"
                description="Published to anyone who opens a photo."
                chip="visible to visitors"
              >
                <div className={`metadata-card ${anyMetadata ? 'active' : ''}`}>
                  <button
                    type="button"
                    className="metadata-card-main"
                    onClick={toggleMetadata}
                    aria-pressed={anyMetadata}
                  >
                    <span className="toggle-card-info">
                      <span className="toggle-card-title">
                        <Icons.IconCamera size={16} /> Photo metadata
                      </span>
                      <span className="toggle-card-desc">{metadataSummary}</span>
                    </span>
                    <span className={`switch-toggle ${anyMetadata ? 'on' : ''}`}>
                      <span className="switch-slider" />
                    </span>
                  </button>

                  <button
                    type="button"
                    className="metadata-details-btn"
                    onClick={() => setMetadataOpen((open) => !open)}
                    aria-expanded={metadataOpen}
                  >
                    Details
                    <Icons.IconChevronDown
                      size={13}
                      className={`metadata-details-chevron${metadataOpen ? ' open' : ''}`}
                    />
                  </button>

                  {metadataOpen && (
                    <div className="metadata-details">
                      <SettingRow
                        title="Camera &amp; Lens"
                        description="Body, lens and focal length"
                        checked={exif.camera}
                        onToggle={() => update('exif.camera', !exif.camera)}
                      />
                      <SettingRow
                        title="Exposure Settings"
                        description="Aperture, shutter speed and ISO"
                        checked={exif.settings}
                        onToggle={() => update('exif.settings', !exif.settings)}
                      />
                      <SettingRow
                        title="Location"
                        description="City and country from the photo's GPS data"
                        checked={exif.location}
                        onToggle={() => update('exif.location', !exif.location)}
                      />
                      <SettingRow
                        title="Photo Description"
                        description="The description written in Immich"
                        checked={exif.caption}
                        onToggle={() => update('exif.caption', !exif.caption)}
                      />

                      {/* Dependent, not a peer: this only controls the grid overlay, and
                      the overlay carries camera and lens. With those off it has
                      nothing to show, which used to leave it switched on and
                      silently doing nothing (#510). */}
                      <SettingRow
                        indented
                        title="Summary on grid hover"
                        description="Camera and lens over the photo, not only in the lightbox"
                        checked={settings.exifOnHover !== false}
                        disabled={!exif.camera}
                        hint={exif.camera ? undefined : 'Needs Camera & Lens'}
                        onToggle={() => update('exifOnHover', settings.exifOnHover === false)}
                      />
                    </div>
                  )}
                </div>
              </FeatureGroup>

              <FeatureGroup
                icon={<Icons.IconHeart size={13} />}
                title="What visitors can do"
                description="Optional pages and interactions."
              >
                <div className="admin-toggle-cards-grid">
                  <ToggleCard
                    icon={<Icons.IconMap size={16} />}
                    title="Interactive GPS Map"
                    description="Enable /map view showing photo locations on a world map"
                    checked={settings.map === true}
                    onToggle={() => update('map', !settings.map)}
                  />

                  <ToggleCard
                    icon={<Icons.IconHeart size={16} />}
                    title="Client Proofing & Favorites"
                    description="Allow visitors & clients to heart, filter, and export favorite photo selections"
                    checked={settings.proofing?.enabled !== false}
                    onToggle={() =>
                      update('proofing.enabled', settings.proofing?.enabled === false)
                    }
                  />
                </div>
              </FeatureGroup>

              <FeatureGroup
                icon={<Icons.IconBarChart size={13} />}
                title="Measurement"
                description="Cookieless and self-hosted — nothing leaves your server."
              >
                <div className="admin-toggle-cards-grid">
                  <ToggleCard
                    icon={<Icons.IconBarChart size={16} />}
                    title="Analytics Tracking"
                    description="Collect anonymous privacy-friendly visit statistics"
                    checked={settings.analytics !== false}
                    onToggle={() => update('analytics', settings.analytics === false)}
                  />
                </div>
              </FeatureGroup>

              <div className="admin-field favicon-field">
                <label>Favicon</label>
                <div className="favicon-row">
                  <input
                    type="file"
                    accept=".svg,.png,.ico,.jpg,.jpeg"
                    disabled={faviconUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setFaviconMessage('');
                      setFaviconUploading(true);
                      const form = new FormData();
                      form.append('file', file);
                      try {
                        const res = await fetch('/api/admin/favicon', {
                          method: 'PUT',
                          body: form,
                        });
                        const data = await res.json();
                        setFaviconMessage(res.ok ? data.message : `Error: ${data.error}`);
                      } catch {
                        setFaviconMessage('Error: Upload failed');
                      } finally {
                        setFaviconUploading(false);
                        e.target.value = '';
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={faviconUploading}
                    onClick={async () => {
                      setFaviconMessage('');
                      setFaviconUploading(true);
                      try {
                        const res = await fetch('/api/admin/favicon', { method: 'DELETE' });
                        const data = await res.json();
                        setFaviconMessage(res.ok ? data.message : `Error: ${data.error}`);
                      } catch {
                        setFaviconMessage('Error: Reset failed');
                      } finally {
                        setFaviconUploading(false);
                      }
                    }}
                  >
                    Reset
                  </button>
                  {faviconUploading && <div className="admin-spinner" />}
                </div>
                {faviconMessage && (
                  <p
                    className={`save-message ${faviconMessage.startsWith('Error') ? 'error' : 'success'}`}
                  >
                    {faviconMessage}
                  </p>
                )}
                <span className="admin-field-hint">
                  SVG, PNG, ICO, or JPEG — max 512 kB. Stored in the content volume. Reset restores
                  the bundled default.
                </span>
              </div>
            </div>
          )}

          {activeSection === 'theme' && (
            <div className="settings-panel theme-settings-panel">
              <div className="settings-section-header">
                <h3>
                  <Icons.IconPalette size={18} /> Theme Presets &amp; Color Mode
                </h3>
                <p className="settings-section-sub">
                  Choose a typography preset and preview in Light or Dark mode.
                </p>
              </div>

              <div className="admin-field">
                <label>Visitor Default Mode</label>
                <select
                  value={settings.mode || 'dark'}
                  onChange={(e) => update('mode', e.target.value)}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="auto">Follow the visitor's system</option>
                </select>
                <p className="admin-field-hint">
                  What a first-time visitor sees. The light/dark toggle in the site header still
                  lets them choose, and their choice is remembered on their device. The preview
                  below is your own, and does not change this.
                </p>
              </div>

              <OptionGrid
                label="Preset"
                options={PRESET_OPTIONS}
                value={settings.theme?.preset || DEFAULT_PRESET}
                onSelect={(v) => update('theme.preset', v)}
                cardClassName="theme-preset-card"
                renderPreview={(o) => <PresetPreview value={o.value} />}
                renderSpecs={(o) => <PresetSpecs value={o.value} />}
                cardStyle={(o) => {
                  const i = themeInfo(o.value);
                  return {
                    '--preset-accent': i.accent,
                    '--preset-bg': i.bg,
                    '--preset-tile': i.tile,
                    '--preset-radius': `${i.radius}px`,
                    '--preset-gap': `${i.gap}px`,
                  } as React.CSSProperties;
                }}
              />

              <div className="admin-field">
                <label>Color Mode</label>
                <p
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--admin-text-muted)',
                    margin: '0.25rem 0 0.6rem',
                    lineHeight: '1.4',
                  }}
                >
                  Presets like <strong>Editorial</strong>, <strong>Minimal</strong> &amp;{' '}
                  <strong>Classic</strong> feature warm light/cream backgrounds in Light Mode and
                  charcoal in Dark Mode.
                </p>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={`segment-btn ${currentMode === 'light' ? 'active' : ''}`}
                    onClick={() => toggleMode('light')}
                  >
                    <Icons.IconSun size={14} /> Light Mode (Cream / Beige)
                  </button>
                  <button
                    type="button"
                    className={`segment-btn ${currentMode === 'dark' ? 'active' : ''}`}
                    onClick={() => toggleMode('dark')}
                  >
                    <Icons.IconMoon size={14} /> Dark Mode (Charcoal)
                  </button>
                </div>
              </div>

              <div className="settings-section-divider" />

              <div className="settings-section-header">
                <h3>
                  <Icons.IconTarget size={18} /> Accent Color
                </h3>
                <p className="settings-section-sub">
                  Pick a primary accent color for links, buttons, and highlights.
                </p>
              </div>

              <div className="admin-field">
                <div className="accent-picker-wrapper">
                  <div className="color-swatches-row">
                    {[
                      { hex: '#e60012', name: 'Studio Red' },
                      { hex: '#b89053', name: 'Editorial Gold' },
                      { hex: '#10b981', name: 'Emerald' },
                      { hex: '#3b82f6', name: 'Sapphire' },
                      { hex: '#8b5cf6', name: 'Violet' },
                      { hex: '#ffffff', name: 'Monochrome White' },
                      { hex: '#000000', name: 'Obsidian Black' },
                    ].map((swatch) => {
                      const isSelected =
                        (settings.theme?.accent || '#e60012').toLowerCase() ===
                        swatch.hex.toLowerCase();
                      return (
                        <button
                          key={swatch.hex}
                          type="button"
                          className={`color-swatch-btn ${isSelected ? 'active' : ''}`}
                          style={{ backgroundColor: swatch.hex }}
                          onClick={() => update('theme.accent', swatch.hex)}
                          title={swatch.name}
                        />
                      );
                    })}
                  </div>
                  <div className="color-field">
                    <input
                      type="color"
                      value={settings.theme?.accent || '#e60012'}
                      onChange={(e) => update('theme.accent', e.target.value)}
                    />
                    <input
                      type="text"
                      value={settings.theme?.accent || ''}
                      onChange={(e) => update('theme.accent', e.target.value)}
                      placeholder="#e60012"
                    />
                  </div>
                </div>
              </div>

              <div className="settings-section-divider" />

              <div className="settings-section-header">
                <h3>
                  <Icons.IconFrame size={18} /> Photo Frame &amp; Layout
                </h3>
                <p className="settings-section-sub">
                  Customize image presentation borders and hero layouts.
                </p>
              </div>

              <OptionGrid
                label="Photo Frame"
                options={PHOTO_FRAME_OPTIONS}
                value={settings.theme?.photoFrame || 'none'}
                onSelect={(v) => update('theme.photoFrame', v)}
                cardClassName="frame-card"
                renderPreview={(o) => <PhotoFramePreview value={o.value} />}
              />

              <OptionGrid
                label="Hero Style"
                options={HERO_STYLE_OPTIONS}
                value={settings.theme?.heroStyle || 'split'}
                onSelect={(v) => update('theme.heroStyle', v)}
                cardClassName="hero-card"
                renderPreview={(o) => <HeroStylePreview value={o.value} />}
              />

              <div className="settings-section-divider" />

              <div className="settings-section-header">
                <h3>
                  <Icons.IconSparkles size={18} /> Finishing Touches
                </h3>
                <p className="settings-section-sub">
                  Enable optional visual effects and indicators.
                </p>
              </div>

              <div className="admin-toggle-cards-grid">
                <ToggleCard
                  icon={<Icons.IconFilm size={16} />}
                  title="Film Grain Texture"
                  description="Adds analog noise overlay across portfolio background"
                  checked={settings.theme?.grain === true}
                  onToggle={() => update('theme.grain', !settings.theme?.grain)}
                />

                <ToggleCard
                  icon={<Icons.IconTarget size={16} />}
                  title="Header Accent Dot"
                  description="Displays accent dot next to active section header"
                  checked={settings.theme?.headerDot !== false}
                  onToggle={() => update('theme.headerDot', settings.theme?.headerDot === false)}
                />
              </div>
            </div>
          )}

          {activeSection === 'grid' && (
            <div className="settings-panel">
              <div className="settings-section-header">
                <h3>
                  <Icons.IconGrid size={18} /> Grid &amp; Layout Engine
                </h3>
                <p className="settings-section-sub">
                  Configure photography gallery column structures and thumbnail aspect ratios.
                </p>
              </div>

              <OptionGrid
                label="Layout Algorithm"
                options={LAYOUT_OPTIONS}
                value={settings.grid?.layout || 'masonry'}
                onSelect={(v) => update('grid.layout', v)}
                cardClassName="grid-layout-card"
                renderPreview={(o) => <LayoutPreview value={o.value} />}
              />

              <OptionGrid
                label="Aspect Ratio"
                options={ASPECT_RATIO_OPTIONS}
                value={settings.grid?.aspectRatio || '1'}
                onSelect={(v) => update('grid.aspectRatio', v)}
                cardClassName="ratio-card"
                renderPreview={(o) => <AspectRatioPreview value={o.value} />}
              />

              <div className="settings-section-divider" />

              <div className="settings-section-header">
                <h3>
                  <Icons.IconColumns size={18} /> Spacing &amp; Columns
                </h3>
                <p className="settings-section-sub">
                  Adjust column counts and grid gap spacing. The column count also tiles the album
                  covers on a subpage; their spacing stays with the theme unless a page overrides
                  it.
                </p>
              </div>

              <div className="admin-field-row">
                <div className="admin-field">
                  <label>
                    Columns ({PHOTO_GRID_COLUMNS_MIN} - {PHOTO_GRID_COLUMNS_MAX})
                  </label>
                  <input
                    type="number"
                    min={PHOTO_GRID_COLUMNS_MIN}
                    max={PHOTO_GRID_COLUMNS_MAX}
                    value={settings.grid?.columns ?? 3}
                    onChange={(e) => update('grid.columns', parseInt(e.target.value) || 3)}
                  />
                </div>
                <div className="admin-field">
                  <label>Gap Spacing (px)</label>
                  <input
                    type="number"
                    min={0}
                    max={PHOTO_GRID_GAP_MAX}
                    value={settings.grid?.gap ?? 12}
                    onChange={(e) => update('grid.gap', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'footer' && (
            <div className="settings-panel">
              <div className="settings-section-header">
                <h3>
                  <Icons.IconLink size={18} /> Footer &amp; Social Links
                </h3>
                <p className="settings-section-sub">
                  Display branding, Instagram, email and website links in portfolio footer.
                </p>
              </div>

              <div className="admin-field">
                <label>Footer Brand Name</label>
                <input
                  value={settings.footer?.name || ''}
                  onChange={(e) => update('footer.name', e.target.value)}
                  placeholder="My Photography"
                />
              </div>
              <div className="admin-field">
                <label>Instagram URL</label>
                <input
                  value={settings.footer?.instagram || ''}
                  onChange={(e) => update('footer.instagram', e.target.value)}
                  placeholder="https://instagram.com/your-handle"
                />
              </div>
              <div className="admin-field-row">
                <div className="admin-field">
                  <label>Contact Email</label>
                  <input
                    value={settings.footer?.email || ''}
                    onChange={(e) => update('footer.email', e.target.value)}
                    placeholder="hello@example.com"
                  />
                </div>
                <div className="admin-field">
                  <label>Personal Website</label>
                  <input
                    value={settings.footer?.website || ''}
                    onChange={(e) => update('footer.website', e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <div className="settings-section-header" style={{ marginTop: '2rem' }}>
                <h3>
                  <Icons.IconLink size={18} /> Header Navigation Links (Experimental)
                </h3>
                <p className="settings-section-sub">
                  External links shown after your pages in the header menu. Only http(s) URLs are
                  allowed; they open in a new tab.
                </p>
              </div>

              {(settings.navLinks || []).map((link, i) => (
                <div className="admin-field-row" key={i}>
                  <div className="admin-field">
                    <label>Label</label>
                    <input
                      value={link.label || ''}
                      onChange={(e) => {
                        const next = [...(settings.navLinks || [])];
                        next[i] = { ...next[i], label: e.target.value };
                        update('navLinks', next);
                      }}
                      placeholder="Shop"
                    />
                  </div>
                  <div className="admin-field">
                    <label>URL</label>
                    <input
                      value={link.url || ''}
                      onChange={(e) => {
                        const next = [...(settings.navLinks || [])];
                        next[i] = { ...next[i], url: e.target.value };
                        update('navLinks', next);
                      }}
                      placeholder="https://shop.example.com"
                    />
                  </div>
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm"
                    style={{ alignSelf: 'flex-end' }}
                    onClick={() => {
                      const next = (settings.navLinks || []).filter((_, j) => j !== i);
                      update('navLinks', next.length > 0 ? next : undefined);
                    }}
                    title="Remove link"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="admin-btn admin-btn-sm"
                onClick={() =>
                  update('navLinks', [...(settings.navLinks || []), { label: '', url: '' }])
                }
              >
                + Add external link
              </button>
            </div>
          )}

          {activeSection === 'legal' && (
            <div className="settings-panel">
              <div className="settings-section-header">
                <h3>
                  <Icons.IconScale size={18} /> Legal Notice &amp; Impressum
                </h3>
                <p className="settings-section-sub">
                  Configure required legal disclosure page for EU / German Telemediengesetz
                  compliance.
                </p>
              </div>

              <div className="admin-toggle-cards-grid" style={{ marginBottom: '1.25rem' }}>
                <ToggleCard
                  icon={<Icons.IconFileText size={16} />}
                  title="Enable Impressum Page (/impressum)"
                  description="Automatically generates and links /impressum in footer"
                  checked={settings.legal?.enabled === true}
                  onToggle={() => update('legal.enabled', !settings.legal?.enabled)}
                />
              </div>

              {settings.legal?.enabled && (
                <>
                  <div className="admin-field-row">
                    <div className="admin-field">
                      <label>Full Name / Business Name</label>
                      <input
                        value={settings.legal?.name || ''}
                        onChange={(e) => update('legal.name', e.target.value)}
                        placeholder="Max Mustermann"
                      />
                    </div>
                    <div className="admin-field">
                      <label>Street Address</label>
                      <input
                        value={settings.legal?.address || ''}
                        onChange={(e) => update('legal.address', e.target.value)}
                        placeholder="Musterstraße 1"
                      />
                    </div>
                  </div>
                  <div className="admin-field-row">
                    <div className="admin-field">
                      <label>ZIP &amp; City</label>
                      <input
                        value={settings.legal?.zipCity || ''}
                        onChange={(e) => update('legal.zipCity', e.target.value)}
                        placeholder="12345 Berlin"
                      />
                    </div>
                    <div className="admin-field">
                      <label>Country</label>
                      <input
                        value={settings.legal?.country || ''}
                        onChange={(e) => update('legal.country', e.target.value)}
                        placeholder="Germany"
                      />
                    </div>
                  </div>
                  <div className="admin-field-row">
                    <div className="admin-field">
                      <label>Legal Email</label>
                      <input
                        value={settings.legal?.email || ''}
                        onChange={(e) => update('legal.email', e.target.value)}
                        placeholder="legal@example.com"
                      />
                    </div>
                    <div className="admin-field">
                      <label>Phone Number</label>
                      <input
                        value={settings.legal?.phone || ''}
                        onChange={(e) => update('legal.phone', e.target.value)}
                        placeholder="+49 123 456789"
                      />
                    </div>
                  </div>
                  <div className="admin-field">
                    <label>Additional Disclosures / Tax ID</label>
                    <textarea
                      value={settings.legal?.extraInfo || ''}
                      onChange={(e) => update('legal.extraInfo', e.target.value)}
                      placeholder="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV..."
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {activeSection === 'seo' && (
            <div className="settings-panel">
              <div className="settings-section-header">
                <h3>
                  <Icons.IconSearch size={18} /> Search Engine Optimization (SEO)
                </h3>
                <p className="settings-section-sub">
                  Customize search engine metadata, OpenGraph tags, and indexing rules.
                </p>
              </div>

              {/* Live Google Search Result Snippet Card */}
              <div className="google-snippet-preview">
                <div className="google-snippet-header">
                  <span>
                    <Icons.IconGlobe size={14} /> Google Search Result Preview
                  </span>
                </div>
                <div className="google-snippet-card">
                  <div className="google-snippet-url">
                    https://yourportfolio.com <span className="google-snippet-arrow">▼</span>
                  </div>
                  <div className="google-snippet-title">
                    {settings.seo?.title || settings.title || 'My Photography Portfolio'}
                  </div>
                  <div className="google-snippet-desc">
                    {settings.seo?.description ||
                      settings.subtitle ||
                      'A curated selection of photography work.'}
                  </div>
                </div>
              </div>

              <div className="admin-field">
                <label>Site URL</label>
                <input
                  value={settings.url || ''}
                  onChange={(e) => update('url', e.target.value)}
                  placeholder="https://folio.example"
                />
                <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '4px' }}>
                  Needed for <code>sitemap.xml</code>, the feed and structured data — those are
                  generated without a request, so the address cannot be derived from it. Leave empty
                  and the sitemap stays empty rather than guessing.
                  {siteUrlInfo?.source === 'env' && (
                    <>
                      <br />
                      Currently supplied by the <code>SITE_URL</code> environment variable (
                      <code>{siteUrlInfo.effective}</code>). A value entered here takes precedence
                      once saved.
                    </>
                  )}
                </p>
              </div>

              <div className="admin-field">
                <label>SEO Meta Title</label>
                <input
                  value={settings.seo?.title || ''}
                  onChange={(e) => update('seo.title', e.target.value)}
                  placeholder="Overrides default site title for Google search results"
                />
              </div>

              <div className="admin-field">
                <label>Subpage Title Template</label>
                <input
                  value={settings.seo?.titleTemplate || ''}
                  onChange={(e) => update('seo.titleTemplate', e.target.value)}
                  placeholder={`%s | ${settings.seo?.title || settings.title || 'My Portfolio'}`}
                />
                <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '4px' }}>
                  Template for subpages &amp; albums. Use <code>%s</code> as placeholder for the
                  page title.
                  <br />
                  <strong>Preview:</strong>{' '}
                  {(
                    settings.seo?.titleTemplate ||
                    `%s | ${settings.seo?.title || settings.title || 'My Portfolio'}`
                  ).replace('%s', 'Landscapes')}
                </p>
              </div>

              <div className="admin-field">
                <label>SEO Meta Description</label>
                <textarea
                  value={settings.seo?.description || ''}
                  onChange={(e) => update('seo.description', e.target.value)}
                  placeholder="A curated selection of photography work..."
                  rows={3}
                />
              </div>

              <div className="settings-section-divider" />

              <div className="settings-section-header">
                <h3>
                  <Icons.IconGlobe size={18} /> Search Crawler Directives
                </h3>
                <p className="settings-section-sub">
                  Control how Googlebot and other web crawlers index your site.
                </p>
              </div>

              <div className="admin-toggle-cards-grid">
                <ToggleCard
                  icon={<Icons.IconBan size={16} />}
                  title="noindex (Hide from Google)"
                  description="Instructs search engines NOT to index this site in search results"
                  checked={settings.seo?.noIndex === true}
                  onToggle={() => update('seo.noIndex', !settings.seo?.noIndex)}
                />

                <ToggleCard
                  icon={<Icons.IconLink size={16} />}
                  title="nofollow (Block Link Following)"
                  description="Instructs search engine crawlers not to follow outgoing links"
                  checked={settings.seo?.noFollow === true}
                  onToggle={() => update('seo.noFollow', !settings.seo?.noFollow)}
                />
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="settings-panel">
              <div className="settings-section-header">
                <h3>
                  <Icons.IconLock size={18} /> Site Password
                </h3>
                <p className="settings-section-sub">
                  Puts the whole public site behind one password — useful while a portfolio is still
                  being built, or for a folio only ever shown to clients.
                </p>
              </div>

              <div className="admin-field">
                <label>Site Password</label>
                <input
                  type="text"
                  value={settings.sitePassword || ''}
                  onChange={(e) => update('sitePassword', e.target.value)}
                  placeholder="Leave empty for a public site"
                  autoComplete="off"
                />
                <p className="admin-field-hint">
                  Stored in <code>settings.yaml</code>. Log in once and the server log prints a{' '}
                  <code>scrypt:…</code> hash to paste back here instead of the plaintext. The{' '}
                  <code>SITE_PASSWORD</code> environment variable overrides this field. The admin
                  panel keeps its own password and is never behind this gate.
                </p>
              </div>

              <div className="settings-section-divider" />

              <div className="settings-section-header">
                <h3>
                  <Icons.IconShieldCheck size={18} /> Asset Protection &amp; Watermark
                </h3>
                <p className="settings-section-sub">
                  Configure image protection rules, right-click prevention, and watermark overlay.
                </p>
              </div>

              <div className="admin-toggle-cards-grid">
                <ToggleCard
                  icon={<Icons.IconLock size={16} />}
                  title="Disable Right-Click Menu"
                  description="Prevents context menu on portfolio images to hinder unauthorized downloads"
                  checked={settings.protection?.disableRightClick === true}
                  onToggle={() =>
                    update('protection.disableRightClick', !settings.protection?.disableRightClick)
                  }
                />

                <ToggleCard
                  icon={<Icons.IconBan size={16} />}
                  title="Disable Image Dragging"
                  description="Prevents visitors from dragging images off the portfolio page"
                  checked={settings.protection?.disableImageDrag === true}
                  onToggle={() =>
                    update('protection.disableImageDrag', !settings.protection?.disableImageDrag)
                  }
                />
              </div>

              <div className="settings-section-divider" />

              <div className="settings-section-header">
                <h3>
                  <Icons.IconSparkles size={18} /> Dynamic Watermark Overlay
                </h3>
                <p className="settings-section-sub">
                  Overlay copyright branding text on Lightbox images.
                </p>
              </div>

              <div className="admin-toggle-cards-grid" style={{ marginBottom: '1.25rem' }}>
                <ToggleCard
                  icon={<Icons.IconFrame size={16} />}
                  title="Enable Watermark"
                  description="Overlay copyright text on portfolio image views"
                  checked={settings.watermark?.enabled === true}
                  onToggle={() => update('watermark.enabled', !settings.watermark?.enabled)}
                />
              </div>

              {settings.watermark?.enabled && (
                <>
                  <div className="admin-field">
                    <label>Watermark Text</label>
                    <input
                      value={settings.watermark?.text || ''}
                      onChange={(e) => update('watermark.text', e.target.value)}
                      placeholder="© Ralfo Photography"
                    />
                  </div>

                  <div className="admin-field-row">
                    <div className="admin-field">
                      <label>Position</label>
                      <select
                        value={settings.watermark?.position || 'bottom-right'}
                        onChange={(e) => update('watermark.position', e.target.value)}
                      >
                        <option value="bottom-right">Bottom Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="center">Center Overlay</option>
                      </select>
                    </div>
                    <div className="admin-field">
                      {/* Read through the same normaliser the lightbox uses, so a
                          config written as a percentage shows as "90%" here rather
                          than "9000%" — and is written back as a fraction on save. */}
                      <label>
                        Opacity (
                        {Math.round(resolveWatermarkOpacity(settings.watermark?.opacity) * 100)}
                        %)
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={resolveWatermarkOpacity(settings.watermark?.opacity)}
                        onChange={(e) => update('watermark.opacity', parseFloat(e.target.value))}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeSection === 'about' && (
            <div className="settings-panel">
              <div className="settings-section-header">
                <h3>
                  <Icons.IconCamera size={18} /> About Page
                </h3>
                <p className="settings-section-sub">
                  Edit the portrait, biography and gear shown on the About page. Use General to show
                  or hide the page itself.
                </p>
              </div>

              {aboutLoading ? (
                <div className="admin-spinner" style={{ margin: '2rem auto' }} />
              ) : (
                <>
                  <div className="admin-field">
                    <label>Portrait Asset ID</label>
                    <input
                      value={aboutMeta.portrait || ''}
                      onChange={(e) => updateAboutMeta('portrait', e.target.value)}
                      placeholder="Immich asset UUID for the portrait photo"
                    />
                  </div>
                  <div className="admin-field">
                    <label>Name</label>
                    <input
                      value={aboutMeta.name || ''}
                      onChange={(e) => updateAboutMeta('name', e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="admin-field">
                    <label>Location</label>
                    <input
                      value={aboutMeta.location || ''}
                      onChange={(e) => updateAboutMeta('location', e.target.value)}
                      placeholder="City, Country"
                    />
                  </div>
                  <div className="admin-field">
                    <label>Gear (one per line)</label>
                    <textarea
                      value={aboutGearText}
                      onChange={(e) => {
                        setAboutGearText(e.target.value);
                        setAboutDirty(true);
                        setAboutMessage('');
                      }}
                      placeholder={`Leica Q3\nSummilux 35mm f/1.4`}
                      rows={4}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Biography (Markdown)</label>
                    <textarea
                      value={aboutBody}
                      onChange={(e) => {
                        setAboutBody(e.target.value);
                        setAboutDirty(true);
                        setAboutMessage('');
                      }}
                      placeholder="Photographer based in..."
                      rows={6}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
