'use client';

import type { ParsedJournal } from '@/lib/journal';
import type { AssetPickTarget } from './BlockFields';
import PasswordField from '../fields/PasswordField';
import { useModalDialog } from '@/hooks/useModalDialog';

type Frontmatter = ParsedJournal['frontmatter'];

interface StorySettingsModalProps {
  frontmatter: Frontmatter;
  onChange: (updates: Partial<Frontmatter>) => void;
  onPickAsset: (target: AssetPickTarget) => void;
  onClose: () => void;
}

/** The entry's metadata — subtitle, author, date, cover, password, draft (#555). */
export function StorySettingsModal({
  frontmatter,
  onChange,
  onPickAsset,
  onClose,
}: StorySettingsModalProps) {
  const cardRef = useModalDialog(onClose);

  return (
    <div className="journal-modal-overlay">
      <div
        className="journal-modal-card"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-settings-title"
      >
        <h3 id="story-settings-title" style={{ margin: '0 0 1.25rem' }}>
          Story Settings &amp; Metadata
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              htmlFor="story-subtitle"
              style={{
                display: 'block',
                fontSize: '0.8rem',
                opacity: 0.8,
                marginBottom: '4px',
              }}
            >
              Subtitle
            </label>
            <input
              id="story-subtitle"
              type="text"
              className="admin-input"
              value={frontmatter.subtitle || ''}
              placeholder="e.g. Field notes from our winter journey"
              onChange={(e) => onChange({ subtitle: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label
                htmlFor="story-author"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  opacity: 0.8,
                  marginBottom: '4px',
                }}
              >
                Author
              </label>
              <input
                id="story-author"
                type="text"
                className="admin-input"
                value={frontmatter.author || ''}
                placeholder="e.g. Ralf"
                onChange={(e) => onChange({ author: e.target.value })}
              />
            </div>
            <div>
              <label
                htmlFor="story-publish-date"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  opacity: 0.8,
                  marginBottom: '4px',
                }}
              >
                Publish Date
              </label>
              <input
                id="story-publish-date"
                type="date"
                className="admin-input"
                value={frontmatter.date || ''}
                onChange={(e) => onChange({ date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                opacity: 0.8,
                marginBottom: '4px',
              }}
            >
              Cover Photo
            </label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div
                style={{
                  width: '70px',
                  height: '50px',
                  borderRadius: '6px',
                  background: 'rgba(0,0,0,0.3)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {frontmatter.coverAssetId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/admin/thumbnail/${frontmatter.coverAssetId}`}
                    alt="Cover"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>None</span>
                )}
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-xs"
                onClick={() =>
                  onPickAsset({
                    title: 'Select Cover Photo',
                    onSelect: (id) => onChange({ coverAssetId: id }),
                  })
                }
              >
                Choose Cover
              </button>
              {frontmatter.coverAssetId && (
                <button
                  type="button"
                  className="admin-btn admin-btn-xs admin-btn-danger"
                  onClick={() => onChange({ coverAssetId: undefined })}
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="story-password"
              style={{
                display: 'block',
                fontSize: '0.8rem',
                opacity: 0.8,
                marginBottom: '4px',
              }}
            >
              Password Protection (Optional)
            </label>
            {/* The input takes its styles from .admin-field, as everywhere else
                PasswordField is used; without it the lock icon sat on the text. */}
            <div className="admin-field" style={{ marginBottom: 0 }}>
              <PasswordField
                id="story-password"
                value={frontmatter.password || undefined}
                onChange={(password) => onChange({ password: password ?? '' })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px' }}>
            <input
              type="checkbox"
              id="draft-checkbox"
              checked={!!frontmatter.draft}
              onChange={(e) => onChange({ draft: e.target.checked })}
            />
            <label htmlFor="draft-checkbox" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
              Keep as Draft (Hidden from public /journal list)
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button type="button" className="admin-btn admin-btn-primary" onClick={() => onClose()}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
