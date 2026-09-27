'use client';

import { useEffect } from 'react';
import type { ParsedJournal } from '@/lib/journal';
import PasswordField from '../fields/PasswordField';
import { IconX } from '../Icons';

type Frontmatter = ParsedJournal['frontmatter'];

interface PageSettingsPanelProps {
  frontmatter: Frontmatter;
  onChange: (updates: Partial<Frontmatter>) => void;
  onClose: () => void;
}

/**
 * A content page's settings inside the editor (#722): a side panel rather than
 * the journal's modal, so the preview stays in view. The slug and the menu
 * place are edited in Pages, where the collision check and the menu live.
 */
export function PageSettingsPanel({ frontmatter, onChange, onClose }: PageSettingsPanelProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside className="page-settings-panel" aria-label="Page settings">
      <div className="page-settings-panel-head">
        <h3>Page settings</h3>
        <button type="button" className="admin-btn-icon" onClick={onClose} title="Close">
          <IconX size={14} />
        </button>
      </div>

      <div className="admin-field">
        <label htmlFor="page-settings-description">SEO description</label>
        <textarea
          id="page-settings-description"
          rows={3}
          value={frontmatter.description || ''}
          placeholder="One or two sentences for search engines and link previews"
          // One line in the frontmatter: a line break would end the value.
          onChange={(e) => onChange({ description: e.target.value.replace(/\s*\n\s*/g, ' ') })}
        />
      </div>

      <button
        type="button"
        className="setting-row"
        onClick={() => onChange({ draft: !frontmatter.draft })}
        aria-pressed={!!frontmatter.draft}
      >
        <span className="setting-row-info">
          <span className="setting-row-title">Draft</span>
          <span className="setting-row-desc">
            Only you can see a draft, and it stays out of the menu and the sitemap.
          </span>
        </span>
        <span className={`switch-toggle switch-toggle--sm ${frontmatter.draft ? 'on' : ''}`}>
          <span className="switch-slider" />
        </span>
      </button>

      <div className="admin-field">
        <span className="admin-field-label">Password (optional)</span>
        <PasswordField
          value={frontmatter.password || undefined}
          onChange={(password) => onChange({ password: password ?? '' })}
          label="Page password"
        />
      </div>

      <p className="page-settings-panel-note">
        Settings are saved with the page. The URL and the menu place are set in Pages.
      </p>
    </aside>
  );
}
