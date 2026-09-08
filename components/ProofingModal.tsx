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

  /* Vor dem fruehen `return null`: Haken duerfen nicht bedingt laufen.
     `proofing` kann null sein, deshalb der optionale Aufruf. */
  const istOffen = Boolean(proofing?.isModalOpen);
  const schliessen = useCallback(() => proofing?.setIsModalOpen(false), [proofing]);
  const cardRef = useModalDialog(schliessen, istOffen);

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
    const subject = encodeURIComponent(t.proofing.mailSubject(favorites.size));
    const body = encodeURIComponent(t.proofing.mailBody(getFormattedList(), getProofingUrl()));
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
      {/* `--bg-surface` und `--border-color` waren in keiner Datei des
          Projekts definiert -- die Werte fielen also immer auf ihre fest
          eingetragenen Ersatzfarben zurueck. Im hellen Thema hiess das:
          dunkle Karte (#1e1e1e) und dazu `--text-primary`, das im hellen
          Thema sehr wohl definiert ist und dort #1a1a18 ergibt. Dunkler Text
          auf dunklem Grund, rund 1,05:1. Jetzt stehen dort die Marken, die
          es wirklich gibt. */}
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
              background: 'rgba(255,255,255,0.1)',
              color: 'inherit',
              border: '1px solid rgba(255,255,255,0.15)',
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
