'use client';

import * as Icons from '../Icons';
import OptionGrid, { toOptions } from '../fields/OptionGrid';
import {
  PHOTO_GRID_COLUMNS_MAX,
  PHOTO_GRID_COLUMNS_MIN,
  PHOTO_GRID_GAP_MAX,
} from '@/lib/config/schema';
import { FieldError } from './fields';
import type { SectionProps } from './types';
import { useAdminDictionary } from '../AdminI18n';

const LAYOUTS = ['masonry', 'uniform', 'showcase', 'filmstrip', 'editorial-flow', 'justified'];
const ASPECT_RATIOS = ['1', '3/2', '2/3', '16/9', 'auto'];

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

function AspectRatioPreview({ value }: { value: string }) {
  return (
    <div className="ratio-card-preview">
      <div className={`mini-aspect-box ratio-${value.replace('/', '-')}`}>
        <div className="mini-aspect-inner" />
      </div>
    </div>
  );
}

export default function GridSection({ settings, update, fieldErrors }: SectionProps) {
  const t = useAdminDictionary().settings.grid;
  return (
    <div className="settings-panel">
      <div className="settings-section-header">
        <h3>
          <Icons.IconGrid size={18} /> {t.title}
        </h3>
        <p className="settings-section-sub">{t.sub}</p>
      </div>

      <OptionGrid
        label={t.layout}
        options={toOptions(LAYOUTS, t.layouts)}
        value={settings.grid?.layout || 'masonry'}
        onSelect={(v) => update('grid.layout', v)}
        cardClassName="grid-layout-card"
        renderPreview={(o) => <LayoutPreview value={o.value} />}
      />

      <OptionGrid
        label={t.aspectRatio}
        options={toOptions(ASPECT_RATIOS, t.aspectRatios)}
        value={settings.grid?.aspectRatio || '1'}
        onSelect={(v) => update('grid.aspectRatio', v)}
        cardClassName="ratio-card"
        renderPreview={(o) => <AspectRatioPreview value={o.value} />}
      />

      <div className="settings-section-divider" />

      <div className="settings-section-header">
        <h3>
          <Icons.IconColumns size={18} /> {t.spacingTitle}
        </h3>
        <p className="settings-section-sub">{t.spacingSub}</p>
      </div>

      <div className="admin-field-row">
        <div className="admin-field">
          <label htmlFor="grid-columns">
            {t.columns(PHOTO_GRID_COLUMNS_MIN, PHOTO_GRID_COLUMNS_MAX)}
          </label>
          <input
            id="grid-columns"
            type="number"
            min={PHOTO_GRID_COLUMNS_MIN}
            max={PHOTO_GRID_COLUMNS_MAX}
            value={settings.grid?.columns ?? 3}
            onChange={(e) => update('grid.columns', parseInt(e.target.value) || 3)}
            aria-invalid={fieldErrors?.['grid.columns'] ? true : undefined}
            aria-describedby={fieldErrors?.['grid.columns'] ? 'grid-columns-error' : undefined}
          />
          <FieldError id="grid-columns-error" message={fieldErrors?.['grid.columns']} />
        </div>
        <div className="admin-field">
          <label htmlFor="grid-gap-spacing">{t.gap}</label>
          <input
            id="grid-gap-spacing"
            type="number"
            min={0}
            max={PHOTO_GRID_GAP_MAX}
            value={settings.grid?.gap ?? 12}
            onChange={(e) => update('grid.gap', parseInt(e.target.value) || 0)}
            aria-invalid={fieldErrors?.['grid.gap'] ? true : undefined}
            aria-describedby={fieldErrors?.['grid.gap'] ? 'grid-gap-error' : undefined}
          />
          <FieldError id="grid-gap-error" message={fieldErrors?.['grid.gap']} />
        </div>
      </div>
    </div>
  );
}
