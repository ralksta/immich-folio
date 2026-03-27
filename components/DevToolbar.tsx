/**
 * DevToolbar — floating visual builder for theme previewing.
 *
 * Only renders when NODE_ENV === 'development'.
 * Modifies data-* attributes on <html> to live-preview themes,
 * photo frames, dark/light mode, and grain without a rebuild.
 *
 * Hero styles and grid layouts require server re-render, so
 * those sections show a copyable YAML snippet instead.
 *
 * Layout: tabbed panel (Theme / Grid / Server) anchored bottom-right,
 * away from Next.js debug toolbar which sits bottom-left.
 */

'use client';

import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';

const PRESETS = ['studio', 'minimal', 'editorial', 'classic', 'noir', 'monograph'];
const FRAMES = ['none', 'passepartout', 'shadow'];
const HERO_STYLES = ['split', 'fullbleed', 'minimal', 'stacked', 'typographic', 'mosaic'];
const GRID_LAYOUTS = ['masonry', 'uniform', 'showcase', 'filmstrip', 'editorial-flow'];
const ASPECT_RATIOS = ['1', '3/2', '2/3', '4/3', '16/9', 'auto'];

type Tab = 'theme' | 'grid' | 'server';

// Font stacks for each preset (must match THEME_PRESETS in config.ts)
const PRESET_FONTS: Record<string, { heading: string; body: string; caption: string }> = {
  studio: { heading: 'Playfair Display', body: 'DM Sans', caption: 'EB Garamond' },
  minimal: { heading: 'Geist', body: 'Geist', caption: 'IBM Plex Mono' },
  editorial: { heading: 'Bodoni Moda', body: 'Newsreader', caption: 'Spectral' },
  classic: { heading: 'Cinzel', body: 'Crimson Pro', caption: 'Crimson Pro' },
  noir: { heading: 'Libre Baskerville', body: 'Source Sans 3', caption: 'Space Mono' },
  monograph: { heading: 'Instrument Serif', body: 'Inter', caption: 'IBM Plex Mono' },
};

const PRESET_ACCENTS: Record<string, string> = {
  studio: '#e60012',
  minimal: '#000000',
  editorial: '#8B2500',
  classic: '#c49a3c',
  noir: '#ff6b35',
  monograph: '#333333',
};

function getAttr(attr: string): string {
  return document.documentElement.getAttribute(attr) ?? '';
}

function setAttr(attr: string, value: string) {
  document.documentElement.setAttribute(attr, value);
}

function setVar(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

export function DevToolbar() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('theme');
  const [preset, setPreset] = useState('');
  const [frame, setFrame] = useState('');
  const [theme, setTheme] = useState('');
  const [grain, setGrain] = useState('');
  const [exifOnHover, setExifOnHover] = useState(true);
  const [copiedYaml, setCopiedYaml] = useState('');
  const [gridCols, setGridCols] = useState(3);
  const [gridGap, setGridGap] = useState(12);
  const [aspectRatio, setAspectRatio] = useState('1');
  const [gridLayout, setGridLayout] = useState('masonry');

  // Read initial values from DOM
  useLayoutEffect(() => {
    setPreset(getAttr('data-preset')); // eslint-disable-line react-hooks/set-state-in-effect
    setFrame(getAttr('data-photo-frame'));
    setTheme(getAttr('data-theme') || 'dark');
    setGrain(getAttr('data-grain'));
    // Read grid vars
    const style = getComputedStyle(document.documentElement);
    const cols = parseInt(style.getPropertyValue('--grid-columns') || '3', 10);
    const gap = parseInt(style.getPropertyValue('--grid-gap') || '12', 10);
    const ar = style.getPropertyValue('--grid-aspect-ratio').trim() || '1';
    const layout = getAttr('data-grid-layout') || 'masonry';
    if (!isNaN(cols)) setGridCols(cols);
    if (!isNaN(gap)) setGridGap(gap);
    setAspectRatio(ar);
    setGridLayout(layout);
  }, []);

  const switchPreset = useCallback((p: string) => {
    setAttr('data-preset', p);
    setPreset(p);
    // Update accent + fonts
    const accent = PRESET_ACCENTS[p] || '#e60012';
    setVar('--accent', accent);
    setVar('--accent-dim', `${accent}1f`);
    const fonts = PRESET_FONTS[p];
    if (fonts) {
      setVar('--font-serif', `'${fonts.heading}', Georgia, 'Times New Roman', serif`);
      setVar(
        '--font-sans',
        `'${fonts.body}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
      );
      setVar('--font-caption', `'${fonts.caption}', Georgia, serif`);
      // Dynamically load Google Fonts if not already loaded
      const families = [fonts.heading, fonts.body, fonts.caption]
        .filter((f, i, a) => a.indexOf(f) === i)
        .map(
          (f) => `family=${f.replace(/\s+/g, '+')}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400`,
        )
        .join('&');
      const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
      // Check if already loaded
      const existing = document.querySelector(`link[href="${href}"]`);
      if (!existing) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
      }
    }
  }, []);

  const switchFrame = useCallback((f: string) => {
    setAttr('data-photo-frame', f);
    setFrame(f);
  }, []);

  const switchTheme = useCallback((t: string) => {
    setAttr('data-theme', t);
    setTheme(t);
  }, []);

  const toggleGrain = useCallback(() => {
    const next = grain === 'true' ? 'false' : 'true';
    setAttr('data-grain', next);
    setGrain(next);
  }, [grain]);

  const updateGridCols = useCallback((cols: number) => {
    setGridCols(cols);
    // Update all photo-grid elements
    document.querySelectorAll<HTMLElement>('.photo-grid').forEach((el) => {
      el.style.setProperty('--grid-columns', String(cols));
    });
  }, []);

  const updateGridGap = useCallback((gap: number) => {
    setGridGap(gap);
    document.querySelectorAll<HTMLElement>('.photo-grid').forEach((el) => {
      el.style.setProperty('--grid-gap', `${gap}px`);
    });
  }, []);

  const updateAspectRatio = useCallback((ar: string) => {
    setAspectRatio(ar);
    document.querySelectorAll<HTMLElement>('.photo-grid').forEach((el) => {
      el.style.setProperty('--grid-aspect-ratio', ar);
    });
  }, []);

  const toggleExifOnHover = useCallback(() => {
    setExifOnHover((prev) => !prev);
  }, []);

  const copyYaml = useCallback((section: string, yaml: string) => {
    navigator.clipboard.writeText(yaml);
    setCopiedYaml(section);
    setTimeout(() => setCopiedYaml(''), 1500);
  }, []);

  const currentYaml = `theme:
  preset: "${preset}"
  photoFrame: "${frame}"
  grain: ${grain === 'true'}

grid:
  columns: ${gridCols}
  gap: ${gridGap}
  aspectRatio: "${aspectRatio}"
  layout: "${gridLayout}"

exifOnHover: ${exifOnHover}`;

  // Keyboard shortcut: Ctrl/Cmd + Shift + T
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      {/* ── Floating Toggle Button — bottom-left ── */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Dev Toolbar"
        style={{
          position: 'fixed',
          bottom: 20,
          left: 20,
          zIndex: 99999,
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.2)',
          background: 'rgba(24,24,27,0.95)',
          backdropFilter: 'blur(12px)',
          color: '#fff',
          fontSize: 18,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        {open ? '✕' : '🎨'}
      </button>

      {/* ── Panel — anchored bottom-left ────────── */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 76,
            left: 20,
            zIndex: 99998,
            width: 300,
            background: 'rgba(18,18,22,0.97)',
            backdropFilter: 'blur(20px)',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
            color: '#e4e4e7',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: 12,
            overflow: 'hidden',
          }}
        >
          {/* ── Header ──────────────────────────── */}
          <div
            style={{
              padding: '12px 16px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.02em' }}>
              🎨 Theme Builder
            </span>
            <span
              style={{
                fontSize: 10,
                color: '#71717a',
                background: 'rgba(255,255,255,0.06)',
                padding: '2px 8px',
                borderRadius: 6,
              }}
            >
              DEV ONLY
            </span>
          </div>

          {/* ── Tab Bar ─────────────────────────── */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              padding: '0 8px',
            }}
          >
            {(['theme', 'grid', 'server'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  background: 'none',
                  border: 'none',
                  borderBottom: tab === t ? '2px solid #e4e4e7' : '2px solid transparent',
                  color: tab === t ? '#fff' : '#52525b',
                  fontSize: 11,
                  fontWeight: tab === t ? 600 : 400,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  letterSpacing: '0.04em',
                  transition: 'all 0.15s ease',
                  marginBottom: -1,
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* ── Tab Content ──────────────────────── */}
          <div style={{ padding: '12px 16px' }}>
            {/* ── THEME TAB ── */}
            {tab === 'theme' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <Label>Preset</Label>
                  <PillGrid items={PRESETS} active={preset} onSelect={switchPreset} />
                </div>
                <div>
                  <Label>Mode</Label>
                  <PillGrid items={['dark', 'light']} active={theme} onSelect={switchTheme} />
                </div>
                <div>
                  <Label>Photo Frame</Label>
                  <PillGrid items={FRAMES} active={frame} onSelect={switchFrame} />
                </div>
                <div>
                  <Label>Film Grain</Label>
                  <ToggleButton on={grain === 'true'} onClick={toggleGrain} />
                </div>
                <div>
                  <Label>EXIF on Hover</Label>
                  <ToggleButton on={exifOnHover} onClick={toggleExifOnHover} />
                </div>
              </div>
            )}

            {/* ── GRID TAB ── */}
            {tab === 'grid' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <Label>Columns: {gridCols}</Label>
                  <input
                    type="range"
                    min={1}
                    max={6}
                    value={gridCols}
                    onChange={(e) => updateGridCols(Number(e.target.value))}
                    aria-label="Grid Columns"
                    style={{ width: '100%', accentColor: '#e4e4e7', marginTop: 6 }}
                  />
                </div>
                <div>
                  <Label>Gap: {gridGap}px</Label>
                  <input
                    type="range"
                    min={0}
                    max={32}
                    value={gridGap}
                    onChange={(e) => updateGridGap(Number(e.target.value))}
                    aria-label="Grid Gap"
                    style={{ width: '100%', accentColor: '#e4e4e7', marginTop: 6 }}
                  />
                </div>
                <div>
                  <Label>Aspect Ratio</Label>
                  <PillGrid
                    items={ASPECT_RATIOS}
                    active={aspectRatio}
                    onSelect={updateAspectRatio}
                  />
                </div>
              </div>
            )}

            {/* ── SERVER TAB ── */}
            {tab === 'server' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <Label>Hero Style — click to copy YAML</Label>
                  <PillGrid
                    items={HERO_STYLES}
                    active=""
                    onSelect={(h) => copyYaml('hero', `theme:\n  heroStyle: "${h}"`)}
                  />
                  {copiedYaml === 'hero' && <CopyBadge />}
                </div>
                <div>
                  <Label>Grid Layout — click to apply & copy</Label>
                  <PillGrid
                    items={GRID_LAYOUTS}
                    active={gridLayout}
                    onSelect={(l) => {
                      setGridLayout(l);
                      document.documentElement.setAttribute('data-grid-layout', l);
                      copyYaml('layout', `grid:\n  layout: "${l}"`);
                    }}
                  />
                  {copiedYaml === 'layout' && <CopyBadge />}
                </div>
                <p style={{ color: '#52525b', fontSize: 10, margin: 0, lineHeight: 1.5 }}>
                  These settings require a server re-render. Click to copy the YAML snippet, then
                  paste into <code style={{ color: '#a1a1aa' }}>content/settings.yaml</code>.
                </p>
              </div>
            )}
          </div>

          {/* ── Export YAML ──────────────────────── */}
          <div
            style={{
              padding: '10px 16px 14px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <button
              onClick={() => copyYaml('all', currentYaml)}
              style={{
                width: '100%',
                padding: '9px 0',
                borderRadius: 10,
                border: 'none',
                background: copiedYaml === 'all' ? '#16a34a' : 'rgba(255,255,255,0.92)',
                color: copiedYaml === 'all' ? '#fff' : '#111',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                letterSpacing: '0.02em',
              }}
            >
              {copiedYaml === 'all' ? '✓ Copied to clipboard' : 'Copy YAML to clipboard'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Sub-components ───────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: '#71717a',
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function ToggleButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 14px',
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.12s ease',
        background: on ? '#166534' : 'rgba(255,255,255,0.06)',
        color: on ? '#86efac' : '#71717a',
        border: on ? '1px solid #166534' : '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {on ? '● On' : '○ Off'}
    </button>
  );
}

const pillStyle: React.CSSProperties = {
  padding: '5px 11px',
  borderRadius: 8,
  fontSize: 11,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.12s ease',
  whiteSpace: 'nowrap',
};

function PillGrid({
  items,
  active,
  onSelect,
}: {
  items: string[];
  active: string;
  onSelect: (item: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {items.map((item) => (
        <button
          key={item}
          onClick={() => onSelect(item)}
          style={{
            ...pillStyle,
            background: item === active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.06)',
            color: item === active ? '#111' : '#71717a',
            border:
              item === active
                ? '1px solid rgba(255,255,255,0.7)'
                : '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function CopyBadge() {
  return (
    <span
      style={{
        display: 'inline-block',
        marginTop: 6,
        fontSize: 10,
        color: '#22c55e',
        fontWeight: 500,
      }}
    >
      ✓ YAML copied — paste into settings.yaml
    </span>
  );
}
