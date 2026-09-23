'use client';

import type { ParsedJournal } from '@/lib/journal';
import type { AssetPickTarget } from './BlockFields';

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
  return (
    <div className="journal-modal-overlay">
      <div className="journal-modal-card">
        <h3 style={{ margin: '0 0 1.25rem' }}>Story Settings &amp; Metadata</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
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
                type="text"
                className="admin-input"
                value={frontmatter.author || ''}
                placeholder="e.g. Ralf"
                onChange={(e) => onChange({ author: e.target.value })}
              />
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
                Publish Date
              </label>
              <input
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
              style={{
                display: 'block',
                fontSize: '0.8rem',
                opacity: 0.8,
                marginBottom: '4px',
              }}
            >
              Password Protection (Optional)
            </label>
            <input
              type="password"
              className="admin-input"
              value={frontmatter.password || ''}
              placeholder="Leave empty for public access"
              onChange={(e) => onChange({ password: e.target.value })}
            />
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
