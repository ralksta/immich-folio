'use client';

import { useState } from 'react';
import { sanitizeSlug, slugFieldValue } from '@/lib/journal';
import { describeCollision, pageSlugCollision, type SlugTakenBy } from '@/lib/pages';
import { useModalDialog } from '@/hooks/useModalDialog';

interface NewPageDialogProps {
  taken: SlugTakenBy;
  existingPageSlugs: string[];
  creating: boolean;
  onCreate: (input: { title: string; slug: string; showInMenu: boolean }) => void;
  onClose: () => void;
}

/**
 * "+ New page" (#722): a title, the slug derived from it (editable), and
 * whether the page goes into the menu. v1 starts every page blank.
 */
export default function NewPageDialog({
  taken,
  existingPageSlugs,
  creating,
  onCreate,
  onClose,
}: NewPageDialogProps) {
  const cardRef = useModalDialog(onClose);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [showInMenu, setShowInMenu] = useState(true);

  /** What the field shows: the typed slug, or the one derived from the title. */
  const fieldSlug = slug || (title.trim() ? sanitizeSlug(title) : '');
  /** What gets created: the typed slug finished, e.g. without a trailing "-". */
  const effectiveSlug = slug ? sanitizeSlug(slug) : fieldSlug;
  const collision = !effectiveSlug
    ? null
    : existingPageSlugs.includes(effectiveSlug)
      ? `A page "${effectiveSlug}" already exists.`
      : (() => {
          const c = pageSlugCollision(effectiveSlug, taken);
          return c ? describeCollision(effectiveSlug, c) : null;
        })();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !effectiveSlug || collision || creating) return;
    onCreate({ title: title.trim(), slug: effectiveSlug, showInMenu });
  };

  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <div
        ref={cardRef}
        className="confirm-card new-page-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-page-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="new-page-title" className="confirm-title">
          New page
        </h2>
        <form onSubmit={submit} className="new-page-form">
          <div className="admin-field">
            <label htmlFor="new-page-name">Title</label>
            <input
              id="new-page-name"
              value={title}
              placeholder="e.g. Pricing"
              autoFocus
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugEdited) setSlug('');
              }}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="new-page-slug">URL</label>
            <div className="input-slug-wrapper">
              <input
                id="new-page-slug"
                className="subpage-name-input"
                value={fieldSlug}
                placeholder="pricing"
                aria-describedby="new-page-slug-hint"
                onChange={(e) => {
                  setSlugEdited(e.target.value !== '');
                  setSlug(slugFieldValue(e.target.value));
                }}
              />
              <span className="input-slug-preview">/{effectiveSlug || 'slug'}</span>
            </div>
            <span
              id="new-page-slug-hint"
              className={`admin-field-hint${collision ? ' admin-field-hint--error' : ''}`}
            >
              {collision ?? 'Starts blank and as a draft. You can change the URL later.'}
            </span>
          </div>
          <button
            type="button"
            className="setting-row"
            onClick={() => setShowInMenu(!showInMenu)}
            aria-pressed={showInMenu}
          >
            <span className="setting-row-info">
              <span className="setting-row-title">Show in menu</span>
              <span className="setting-row-desc">
                Adds it to the end of the menu; saved with “Save Changes”.
              </span>
            </span>
            <span className={`switch-toggle switch-toggle--sm ${showInMenu ? 'on' : ''}`}>
              <span className="switch-slider" />
            </span>
          </button>
          <div className="confirm-actions">
            <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={!title.trim() || !effectiveSlug || !!collision || creating}
            >
              {creating ? 'Creating…' : 'Create page'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
