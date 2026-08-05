'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Settings {
  title?: string;
  subtitle?: string;
  lang?: string;
  exifOnHover?: boolean;
  map?: boolean;
  transitions?: boolean;
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
    noIndex?: boolean;
    noFollow?: boolean;
  };
}

const PRESETS = ['studio', 'minimal', 'editorial', 'classic', 'noir', 'monograph'];
const LAYOUTS = ['masonry', 'uniform', 'showcase', 'filmstrip', 'editorial-flow'];
const PHOTO_FRAMES = ['none', 'passepartout', 'shadow'];
const HERO_STYLES = ['split', 'fullbleed', 'minimal', 'stacked', 'typographic', 'mosaic'];
const ASPECT_RATIOS = ['1', '3/2', '2/3', '16/9', 'auto'];

const THEME_INFO: Record<string, { desc: string; label: string; accent: string; bg: string; tile: string }> = {
  studio: {
    label: 'Studio',
    desc: 'Clean, high-contrast grid with sans-serif type.',
    bg: '#141414',
    tile: '#242424',
    accent: '#e60012',
  },
  minimal: {
    label: 'Minimal',
    desc: 'Pure raw layouts with tiny gaps and high whitespace.',
    bg: '#ffffff',
    tile: '#f3f3f3',
    accent: '#111111',
  },
  editorial: {
    label: 'Editorial',
    desc: 'Warm backgrounds, elegant serifs and large headers.',
    bg: '#fbf9f4',
    tile: '#e5dfd4',
    accent: '#b89053',
  },
  classic: {
    label: 'Classic',
    desc: 'Soft traditional photographer portfolio with shadows.',
    bg: '#f7f7f7',
    tile: '#ffffff',
    accent: '#444444',
  },
  noir: {
    label: 'Noir',
    desc: 'High drama absolute pitch black, stark high-fashion look.',
    bg: '#000000',
    tile: '#151515',
    accent: '#ffffff',
  },
  monograph: {
    label: 'Monograph',
    desc: 'Typewriter monospace font, grid borders and document feel.',
    bg: '#f4f4f6',
    tile: '#ffffff',
    accent: '#555555',
  },
};

export default function SettingsEditor() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [activeSection, setActiveSection] = useState('general');
  const [currentMode, setCurrentMode] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    loadSettings();
    if (typeof window !== 'undefined') {
      const mode = (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark';
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

  const toggleMode = (mode: 'dark' | 'light') => {
    setCurrentMode(mode);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', mode);
      localStorage.setItem('theme', mode);
    }
  };

  // ── Keyboard shortcut: ⌘+S / Ctrl+S ─────────────────────────
  const handleSaveRef = useCallback(() => {
    if (dirty && !saving) {
      handleSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving, settings]);

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

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
      </div>
    );
  }

  const sections = [
    { id: 'general', label: 'General' },
    { id: 'theme', label: 'Theme' },
    { id: 'grid', label: 'Grid' },
    { id: 'footer', label: 'Footer' },
    { id: 'legal', label: 'Legal' },
    { id: 'seo', label: 'SEO' },
  ];

  return (
    <div className="settings-editor">
      {/* Save Bar */}
      <div className={`save-bar ${dirty ? 'dirty' : ''}`}>
        <div className="save-bar-left">
          {dirty && <span className="unsaved-badge">Unsaved changes</span>}
          {saveMessage && (
            <span
              className={`save-message ${saveMessage.startsWith('Error') ? 'error' : 'success'}`}
            >
              {saveMessage}
            </span>
          )}
        </div>
        <button
          className="admin-btn admin-btn-primary"
          onClick={handleSave}
          disabled={!dirty || saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="settings-layout">
        {/* Sidebar */}
        <nav className="settings-nav">
          {sections.map((sec) => (
            <button
              key={sec.id}
              className={`settings-nav-item ${activeSection === sec.id ? 'active' : ''}`}
              onClick={() => setActiveSection(sec.id)}
            >
              {sec.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="settings-content">
          {activeSection === 'general' && (
            <div className="settings-panel">
              <h3>General</h3>
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
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                  <option value="fr">Français</option>
                  <option value="es">Español</option>
                  <option value="ja">日本語</option>
                </select>
              </div>
              <div className="admin-field-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.exifOnHover !== false}
                    onChange={(e) => update('exifOnHover', e.target.checked)}
                  />
                  EXIF on Hover
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.map === true}
                    onChange={(e) => update('map', e.target.checked)}
                  />
                  Map enabled
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.transitions !== false}
                    onChange={(e) => update('transitions', e.target.checked)}
                  />
                  Page Transitions
                </label>
              </div>
            </div>
          )}

          {activeSection === 'theme' && (
            <div className="settings-panel">
              <h3>Theme</h3>
              <div className="admin-field">
                <label>Preset</label>
                <div className="preset-card-grid">
                  {PRESETS.map((p) => {
                    const info = THEME_INFO[p] || { label: p, desc: '', bg: '#fff', tile: '#eee', accent: '#333' };
                    const isActive = (settings.theme?.preset || 'studio') === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        className={`preset-card ${isActive ? 'active' : ''}`}
                        onClick={() => update('theme.preset', p)}
                        style={{ '--preset-accent': info.accent } as React.CSSProperties}
                      >
                        <div className="preset-card-preview" style={{ backgroundColor: info.bg }}>
                          <div className="mini-header">
                            <span className="mini-dot" style={{ backgroundColor: info.accent }}></span>
                            <span className="mini-line" style={{ backgroundColor: isActive ? info.accent : 'var(--admin-border)' }}></span>
                          </div>
                          <div className="mini-grid">
                            <div className="mini-tile" style={{ backgroundColor: info.tile }}></div>
                            <div className="mini-tile" style={{ backgroundColor: info.tile }}></div>
                            <div className="mini-tile" style={{ backgroundColor: info.tile }}></div>
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
                <label>Color Mode (Light / Dark Preview)</label>
                <p style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)', margin: '0.25rem 0 0.6rem', lineHeight: '1.4' }}>
                  Theme presets like <strong>Editorial</strong>, <strong>Minimal</strong> &amp; <strong>Classic</strong> feature warm light/cream backgrounds (e.g. <code>#faf8f4</code>) in Light Mode and charcoal in Dark Mode.
                </p>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="themeMode"
                      checked={currentMode === 'light'}
                      onChange={() => toggleMode('light')}
                    />
                    ☀️ Light Mode (Cream / Beige)
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="themeMode"
                      checked={currentMode === 'dark'}
                      onChange={() => toggleMode('dark')}
                    />
                    🌙 Dark Mode (Charcoal)
                  </label>
                </div>
              </div>
              <div className="admin-field">
                <label>Accent Color</label>
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
              <div className="admin-field">
                <label>Photo Frame</label>
                <div className="preset-card-grid">
                  {PHOTO_FRAMES.map((f) => {
                    const info = {
                      none: { label: 'None', desc: 'Flush image with crisp edges' },
                      passepartout: { label: 'Passepartout', desc: 'Classic gallery matting border' },
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
              <div className="admin-field-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.theme?.grain === true}
                    onChange={(e) => update('theme.grain', e.target.checked)}
                  />
                  Film Grain
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.theme?.headerDot !== false}
                    onChange={(e) => update('theme.headerDot', e.target.checked)}
                  />
                  Header Dot
                </label>
              </div>
            </div>
          )}

          {activeSection === 'grid' && (
            <div className="settings-panel">
              <h3>Grid Layout</h3>
              <div className="admin-field">
                <label>Layout</label>
                <div className="preset-grid">
                  {LAYOUTS.map((l) => (
                    <button
                      key={l}
                      className={`preset-btn ${(settings.grid?.layout || 'masonry') === l ? 'active' : ''}`}
                      onClick={() => update('grid.layout', l)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="admin-field-row">
                <div className="admin-field">
                  <label>Columns</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={settings.grid?.columns ?? 3}
                    onChange={(e) => update('grid.columns', parseInt(e.target.value) || 3)}
                  />
                </div>
                <div className="admin-field">
                  <label>Gap (px)</label>
                  <input
                    type="number"
                    min={0}
                    max={48}
                    value={settings.grid?.gap ?? 12}
                    onChange={(e) => update('grid.gap', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="admin-field">
                <label>Aspect Ratio</label>
                <div className="preset-grid">
                  {ASPECT_RATIOS.map((r) => (
                    <button
                      key={r}
                      className={`preset-btn ${(settings.grid?.aspectRatio || '1') === r ? 'active' : ''}`}
                      onClick={() => update('grid.aspectRatio', r)}
                    >
                      {r === '1' ? 'Square' : r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'footer' && (
            <div className="settings-panel">
              <h3>Footer</h3>
              <div className="admin-field">
                <label>Name</label>
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
              <div className="admin-field">
                <label>Email</label>
                <input
                  value={settings.footer?.email || ''}
                  onChange={(e) => update('footer.email', e.target.value)}
                  placeholder="hello@example.com"
                />
              </div>
              <div className="admin-field">
                <label>Website</label>
                <input
                  value={settings.footer?.website || ''}
                  onChange={(e) => update('footer.website', e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
            </div>
          )}

          {activeSection === 'legal' && (
            <div className="settings-panel">
              <h3>Legal / Impressum</h3>
              <div className="admin-field-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.legal?.enabled === true}
                    onChange={(e) => update('legal.enabled', e.target.checked)}
                  />
                  Enable Impressum page
                </label>
              </div>
              {settings.legal?.enabled && (
                <>
                  <div className="admin-field">
                    <label>Full Name</label>
                    <input
                      value={settings.legal?.name || ''}
                      onChange={(e) => update('legal.name', e.target.value)}
                      placeholder="Max Mustermann"
                    />
                  </div>
                  <div className="admin-field">
                    <label>Address</label>
                    <input
                      value={settings.legal?.address || ''}
                      onChange={(e) => update('legal.address', e.target.value)}
                      placeholder="Musterstraße 1"
                    />
                  </div>
                  <div className="admin-field-row">
                    <div className="admin-field">
                      <label>ZIP & City</label>
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
                      <label>Email</label>
                      <input
                        value={settings.legal?.email || ''}
                        onChange={(e) => update('legal.email', e.target.value)}
                        placeholder="legal@example.com"
                      />
                    </div>
                    <div className="admin-field">
                      <label>Phone</label>
                      <input
                        value={settings.legal?.phone || ''}
                        onChange={(e) => update('legal.phone', e.target.value)}
                        placeholder="+49 123 456789"
                      />
                    </div>
                  </div>
                  <div className="admin-field">
                    <label>Extra Info</label>
                    <textarea
                      value={settings.legal?.extraInfo || ''}
                      onChange={(e) => update('legal.extraInfo', e.target.value)}
                      placeholder="Verantwortlich für den Inhalt..."
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {activeSection === 'seo' && (
            <div className="settings-panel">
              <h3>SEO & Metadata</h3>
              <div className="admin-field">
                <label>SEO Title</label>
                <input
                  value={settings.seo?.title || ''}
                  onChange={(e) => update('seo.title', e.target.value)}
                  placeholder="Overrides site title for search engines"
                />
              </div>
              <div className="admin-field">
                <label>SEO Description</label>
                <textarea
                  value={settings.seo?.description || ''}
                  onChange={(e) => update('seo.description', e.target.value)}
                  placeholder="A curated selection of photography work."
                  rows={3}
                />
              </div>
              <div className="admin-field-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.seo?.noIndex === true}
                    onChange={(e) => update('seo.noIndex', e.target.checked)}
                  />
                  noindex (hide from search engines)
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.seo?.noFollow === true}
                    onChange={(e) => update('seo.noFollow', e.target.checked)}
                  />
                  nofollow (don&apos;t follow links)
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
