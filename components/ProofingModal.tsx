'use client';

import React, { useState } from 'react';
import { useProofing } from './ProofingContext';
import { IconCheck, IconCopy, IconLink } from './Icons';

export function ProofingModal() {
  const proofing = useProofing();
  const [copiedState, setCopiedState] = useState<'none' | 'link' | 'list'>('none');

  if (!proofing || !proofing.isModalOpen) return null;

  const {
    favorites,
    setIsModalOpen,
    getProofingUrl,
    getFormattedList,
    clearFavorites,
    allowMailto,
  } = proofing;

  const handleCopyLink = () => {
    const url = getProofingUrl();
    navigator.clipboard.writeText(url).then(() => {
      setCopiedState('link');
      setTimeout(() => setCopiedState('none'), 2000);
    });
  };

  const handleCopyList = () => {
    const list = getFormattedList();
    navigator.clipboard.writeText(list).then(() => {
      setCopiedState('list');
      setTimeout(() => setCopiedState('none'), 2000);
    });
  };

  const handleMailto = () => {
    const subject = encodeURIComponent(`Photo Selection (${favorites.size} items)`);
    const body = encodeURIComponent(
      `Hello,\n\nHere is my photo selection:\n\n${getFormattedList()}\n\nShare Link: ${getProofingUrl()}\n\nBest regards,`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
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
      <div
        className="proofing-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface, #1e1e1e)',
          color: 'var(--text-primary, #ffffff)',
          borderRadius: 'var(--radius-md, 12px)',
          border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
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
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>
            ❤️ Selection ({favorites.size})
          </h3>
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            aria-label="Close modal"
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
          You have selected {favorites.size} photo{favorites.size === 1 ? '' : 's'}. Choose an
          export option below to share your selection:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
              background: 'var(--accent, #e60012)',
              color: '#fff',
              border: 'none',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {copiedState === 'link' ? (
              <>
                <IconCheck size={15} aria-hidden="true" /> Link Copied!
              </>
            ) : (
              <>
                <IconLink size={15} aria-hidden="true" /> Copy Shareable Link
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
              background: 'rgba(255,255,255,0.1)',
              color: 'inherit',
              border: '1px solid rgba(255,255,255,0.15)',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {copiedState === 'list' ? (
              <>
                <IconCheck size={15} aria-hidden="true" /> List Copied!
              </>
            ) : (
              <>
                <IconCopy size={15} aria-hidden="true" /> Copy Text List (#1, #2...)
              </>
            )}
          </button>

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
                background: 'rgba(255,255,255,0.1)',
                color: 'inherit',
                border: '1px solid rgba(255,255,255,0.15)',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              ✉️ Send Email to Photographer
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (confirm('Clear all selected favorites?')) {
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
            Clear Selection
          </button>
        </div>
      </div>
    </div>
  );
}
