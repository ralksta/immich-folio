'use client';

/**
 * The selection bar and review dialog of a client proofing link.
 *
 * Stands in for the anonymous mode's bar and share/export modal: there is
 * nothing to share (the link already is the share), the selection saves itself,
 * and the one action that matters is submitting it to the photographer.
 */

import { useCallback, useState } from 'react';
import { useProofing } from './ProofingContext';
import { useDictionary } from './I18nProvider';
import { useModalDialog } from '@/hooks/useModalDialog';

const barStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '24px',
  right: '24px',
  left: 'auto',
  zIndex: 990,
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '12px',
  padding: '8px 16px',
  borderRadius: '30px',
  background: 'var(--bg-card, #1e1e1e)',
  color: 'var(--text-primary, #ffffff)',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  backdropFilter: 'blur(8px)',
  maxWidth: 'calc(100vw - 32px)',
};

const primaryButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1rem',
  borderRadius: 'var(--radius-sm, 6px)',
  background: 'var(--accent, #e60012)',
  color: '#fff',
  border: 'none',
  fontWeight: 500,
  // The same for the <button>s and the download <a>s, which would otherwise
  // take the browser's differing defaults.
  fontFamily: 'inherit',
  fontSize: '0.9rem',
  lineHeight: 1.3,
  cursor: 'pointer',
  textDecoration: 'none',
};

const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  background: 'var(--bg-card-hover)',
  color: 'inherit',
  border: '1px solid var(--border-subtle)',
};

export function ProofSessionControls() {
  const t = useDictionary();
  const proofing = useProofing();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const cardRef = useModalDialog(close, open);

  if (!proofing?.session) return null;
  const { session, favorites, isFilterActive, setIsFilterActive, getSelectedTokens } = proofing;
  const count = getSelectedTokens().length;
  const p = t.proofSession;

  const status =
    session.saveState === 'saving'
      ? p.saving
      : session.saveState === 'error'
        ? p.saveFailed
        : session.saveState === 'saved'
          ? p.saved
          : '';

  const handleSubmit = async () => {
    setSubmitting(true);
    await session.submit();
    setSubmitting(false);
  };

  const downloadHref = (scope: 'selection' | 'album') => `${session.archiveUrl}?scope=${scope}`;
  const downloadsLeft = session.downloadsRemaining;
  const canDownload = session.download !== 'none' && (downloadsLeft === null || downloadsLeft > 0);
  // The selection ZIP is built from what the server has saved, so it is only
  // offered once there is nothing left to save.
  const selectionSaved = session.saveState !== 'saving' && session.saveState !== 'error';

  return (
    <>
      <div className="proofing-sticky-bar proof-session-bar" style={barStyle}>
        {favorites.size > 0 && (
          <button
            type="button"
            onClick={() => setIsFilterActive((prev) => !prev)}
            aria-pressed={isFilterActive}
            style={{
              background: isFilterActive ? 'var(--accent, #e60012)' : 'var(--bg-card-hover)',
              color: isFilterActive ? '#fff' : 'var(--text-primary)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {isFilterActive ? t.proofing.showAll : t.proofing.selected(favorites.size)}
          </button>
        )}
        <span
          role="status"
          aria-live="polite"
          style={{
            fontSize: '0.8rem',
            opacity: 0.75,
            color: session.saveState === 'error' ? 'var(--accent, #e60012)' : undefined,
          }}
        >
          {session.submitted ? p.locked : status}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {session.submitted ? p.modalTitle(count) : p.review}
        </button>
      </div>

      {open && (
        <div
          className="proofing-modal-overlay"
          onClick={close}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            className="proofing-modal-card"
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="proof-session-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card, #1e1e1e)',
              color: 'var(--text-primary, #ffffff)',
              borderRadius: 'var(--radius-md, 12px)',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
              padding: '1.5rem',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <h3
                id="proof-session-title"
                style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}
              >
                {p.modalTitle(count)}
              </h3>
              <button
                type="button"
                onClick={close}
                aria-label={t.proofing.closeModal}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'currentColor',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  opacity: 0.7,
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            <p style={{ fontSize: '0.9rem', opacity: 0.85, marginBottom: '1rem' }}>
              {session.submitted ? p.submitted : count === 0 ? p.empty : p.confirmSubmit(count)}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {!session.submitted && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={count === 0 || submitting}
                  style={{
                    ...primaryButton,
                    cursor: count === 0 || submitting ? 'not-allowed' : 'pointer',
                    opacity: count === 0 || submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? p.submitting : p.submit}
                </button>
              )}

              {canDownload && count > 0 && selectionSaved && (
                <a href={downloadHref('selection')} style={secondaryButton}>
                  {p.downloadSelection}
                </a>
              )}
              {canDownload && session.download === 'album' && (
                <a href={downloadHref('album')} style={secondaryButton}>
                  {p.downloadAll}
                </a>
              )}
              {session.download !== 'none' && downloadsLeft !== null && (
                <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: 0, textAlign: 'center' }}>
                  {downloadsLeft > 0 ? p.downloadsLeft(downloadsLeft) : t.download.limitReached}
                </p>
              )}
              {session.saveState === 'error' && (
                <p role="alert" style={{ fontSize: '0.85rem', margin: 0 }}>
                  {p.saveFailed}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
