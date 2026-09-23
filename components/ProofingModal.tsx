'use client';

import React, { useState, useCallback } from 'react';
import { useProofing } from './ProofingContext';
import { IconCheck, IconCopy, IconLink } from './Icons';
import { useDictionary } from './I18nProvider';
import { useModalDialog } from '@/hooks/useModalDialog';

export function ProofingModal() {
  const t = useDictionary();
  const proofing = useProofing();
  const [copiedState, setCopiedState] = useState<'none' | 'link' | 'list'>('none');
  /**
   * What to show for copying by hand. `navigator.clipboard` only exists in a
   * secure context, and a self-hosted portfolio reached over plain http on a
   * LAN is not one — the buttons used to throw and appear to do nothing. The
   * lightbox's permalink falls back the same way.
   */
  const [manualCopy, setManualCopy] = useState<'link' | 'list' | null>(null);

  /* Before the early `return null`: hooks must not run conditionally.
     `proofing` can be null, hence the optional calls. */
  const isOpen = Boolean(proofing?.isModalOpen);
  const close = useCallback(() => proofing?.setIsModalOpen(false), [proofing]);
  const cardRef = useModalDialog(close, isOpen);

  if (!proofing || !proofing.isModalOpen) return null;

  const {
    favorites,
    setIsModalOpen,
    getProofingUrl,
    getFormattedList,
    getSelectedTokens,
    clearFavorites,
    allowMailto,
    downloadArchiveUrl,
  } = proofing;

  // What the archive would actually receive. Gating on this rather than on
  // `favorites.size` means a favourite left over from another album (they share
  // the provider's storage key when no `albumName` is passed) can never light up
  // a button that would post an empty selection and 404.
  const selectedCount = getSelectedTokens().length;

  /** Copy to the clipboard, or show the text to copy by hand where it is unavailable. */
  const copy = (kind: 'link' | 'list', text: string) => {
    if (!navigator.clipboard) {
      setManualCopy(kind);
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => {
        setManualCopy(null);
        setCopiedState(kind);
        setTimeout(() => setCopiedState('none'), 2000);
      },
      () => setManualCopy(kind),
    );
  };

  const handleCopyLink = () => copy('link', getProofingUrl());

  const handleCopyList = () => copy('list', getFormattedList());

  const handleMailto = () => {
    const subject = encodeURIComponent(t.proofing.mailSubject(favorites.size));
    const body = encodeURIComponent(t.proofing.mailBody(getFormattedList(), getProofingUrl()));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleDownloadSelection = () => {
    if (!downloadArchiveUrl) return;
    const tokens = getSelectedTokens();
    if (tokens.length === 0) return;

    // A form POST, not a fetch: the browser streams the response straight to
    // disk, so a large selection never has to fit in memory — a phone cannot
    // hold a whole ZIP in a blob. The route answers with
    // `Content-Disposition: attachment`, so the page stays where it was.
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = downloadArchiveUrl;
    form.style.display = 'none';
    for (const token of tokens) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'assets';
      input.value = token;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    form.remove();
  };

  return (
    <div
      className="proofing-modal-overlay"
      onClick={() => setIsModalOpen(false)}
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
      {/* This card used to read `--bg-surface` and `--border-color`, which
          are defined nowhere, so it always fell back to the hard-coded dark
          values. In the light theme that meant a #1e1e1e card under
          `--text-primary`, which does exist there and resolves to #1a1a18:
          dark text on a dark background, about 1.05:1. It now uses tokens
          that exist. */}
      <div
        className="proofing-modal-card"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="proofing-modal-title"
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
          <h3 id="proofing-modal-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>
            {t.proofing.modalTitle(favorites.size)}
          </h3>
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
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

        <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '1rem' }}>
          {t.proofing.intro(favorites.size)}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {downloadArchiveUrl && (
            <button
              type="button"
              onClick={handleDownloadSelection}
              disabled={selectedCount === 0}
              style={{
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
                cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
                opacity: selectedCount === 0 ? 0.6 : 1,
              }}
            >
              <svg
                aria-hidden="true"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t.proofing.downloadSelected}
            </button>
          )}

          {/* The primary action is the download when there is one; otherwise
              copying the link stays the accent button it always was. */}
          <button
            type="button"
            onClick={handleCopyLink}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm, 6px)',
              ...(downloadArchiveUrl
                ? {
                    background: 'rgba(255,255,255,0.1)',
                    color: 'inherit',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }
                : { background: 'var(--accent, #e60012)', color: '#fff', border: 'none' }),
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {copiedState === 'link' ? (
              <>
                <IconCheck size={15} aria-hidden="true" /> {t.proofing.linkCopied}
              </>
            ) : (
              <>
                <IconLink size={15} aria-hidden="true" /> {t.proofing.copyLink}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCopyList}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm, 6px)',
              background: 'var(--bg-card-hover)',
              color: 'inherit',
              border: '1px solid var(--border-subtle)',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {copiedState === 'list' ? (
              <>
                <IconCheck size={15} aria-hidden="true" /> {t.proofing.listCopied}
              </>
            ) : (
              <>
                <IconCopy size={15} aria-hidden="true" /> {t.proofing.copyList}
              </>
            )}
          </button>

          {manualCopy && (
            <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label htmlFor="proofing-manual-copy" style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                {manualCopy === 'link' ? t.proofing.copyManualLink : t.proofing.copyManualList}
              </label>
              <textarea
                id="proofing-manual-copy"
                readOnly
                autoFocus
                rows={manualCopy === 'link' ? 2 : 4}
                value={manualCopy === 'link' ? getProofingUrl() : getFormattedList()}
                onFocus={(e) => e.currentTarget.select()}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm, 6px)',
                  background: 'var(--bg-card-hover)',
                  color: 'inherit',
                  border: '1px solid var(--border-subtle)',
                  font: 'inherit',
                  fontSize: '0.85rem',
                  resize: 'vertical',
                }}
              />
            </div>
          )}

          {allowMailto && (
            <button
              type="button"
              onClick={handleMailto}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm, 6px)',
                background: 'var(--bg-card-hover)',
                color: 'inherit',
                border: '1px solid var(--border-subtle)',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {t.proofing.sendEmail}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (confirm(t.proofing.confirmClear)) {
                clearFavorites();
                setIsModalOpen(false);
              }
            }}
            style={{
              marginTop: '0.5rem',
              background: 'none',
              border: 'none',
              color: '#ff4d4f',
              fontSize: '0.85rem',
              cursor: 'pointer',
              opacity: 0.8,
            }}
          >
            {t.proofing.clearSelection}
          </button>
        </div>
      </div>
    </div>
  );
}
