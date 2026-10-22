'use client';

import { useEffect } from 'react';
import type { ParsedJournal } from '@/lib/journal';
import PasswordField from '../fields/PasswordField';
import { IconX } from '../Icons';
import { useAdminDictionary } from '../AdminI18n';

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
  const dict = useAdminDictionary();
  const t = dict.journal.pageSettings;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside className="page-settings-panel" aria-label={t.title}>
      <div className="page-settings-panel-head">
        <h3>{t.title}</h3>
        <button
          type="button"
          className="admin-btn-icon"
          onClick={onClose}
          title={dict.common.close}
        >
          <IconX size={14} />
        </button>
      </div>

      <div className="admin-field">
        <label htmlFor="page-settings-description">{t.description}</label>
        <textarea
          id="page-settings-description"
          rows={3}
          value={frontmatter.description || ''}
          placeholder={t.descriptionPlaceholder}
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
          <span className="setting-row-title">{t.draft}</span>
          <span className="setting-row-desc">{t.draftDescription}</span>
        </span>
        <span className={`switch-toggle switch-toggle--sm ${frontmatter.draft ? 'on' : ''}`}>
          <span className="switch-slider" />
        </span>
      </button>

      <div className="admin-field">
        <span className="admin-field-label">{t.password}</span>
        <PasswordField
          value={frontmatter.password || undefined}
          onChange={(password) => onChange({ password: password ?? '' })}
          label={t.passwordLabel}
        />
      </div>

      <p className="page-settings-panel-note">{t.note}</p>
    </aside>
  );
}
