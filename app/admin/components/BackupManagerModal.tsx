'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BackupItem, BackupTarget } from '@/app/api/admin/backups/route';
import * as Icons from './Icons';
import { useScrollLock } from './useScrollLock';
import { useModalDialog } from '@/hooks/useModalDialog';
import { reportContentRestored } from './contentRestored';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess: () => void;
}

const TABS: { target: BackupTarget; label: string; file: string }[] = [
  { target: 'gallery', label: 'Gallery', file: 'gallery.yaml' },
  { target: 'settings', label: 'Settings', file: 'settings.yaml' },
  { target: 'about', label: 'About', file: 'about.md' },
  { target: 'journal', label: 'Journal', file: 'journal entries' },
];

type BackupLists = Record<BackupTarget, BackupItem[]>;

const EMPTY_LISTS: BackupLists = { gallery: [], settings: [], about: [], journal: [] };

export default function BackupManagerModal({ isOpen, onClose, onRestoreSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<BackupTarget>('gallery');
  const [showAllBackups, setShowAllBackups] = useState(false);
  const [backups, setBackups] = useState<BackupLists>(EMPTY_LISTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringFilename, setRestoringFilename] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<BackupItem | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/backups');
      if (!res.ok) {
        throw new Error('Failed to fetch backup history');
      }
      const data = await res.json();
      setBackups({ ...EMPTY_LISTS, ...data.backups });
    } catch (err: any) {
      setError(err.message || 'Error loading backups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchBackups();
      setConfirmItem(null);
      setSuccessMsg(null);
      setShowAllBackups(false);
    }
  }, [isOpen, fetchBackups]);

  useScrollLock(isOpen);
  /* Before the early `return null`: hooks must not run conditionally. */
  const cardRef = useModalDialog(onClose, isOpen);

  if (!isOpen) return null;

  async function handleRestore(item: BackupItem) {
    const filename = item.filename;
    setRestoringFilename(filename);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupFilename: filename, target: item.target }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to restore backup');
      }

      setSuccessMsg(
        item.slug
          ? `Journal entry "${item.slug}" restored.`
          : `Backup restored successfully! (${filename})`,
      );
      setConfirmItem(null);
      // Open editors still hold the pre-restore state; they reload on this.
      reportContentRestored({ target: item.target, slug: item.slug });
      await fetchBackups();
      onRestoreSuccess();
    } catch (err: any) {
      setError(err.message || 'Error restoring backup');
    } finally {
      setRestoringFilename(null);
    }
  }

  const currentList = backups[activeTab] || [];
  const INITIAL_VISIBLE_COUNT = 3;
  const visibleList = showAllBackups ? currentList : currentList.slice(0, INITIAL_VISIBLE_COUNT);
  const hiddenCount = currentList.length - INITIAL_VISIBLE_COUNT;

  return (
    <div className="backup-modal-backdrop" onClick={onClose}>
      <div
        className="backup-modal-container"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="backup-modal-header">
          <div>
            <h2 id="backup-modal-title">Backup History &amp; Restoration</h2>
            <p className="backup-modal-subtitle">
              Restore an earlier version of your pages, settings, about page or journal — including
              deleted journal entries.
            </p>
          </div>
          <button className="backup-modal-close-btn" onClick={onClose} aria-label="Close">
            <Icons.IconX size={16} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="backup-modal-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.target}
              className={`backup-modal-tab ${activeTab === tab.target ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.target);
                setConfirmItem(null);
                setShowAllBackups(false);
              }}
            >
              {tab.label} ({backups[tab.target].length})
            </button>
          ))}
        </div>

        {/* Status Messages */}
        {error && <div className="backup-status-alert error">{error}</div>}
        {successMsg && <div className="backup-status-alert success">{successMsg}</div>}

        {/* Confirmation Modal Section */}
        {confirmItem && (
          <div className="backup-confirm-box">
            <div className="backup-confirm-content">
              <strong>Confirm Restoration</strong>
              <p>
                Are you sure you want to restore <code>{confirmItem.filename}</code>? A safety
                snapshot of your current state will be created automatically before reverting.
              </p>
              <div className="backup-confirm-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setConfirmItem(null)}
                  disabled={!!restoringFilename}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleRestore(confirmItem)}
                  disabled={!!restoringFilename}
                >
                  {restoringFilename ? 'Restoring...' : 'Yes, Restore Now'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Backup List Content */}
        <div className="backup-modal-body">
          {loading ? (
            <div className="backup-loading">Loading backups...</div>
          ) : currentList.length === 0 ? (
            <div className="backup-empty">
              No backups available yet for {TABS.find((t) => t.target === activeTab)?.file}
            </div>
          ) : (
            <div className="backup-list">
              {visibleList.map((item) => {
                const dateObj = item.timestamp ? new Date(item.timestamp) : null;
                const formattedDate =
                  dateObj && !isNaN(dateObj.getTime())
                    ? dateObj.toLocaleString('de-DE', {
                        dateStyle: 'medium',
                        timeStyle: 'medium',
                      })
                    : item.filename;

                return (
                  <div key={item.filename} className="backup-item">
                    <div className="backup-item-info">
                      <div className="backup-item-title">
                        {item.slug && <strong className="backup-slug">{item.slug}</strong>}
                        <span className="backup-filename">{formattedDate}</span>
                        {item.isDeleted && (
                          <span
                            className="backup-badge deleted"
                            title="Snapshot taken when the entry was deleted"
                          >
                            Deleted entry
                          </span>
                        )}
                        {item.isPreRestore && (
                          <span
                            className="backup-badge pre-restore"
                            title="Safety snapshot taken before a restore"
                          >
                            Pre-Restore Snapshot
                          </span>
                        )}
                      </div>
                      <div className="backup-item-meta">
                        <code>{item.filename}</code>
                      </div>
                    </div>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => setConfirmItem(item)}
                      disabled={!!restoringFilename || confirmItem?.filename === item.filename}
                    >
                      Restore
                    </button>
                  </div>
                );
              })}

              {currentList.length > INITIAL_VISIBLE_COUNT && (
                <button
                  className="backup-toggle-btn"
                  onClick={() => setShowAllBackups(!showAllBackups)}
                >
                  <Icons.IconChevronDown
                    size={14}
                    style={{
                      transform: showAllBackups ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                  {showAllBackups
                    ? 'Ältere Einträge einklappen'
                    : `Ältere Einträge anzeigen (${hiddenCount} weitere)`}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="backup-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
