'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as Icons from './Icons';
import SaveBar from './SaveBar';

interface Settings {
  title?: string;
  subtitle?: string;
  lang?: string;
  exifOnHover?: boolean;
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

const PRESETS = ['studio', 'studio-modern', 'minimal', 'editorial', 'classic', 'noir', 'monograph'];
const LAYOUTS = ['masonry', 'uniform', 'showcase', 'filmstrip', 'editorial-flow', 'justified'];
const PHOTO_FRAMES = ['none', 'passepartout', 'shadow'];
const HERO_STYLES = ['split', 'fullbleed', 'minimal', 'stacked', 'typographic', 'mosaic', 'cover'];
const ASPECT_RATIOS = ['1', '3/2', '2/3', '16/9', 'auto'];

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

export default function SettingsEditor({ section }: SettingsEditorProps) {
  const router = useRouter();
  // An unknown section in the URL falls back to General instead of an empty panel.
  const activeSection = SETTINGS_SECTIONS.some((sec) => sec.id === section)
    ? (section as string)
    : 'general';
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
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

  // ── Unsaved changes guard ────────────────────────────────────
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const { settings: data } = await res.json();
        setSettings(data || {});
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
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

              <div className="admin-toggle-cards-grid">
                <button
                  type="button"
                  className={`admin-toggle-card ${settings.exifOnHover !== false ? 'active' : ''}`}
                  onClick={() => update('exifOnHover', settings.exifOnHover === false)}
                >
                  <div className="toggle-card-info">
                    <span className="toggle-card-title">
                      <Icons.IconCamera size={16} /> EXIF Data on Hover
                    </span>
                    <span className="toggle-card-desc">
                      Display camera gear, lens, aperture &amp; shutter speed on hover
                    </span>
                  </div>
                  <div className={`switch-toggle ${settings.exifOnHover !== false ? 'on' : ''}`}>
                    <span className="switch-slider" />
                  </div>
                </button>

                <button
                  type="button"
                  className={`admin-toggle-card ${settings.map === true ? 'active' : ''}`}
                  onClick={() => update('map', !settings.map)}
                >
                  <div className="toggle-card-info">
                    <span className="toggle-card-title">
                      <Icons.IconMap size={16} /> Interactive GPS Map
                    </span>
                    <span className="toggle-card-desc">
                      Enable /map view showing photo locations on a world map
                    </span>
                  </div>
                  <div className={`switch-toggle ${settings.map === true ? 'on' : ''}`}>
                    <span className="switch-slider" />
                  </div>
                </button>

                <button
                  type="button"
                  className={`admin-toggle-card ${settings.transitions !== false ? 'active' : ''}`}
                  onClick={() => update('transitions', settings.transitions === false)}
                >
                  <div className="toggle-card-info">
                    <span className="toggle-card-title">
                      <Icons.IconSparkles size={16} /> Smooth Page Transitions
                    </span>
                    <span className="toggle-card-desc">
                      Enable subtle fade-in animations between page navigation
                    </span>
                  </div>
                  <div className={`switch-toggle ${settings.transitions !== false ? 'on' : ''}`}>
                    <span className="switch-slider" />
                  </div>
                </button>

                <button
                  type="button"
                  className={`admin-toggle-card ${settings.scrollToTop !== false ? 'active' : ''}`}
                  onClick={() => update('scrollToTop', settings.scrollToTop === false)}
                >
                  <div className="toggle-card-info">
                    <span className="toggle-card-title">
                      <Icons.IconArrowUp size={16} /> Scroll-to-Top Button
                    </span>
                    <span className="toggle-card-desc">
                      Show a floating arrow that returns visitors to the top of long pages
                    </span>
                  </div>
                  <div className={`switch-toggle ${settings.scrollToTop !== false ? 'on' : ''}`}>
                    <span className="switch-slider" />
                  </div>
                </button>

                <button
                  type="button"
                  className={`admin-toggle-card ${settings.analytics !== false ? 'active' : ''}`}
                  onClick={() => update('analytics', settings.analytics === false)}
                >
                  <div className="toggle-card-info">
                    <span className="toggle-card-title">
                      <Icons.IconBarChart size={16} /> Analytics Tracking
                    </span>
                    <span className="toggle-card-desc">
                      Collect anonymous privacy-friendly visit statistics
                    </span>
                  </div>
                  <div className={`switch-toggle ${settings.analytics !== false ? 'on' : ''}`}>
                    <span className="switch-slider" />
                  </div>
                </button>

                <button
                  type="button"
                  className={`admin-toggle-card ${settings.proofing?.enabled !== false ? 'active' : ''}`}
                  onClick={() => update('proofing.enabled', settings.proofing?.enabled === false)}
                >
                  <div className="toggle-card-info">
                    <span className="toggle-card-title">
                      <Icons.IconHeart size={16} /> Client Proofing &amp; Favorites
                    </span>
                    <span className="toggle-card-desc">
                      Allow visitors &amp; clients to heart, filter, and export favorite photo
                      selections
                    </span>
                  </div>
                  <div
                    className={`switch-toggle ${settings.proofing?.enabled !== false ? 'on' : ''}`}
                  >
                    <span className="switch-slider" />
                  </div>
                </button>

                <button
                  type="button"
                  className={`admin-toggle-card ${settings.about?.enabled !== false ? 'active' : ''}`}
                  onClick={() => update('about.enabled', settings.about?.enabled === false)}
                >
                  <div className="toggle-card-info">
                    <span className="toggle-card-title">
                      <Icons.IconCamera size={16} /> About Page
                    </span>
                    <span className="toggle-card-desc">
                      Show a portrait, bio, and gear section on your portfolio
                    </span>
                  </div>
                  <div className={`switch-toggle ${settings.about?.enabled !== false ? 'on' : ''}`}>
                    <span className="switch-slider" />
                  </div>
                </button>
              </div>

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
                <label>Preset</label>
                <div className="preset-card-grid">
                  {PRESETS.map((p) => {
                    const info = THEME_INFO[p] || {
                      label: p,
                      desc: '',
                      bg: '#fff',
                      tile: '#eee',
                      accent: '#333',
                      font: 'System',
                      type: 'sans' as const,
                      radius: 0,
                      frame: 'none' as const,
                      gap: 4,
                    };
                    const isActive = (settings.theme?.preset || 'studio') === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        className={`preset-card theme-preset-card ${isActive ? 'active' : ''}`}
                        onClick={() => update('theme.preset', p)}
                        style={
                          {
                            '--preset-accent': info.accent,
                            '--preset-bg': info.bg,
                            '--preset-tile': info.tile,
                            '--preset-radius': `${info.radius}px`,
                            '--preset-gap': `${info.gap}px`,
                          } as React.CSSProperties
                        }
                      >
                        <div className="preset-card-preview" data-frame={info.frame}>
                          <div className="mini-header">
                            <span className={`mini-specimen type-${info.type}`}>Aa</span>
                            <span className="mini-line" />
                          </div>
                          <div className="mini-grid">
                            <div className="mini-tile" />
                            <div className="mini-tile" />
                            <div className="mini-tile" />
                          </div>
                        </div>
                        <div className="preset-card-info">
                          <span className="preset-card-name">{info.label}</span>
                          <span className="preset-card-desc">{info.desc}</span>
                          <span className="preset-card-specs">
                            {info.font} &middot; radius {info.radius} &middot; {info.frame}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

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

              <div className="admin-field">
                <label>Photo Frame</label>
                <div className="preset-card-grid">
                  {PHOTO_FRAMES.map((f) => {
                    const info = {
                      none: { label: 'None', desc: 'Flush image with crisp edges' },
                      passepartout: {
                        label: 'Passepartout',
                        desc: 'Classic gallery matting border',
                      },
                      shadow: { label: 'Shadow', desc: 'Soft floating drop shadow' },
                    }[f] || { label: f, desc: '' };
                    const isActive = (settings.theme?.photoFrame || 'none') === f;

                    return (
                      <button
                        key={f}
                        type="button"
                        className={`preset-card frame-card ${isActive ? 'active' : ''}`}
                        onClick={() => update('theme.photoFrame', f)}
                      >
                        <div className="frame-card-preview">
                          <div className={`mini-frame-demo frame-${f}`}>
                            <div className="mini-frame-photo" />
                          </div>
                        </div>
                        <div className="preset-card-info">
                          <span className="preset-card-name">{info.label}</span>
                          <span className="preset-card-desc">{info.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="admin-field">
                <label>Hero Style</label>
                <div className="preset-card-grid">
                  {HERO_STYLES.map((s) => {
                    const info = {
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
                    }[s] || { label: s, desc: '' };
                    const isActive = (settings.theme?.heroStyle || 'split') === s;

                    return (
                      <button
                        key={s}
                        type="button"
                        className={`preset-card hero-card ${isActive ? 'active' : ''}`}
                        onClick={() => update('theme.heroStyle', s)}
                      >
                        <div className="hero-card-preview">
                          <div className={`mini-hero-demo hero-demo-${s}`}>
                            {s === 'split' && (
                              <>
                                <div className="hero-demo-text">
                                  <div className="demo-line title" />
                                  <div className="demo-line sub" />
                                </div>
                                <div className="hero-demo-photo" />
                              </>
                            )}
                            {s === 'fullbleed' && (
                              <div className="hero-demo-full">
                                <div className="demo-line title light" />
                              </div>
                            )}
                            {s === 'minimal' && (
                              <>
                                <div className="hero-demo-center-text">
                                  <div className="demo-line title short" />
                                </div>
                                <div className="hero-demo-photo small" />
                              </>
                            )}
                            {s === 'stacked' && (
                              <>
                                <div className="hero-demo-text">
                                  <div className="demo-line title" />
                                </div>
                                <div className="hero-demo-photo banner" />
                              </>
                            )}
                            {s === 'typographic' && (
                              <>
                                <div className="demo-line title giant" />
                                <div className="hero-demo-grid2">
                                  <div className="hero-demo-photo" />
                                  <div className="hero-demo-photo" />
                                </div>
                              </>
                            )}
                            {s === 'mosaic' && (
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
                        <div className="preset-card-info">
                          <span className="preset-card-name">{info.label}</span>
                          <span className="preset-card-desc">{info.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

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
                <button
                  type="button"
                  className={`admin-toggle-card ${settings.theme?.grain === true ? 'active' : ''}`}
                  onClick={() => update('theme.grain', !settings.theme?.grain)}
                >
                  <div className="toggle-card-info">
                    <span className="toggle-card-title">
                      <Icons.IconFilm size={16} /> Film Grain Texture
                    </span>
                    <span className="toggle-card-desc">
                      Adds analog noise overlay across portfolio background
                    </span>
                  </div>
                  <div className={`switch-toggle ${settings.theme?.grain === true ? 'on' : ''}`}>
                    <span className="switch-slider" />
                  </div>
                </button>

                <button
                  type="button"
                  className={`admin-toggle-card ${settings.theme?.headerDot !== false ? 'active' : ''}`}
                  onClick={() => update('theme.headerDot', settings.theme?.headerDot === false)}
                >
                  <div className="toggle-card-info">
                    <span className="toggle-card-title">
                      <Icons.IconTarget size={16} /> Header Accent Dot
                    </span>
                    <span className="toggle-card-desc">
                      Displays accent dot next to active section header
                    </span>
                  </div>
                  <div
                    className={`switch-toggle ${settings.theme?.headerDot !== false ? 'on' : ''}`}
                  >
                    <span className="switch-slider" />
                  </div>
                </button>
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

              <div className="admin-field">
                <label>Layout Algorithm</label>
                <div className="preset-card-grid">
                  {LAYOUTS.map((l) => {
                    const info = {
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
                    }[l] || { label: l, desc: '' };
                    const isActive = (settings.grid?.layout || 'masonry') === l;

                    return (
                      <button
                        key={l}
                        type="button"
                        className={`preset-card grid-layout-card ${isActive ? 'active' : ''}`}
                        onClick={() => update('grid.layout', l)}
                      >
                        <div className="grid-card-preview">
                          <div className={`mini-layout-demo layout-demo-${l}`}>
                            {l === 'masonry' && (
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
                            {l === 'uniform' && (
                              <div className="demo-uniform-grid">
                                <div className="demo-tile" />
                                <div className="demo-tile" />
                                <div className="demo-tile" />
                                <div className="demo-tile" />
                                <div className="demo-tile" />
                                <div className="demo-tile" />
                              </div>
                            )}
                            {l === 'showcase' && (
                              <div className="demo-showcase-grid">
                                <div className="demo-tile demo-hero" />
                                <div className="demo-col">
                                  <div className="demo-tile" />
                                  <div className="demo-tile" />
                                </div>
                              </div>
                            )}
                            {l === 'filmstrip' && (
                              <div className="demo-filmstrip-row">
                                <div className="demo-tile strip" />
                                <div className="demo-tile strip" />
                                <div className="demo-tile strip" />
                              </div>
                            )}
                            {l === 'editorial-flow' && (
                              <div className="demo-editorial-flow">
                                <div className="demo-tile wide" />
                                <div className="demo-row">
                                  <div className="demo-tile" />
                                  <div className="demo-tile" />
                                </div>
                              </div>
                            )}
                            {l === 'justified' && (
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
                        <div className="preset-card-info">
                          <span className="preset-card-name">{info.label}</span>
                          <span className="preset-card-desc">{info.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="admin-field">
                <label>Aspect Ratio</label>
                <div className="preset-card-grid">
                  {ASPECT_RATIOS.map((r) => {
                    const info = {
                      '1': { label: 'Square (1:1)', desc: '1:1 ratio square crops' },
                      '3/2': { label: 'Landscape (3:2)', desc: 'Standard 35mm DSLR landscape' },
                      '2/3': { label: 'Portrait (2:3)', desc: 'Vertical portrait orientation' },
                      '16/9': { label: 'Cinema (16:9)', desc: 'Widescreen 16:9 cinematic ratio' },
                      auto: {
                        label: 'Original Auto',
                        desc: 'Uncropped original image proportions',
                      },
                    }[r] || { label: r, desc: '' };
                    const isActive = (settings.grid?.aspectRatio || '1') === r;

                    return (
                      <button
                        key={r}
                        type="button"
                        className={`preset-card ratio-card ${isActive ? 'active' : ''}`}
                        onClick={() => update('grid.aspectRatio', r)}
                      >
                        <div className="ratio-card-preview">
                          <div className={`mini-aspect-box ratio-${r.replace('/', '-')}`}>
                            <div className="mini-aspect-inner" />
                          </div>
                        </div>
                        <div className="preset-card-info">
                          <span className="preset-card-name">{info.label}</span>
                          <span className="preset-card-desc">{info.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="settings-section-divider" />

              <div className="settings-section-header">
                <h3>
                  <Icons.IconColumns size={18} /> Spacing &amp; Columns
                </h3>
                <p className="settings-section-sub">Adjust column counts and grid gap spacing.</p>
              </div>

              <div className="admin-field-row">
                <div className="admin-field">
                  <label>Columns (1 - 6)</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={settings.grid?.columns ?? 3}
                    onChange={(e) => update('grid.columns', parseInt(e.target.value) || 3)}
                  />
                </div>
                <div className="admin-field">
                  <label>Gap Spacing (px)</label>
                  <input
                    type="number"
                    min={0}
                    max={48}
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
                <button
                  type="button"
                  className={`admin-toggle-card ${settings.legal?.enabled === true ? 'active' : ''}`}
                  onClick={() => update('legal.enabled', !settings.legal?.enabled)}
                >
                  <div className="toggle-card-info">
                    <span className="toggle-card-title">
                      <Icons.IconFileText size={16} /> Enable Impressum Page (/impressum)
                    </span>
                    <span className="toggle-card-desc">
                      Automatically generates and links /impressum in footer
                    </span>
                  </div>
                  <div className={`switch-toggle ${settings.legal?.enabled === true ? 'on' : ''}`}>
                    <span className="switch-slider" />
                  </div>
                </button>
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
                <button
                  type="button"
                  className={`admin-toggle-card ${settings.seo?.noIndex === true ? 'active' : ''}`}
                  onClick={() => update('seo.noIndex', !settings.seo?.noIndex)}
                >
                  <div className="toggle-card-info">
                    <span className="toggle-card-title">
                      <Icons.IconBan size={16} /> noindex (Hide from Google)
                    </span>
                    <span className="toggle-card-desc">
                      Instructs search engines NOT to index this site in search results
                    </span>
                  </div>
                  <div className={`switch-toggle ${settings.seo?.noIndex === true ? 'on' : ''}`}>
                    <span className="switch-slider" />
                  </div>
                </button>

                <button
                  type="button"
                  className={`admin-toggle-card ${settings.seo?.noFollow === true ? 'active' : ''}`}
                  onClick={() => update('seo.noFollow', !settings.seo?.noFollow)}
                >
                  <div className="toggle-card-info">
                    <span className="toggle-card-title">
                      <Icons.IconLink size={16} /> nofollow (Block Link Following)
                    </span>
                    <span className="toggle-card-desc">
                      Instructs search engine crawlers not to follow outgoing links
                    </span>
                  </div>
                  <div className={`switch-toggle ${settings.seo?.noFollow === true ? 'on' : ''}`}>
                    <span className="switch-slider" />
                  </div>
                </button>
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="settings-panel">
              <div className="settings-section-header">
                <h3>
                  <Icons.IconShieldCheck size={18} /> Asset Protection &amp; Watermark
                </h3>
                <p className="settings-section-sub">
                  Configure image protection rules, right-click prevention, and watermark overlay.
                </p>
              </div>

              <div className="admin-toggle-cards-grid">
                <button
                  type="button"
                  className={`admin-toggle-card ${settings.protection?.disableRightClick === true ? 'active' : ''}`}
                  onClick={() =>
                    update('protection.disableRightClick', !settings.protection?.disableRightClick)
                  }
                >
                  <div className="toggle-card-info">
                    <span className="toggle-card-title">
                      <Icons.IconLock size={16} /> Disable Right-Click Menu
                    </span>
                    <span className="toggle-card-desc">
                      Prevents context menu on portfolio images to hinder unauthorized downloads
                    </span>
                  </div>
                  <div
                    className={`switch-toggle ${settings.protection?.disableRightClick === true ? 'on' : ''}`}
                  >
                    <span className="switch-slider" />
                  </div>
                </button>

                <button
                  type="button"
                  className={`admin-toggle-card ${settings.protection?.disableImageDrag === true ? 'active' : ''}`}
                  onClick={() =>
                    update('protection.disableImageDrag', !settings.protection?.disableImageDrag)
                  }
                >
                  <div className="toggle-card-info">
                    <span className="toggle-card-title">
                      <Icons.IconBan size={16} /> Disable Image Dragging
                    </span>
                    <span className="toggle-card-desc">
                      Prevents visitors from dragging images off the portfolio page
                    </span>
                  </div>
                  <div
                    className={`switch-toggle ${settings.protection?.disableImageDrag === true ? 'on' : ''}`}
                  >
                    <span className="switch-slider" />
                  </div>
                </button>
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
                <button
                  type="button"
                  className={`admin-toggle-card ${settings.watermark?.enabled === true ? 'active' : ''}`}
                  onClick={() => update('watermark.enabled', !settings.watermark?.enabled)}
                >
                  <div className="toggle-card-info">
                    <span className="toggle-card-title">
                      <Icons.IconFrame size={16} /> Enable Watermark
                    </span>
                    <span className="toggle-card-desc">
                      Overlay copyright text on portfolio image views
                    </span>
                  </div>
                  <div
                    className={`switch-toggle ${settings.watermark?.enabled === true ? 'on' : ''}`}
                  >
                    <span className="switch-slider" />
                  </div>
                </button>
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
                      <label>
                        Opacity ({Math.round((settings.watermark?.opacity ?? 0.3) * 100)}%)
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="0.8"
                        step="0.05"
                        value={settings.watermark?.opacity ?? 0.3}
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
