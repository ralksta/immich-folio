'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DoctorFinding, DoctorLevel } from '@/lib/admin/doctor';
import * as Icons from './Icons';
import { useScrollLock } from './useScrollLock';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const LEVEL_LABEL: Record<DoctorLevel, string> = {
  ok: 'OK',
  warn: 'Check',
  error: 'Problem',
};

/**
 * The config doctor's report (#491).
 *
 * Most "it does not work for me" reports are one of a handful of
 * misconfigurations that fail silently — a wrong proxy hop count, a deleted
 * album ID, a plaintext password. Each of those already logs a warning to the
 * server log, where nobody looks. This puts them where the operator is.
 */
export default function DoctorModal({ isOpen, onClose }: Props) {
  const [findings, setFindings] = useState<DoctorFinding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/doctor');
      if (!res.ok) throw new Error(`Diagnostics failed (${res.status})`);
      const data = await res.json();
      setFindings(data.findings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Diagnostics failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      run();
    }
  }, [isOpen, run]);

  useScrollLock(isOpen);

  if (!isOpen) return null;

  /** Markdown, so it can be pasted straight into a GitHub issue. */
  async function copyReport() {
    const body = findings
      .map((f) => `- **${LEVEL_LABEL[f.level]}** — ${f.title}\n  ${f.detail}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(`### Immich Folio diagnostics\n\n${body}\n`);
      setCopied(true);
    } catch {
      setError('Could not copy — your browser refused clipboard access.');
    }
  }

  const problems = findings.filter((f) => f.level !== 'ok').length;

  return (
    <div className="backup-modal-backdrop" onClick={onClose}>
      <div className="backup-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="backup-modal-header">
          <div>
            <h2>Diagnostics</h2>
            <p className="backup-modal-subtitle">
              {loading
                ? 'Checking…'
                : problems === 0
                  ? 'Nothing needs your attention.'
                  : `${problems} of ${findings.length} checks want a look.`}
            </p>
          </div>
          <button className="backup-modal-close-btn" onClick={onClose} aria-label="Close">
            <Icons.IconX size={18} />
          </button>
        </div>

        <div className="backup-modal-body">
          {error && <div className="admin-error">{error}</div>}

          {loading && !findings.length ? (
            <div className="admin-loading">
              <div className="admin-spinner" />
            </div>
          ) : (
            <ul className="doctor-list">
              {findings.map((f) => (
                <li key={f.id} className={`doctor-item doctor-item--${f.level}`}>
                  <span className="doctor-dot" aria-hidden="true" />
                  <span className="doctor-item-body">
                    <span className="doctor-item-title">{f.title}</span>
                    <span className="doctor-item-detail">{f.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="backup-modal-footer">
          <button className="admin-btn admin-btn-sm" onClick={run} disabled={loading}>
            <Icons.IconRefresh size={14} /> {loading ? 'Checking…' : 'Run again'}
          </button>
          <button
            className="admin-btn admin-btn-sm"
            onClick={copyReport}
            disabled={loading || !findings.length}
            title="Markdown, ready to paste into an issue"
          >
            <Icons.IconCopy size={14} /> {copied ? 'Copied' : 'Copy report'}
          </button>
        </div>
      </div>
    </div>
  );
}
