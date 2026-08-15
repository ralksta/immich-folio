'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BackupItem } from '@/app/api/admin/backups/route';
import * as Icons from './Icons';
import { useScrollLock } from './useScrollLock';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess: () => void;
}

export default function BackupManagerModal({ isOpen, onClose, onRestoreSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<'gallery' | 'settings'>('gallery');
  const [showAllBackups, setShowAllBackups] = useState(false);
  const [backups, setBackups] = useState<{ gallery: BackupItem[]; settings: BackupItem[] }>({
    gallery: [],
    settings: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringFilename, setRestoringFilename] = useState<string | null>(null);
  const [confirmFilename, setConfirmFilename] = useState<string | null>(null);
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
      setBackups(data.backups || { gallery: [], settings: [] });
    } catch (err: any) {
      setError(err.message || 'Error loading backups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchBackups();
      setConfirmFilename(null);
      setSuccessMsg(null);
      setShowAllBackups(false);
    }
  }, [isOpen, fetchBackups]);

  useScrollLock(isOpen);

  if (!isOpen) return null;

  async function handleRestore(filename: string) {
    setRestoringFilename(filename);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupFilename: filename }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to restore backup');
      }

      setSuccessMsg(`Backup restored successfully! (${filename})`);
      setConfirmFilename(null);
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
      <div className="backup-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="backup-modal-header">
          <div>
            <h2>Backup History & Restoration</h2>
            <p className="backup-modal-subtitle">
              Restore previous states of your configuration files with 1-click.
            </p>
          </div>
          <button className="backup-modal-close-btn" onClick={onClose} aria-label="Close">
            <Icons.IconX size={16} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="backup-modal-tabs">
          <button
            className={`backup-modal-tab ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('gallery');
              setConfirmFilename(null);
              setShowAllBackups(false);
            }}
          >
            Gallery Backups ({backups.gallery.length})
          </button>
          <button
            className={`backup-modal-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('settings');
              setConfirmFilename(null);
              setShowAllBackups(false);
            }}
          >
            Settings Backups ({backups.settings.length})
          </button>
        </div>

        {/* Status Messages */}
        {error && <div className="backup-status-alert error">{error}</div>}
        {successMsg && <div className="backup-status-alert success">{successMsg}</div>}

        {/* Confirmation Modal Section */}
        {confirmFilename && (
          <div className="backup-confirm-box">
            <div className="backup-confirm-content">
              <strong>Confirm Restoration</strong>
              <p>
                Are you sure you want to restore <code>{confirmFilename}</code>? A safety snapshot
                of your current state will be created automatically before reverting.
              </p>
              <div className="backup-confirm-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setConfirmFilename(null)}
                  disabled={!!restoringFilename}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleRestore(confirmFilename)}
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
            <div className="backup-empty">No backups available yet for {activeTab}.yaml</div>
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
                        <span className="backup-filename">{formattedDate}</span>
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
                      onClick={() => setConfirmFilename(item.filename)}
                      disabled={!!restoringFilename || confirmFilename === item.filename}
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
