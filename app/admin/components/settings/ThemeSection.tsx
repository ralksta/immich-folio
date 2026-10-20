'use client';

import { useState, type CSSProperties } from 'react';
import * as Icons from '../Icons';
import OptionGrid, { toOptions } from '../fields/OptionGrid';
import { DEFAULT_PRESET } from '@/lib/config/theme';
import { PRESET_IDS, PRESET_REGISTRY } from '@/lib/config/presets';
import { effectiveTheme, FeatureRow, FieldError } from './fields';
import type { SectionProps } from './types';
import { rich, useAdminDictionary } from '../AdminI18n';

const PHOTO_FRAMES = ['none', 'passepartout', 'shadow'];
const HERO_STYLES = ['split', 'fullbleed', 'minimal', 'stacked', 'typographic', 'mosaic', 'cover'];

/** The accent swatches; their names come from `settings.theme.swatches`. */
const SWATCHES = [
  { hex: '#e60012', name: 'studioRed' },
  { hex: '#b89053', name: 'editorialGold' },
  { hex: '#10b981', name: 'emerald' },
  { hex: '#3b82f6', name: 'sapphire' },
  { hex: '#8b5cf6', name: 'violet' },
  { hex: '#ffffff', name: 'white' },
  { hex: '#000000', name: 'black' },
] as const;

function PhotoFramePreview({ value }: { value: string }) {
  return (
    <div className="frame-card-preview">
      <div className={`mini-frame-demo frame-${value}`}>
        <div className="mini-frame-photo" />
      </div>
    </div>
  );
}

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
        {/* Text only, like the hero it stands for: the typographic hero
            renders no photo, so the card must not promise any. */}
        {value === 'typographic' && (
          <>
            <div className="demo-line title giant" />
            <div className="demo-line sub" />
            <div className="hero-demo-divider" />
            <div className="hero-demo-nav">
              <div className="demo-line" />
              <div className="demo-line" />
              <div className="demo-line" />
            </div>
          </>
        )}
        {value === 'cover' && (
          <div className="hero-demo-full hero-demo-cover-splash">
            <div className="demo-line title light" />
            <div className="hero-demo-enter" />
          </div>
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

/**
 * Card metadata for the theme picker, from the preset registry
 * (lib/config/presets.ts). `font`, `radius` and `frame` are the preset's own
 * values so the mini mockups show what the preset actually does; `gap` is the
 * visual density of its gallery grid.
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
> = Object.fromEntries(
  PRESET_REGISTRY.map((p) => [
    p.id,
    {
      label: p.label,
      desc: p.description,
      ...p.card,
      font: p.theme.fonts.heading,
      radius: p.theme.radius,
      frame: p.theme.photoFrame,
    },
  ]),
);

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

const PRESET_OPTIONS = PRESET_IDS.map((value) => ({
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
  const t = useAdminDictionary().settings.theme;
  return <span className="preset-card-specs">{t.presetSpecs(i.font, i.radius, i.frame)}</span>;
}

export default function ThemeSection({ settings, update, fieldErrors }: SectionProps) {
  const t = useAdminDictionary().settings.theme;
  // Read off the page on mount: the toggle previews light and dark on the
  // admin itself, and the page may already be in either.
  const [currentMode, setCurrentMode] = useState<'dark' | 'light'>(() =>
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'light'
      ? 'light'
      : 'dark',
  );

  const toggleMode = (mode: 'dark' | 'light') => {
    setCurrentMode(mode);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', mode);
      localStorage.setItem('theme', mode);
    }
  };

  // Same idea for the theme: an unset field shows the preset's own value, not
  // a fallback of this form's — Classic used to read "split hero, no frame".
  const theme = effectiveTheme(settings.theme);

  return (
    <div className="settings-panel theme-settings-panel">
      <div className="settings-section-header">
        <h3>
          <Icons.IconPalette size={18} /> {t.title}
        </h3>
        <p className="settings-section-sub">{t.sub}</p>
      </div>

      <div className="admin-field">
        <label htmlFor="theme-visitor-default-mode">{t.visitorMode}</label>
        <select
          id="theme-visitor-default-mode"
          aria-label={t.visitorModeAria}
          value={settings.mode || 'dark'}
          onChange={(e) => update('mode', e.target.value)}
        >
          <option value="dark">{t.modeDark}</option>
          <option value="light">{t.modeLight}</option>
          <option value="auto">{t.modeAuto}</option>
        </select>
        <p className="admin-field-hint">{t.visitorModeHint}</p>
      </div>

      <OptionGrid
        label={t.preset}
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
          } as CSSProperties;
        }}
      />

      <div className="admin-field">
        <span className="admin-field-label">{t.colorMode}</span>
        <p
          style={{
            fontSize: '0.78rem',
            color: 'var(--admin-text-muted)',
            margin: '0.25rem 0 0.6rem',
            lineHeight: '1.4',
          }}
        >
          {rich(t.colorModeHint, {
            editorial: <strong>Editorial</strong>,
            minimal: <strong>Minimal</strong>,
            classic: <strong>Classic</strong>,
          })}
        </p>
        <div className="segmented-control">
          <button
            type="button"
            className={`segment-btn ${currentMode === 'light' ? 'active' : ''}`}
            onClick={() => toggleMode('light')}
          >
            <Icons.IconSun size={14} /> {t.lightMode}
          </button>
          <button
            type="button"
            className={`segment-btn ${currentMode === 'dark' ? 'active' : ''}`}
            onClick={() => toggleMode('dark')}
          >
            <Icons.IconMoon size={14} /> {t.darkMode}
          </button>
        </div>
      </div>

      <div className="settings-section-divider" />

      <div className="settings-section-header">
        <h3>
          <Icons.IconTarget size={18} /> {t.accentTitle}
        </h3>
        <p className="settings-section-sub">{t.accentSub}</p>
      </div>

      <div className="admin-field">
        <div className="accent-picker-wrapper">
          <div className="color-swatches-row">
            {SWATCHES.map((swatch) => {
              const isSelected = theme.accent.toLowerCase() === swatch.hex.toLowerCase();
              return (
                <button
                  key={swatch.hex}
                  type="button"
                  className={`color-swatch-btn ${isSelected ? 'active' : ''}`}
                  style={{ backgroundColor: swatch.hex }}
                  onClick={() => update('theme.accent', swatch.hex)}
                  title={t.swatches[swatch.name]}
                />
              );
            })}
          </div>
          <div className="color-field">
            <input
              type="color"
              aria-label={t.accentAria}
              value={theme.accent}
              onChange={(e) => update('theme.accent', e.target.value)}
            />
            <input
              aria-label={t.accentHexAria}
              type="text"
              value={settings.theme?.accent || ''}
              onChange={(e) => update('theme.accent', e.target.value)}
              placeholder={theme.accent}
              aria-invalid={fieldErrors?.['theme.accent'] ? true : undefined}
              aria-describedby={fieldErrors?.['theme.accent'] ? 'theme-accent-error' : undefined}
            />
          </div>
          <FieldError id="theme-accent-error" message={fieldErrors?.['theme.accent']} />
        </div>
      </div>

      <div className="settings-section-divider" />

      <div className="settings-section-header">
        <h3>
          <Icons.IconFrame size={18} /> {t.frameTitle}
        </h3>
        <p className="settings-section-sub">{t.frameSub}</p>
      </div>

      <OptionGrid
        label={t.photoFrame}
        options={toOptions(PHOTO_FRAMES, t.photoFrames)}
        value={theme.photoFrame}
        onSelect={(v) => update('theme.photoFrame', v)}
        cardClassName="frame-card"
        renderPreview={(o) => <PhotoFramePreview value={o.value} />}
      />

      <OptionGrid
        label={t.heroStyle}
        options={toOptions(HERO_STYLES, t.heroStyles)}
        value={theme.heroStyle}
        onSelect={(v) => update('theme.heroStyle', v)}
        cardClassName="hero-card"
        renderPreview={(o) => <HeroStylePreview value={o.value} />}
      />

      <div className="settings-section-divider" />

      <div className="settings-section-header">
        <h3>
          <Icons.IconSparkles size={18} /> {t.lookTitle}
        </h3>
        <p className="settings-section-sub">{t.lookSub}</p>
      </div>

      <div className="feature-list">
        <FeatureRow
          icon={<Icons.IconSparkles size={15} />}
          title={t.transitions}
          description={t.transitionsDesc}
          checked={settings.transitions !== false}
          onToggle={() => update('transitions', settings.transitions === false)}
        />
        <FeatureRow
          icon={<Icons.IconArrowUp size={15} />}
          title={t.scrollToTop}
          description={t.scrollToTopDesc}
          checked={settings.scrollToTop !== false}
          onToggle={() => update('scrollToTop', settings.scrollToTop === false)}
        />
        <FeatureRow
          icon={<Icons.IconFilm size={15} />}
          title={t.grain}
          description={t.grainDesc}
          checked={theme.grain}
          onToggle={() => update('theme.grain', !theme.grain)}
        />
        <FeatureRow
          icon={<Icons.IconTarget size={15} />}
          title={t.headerDot}
          description={t.headerDotDesc}
          checked={theme.headerDot}
          onToggle={() => update('theme.headerDot', !theme.headerDot)}
        />
      </div>
    </div>
  );
}
