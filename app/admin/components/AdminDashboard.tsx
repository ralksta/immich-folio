'use client';

import { useState, useEffect } from 'react';
import PageBuilder from './PageBuilder';
import SettingsEditor from './SettingsEditor';

interface Props {
  onLogout: () => void;
}

type Tab = 'pages' | 'settings';

export default function AdminDashboard({ onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('pages');
  const [saving, setSaving] = useState(false);

  // Diagnostics state
  const [showStatus, setShowStatus] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    onLogout();
  }

  async function handleReload() {
    setSaving(true);
    try {
      await fetch('/api/admin/reload', { method: 'POST' });
      // Refresh status after reload
      await fetchStatus();
    } finally {
      setSaving(false);
    }
  }

  const fetchStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/api/admin/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        setStatus(null);
      }
    } catch {
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-left">
          <h1>Immich Folio</h1>
          <nav className="admin-tabs">
            <button
              className={`admin-tab ${activeTab === 'pages' ? 'active' : ''}`}
              onClick={() => setActiveTab('pages')}
            >
              Pages
            </button>
            <button
              className={`admin-tab ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </button>
          </nav>
        </div>
        <div className="admin-header-right">
          {/* Diagnostics Badge */}
          <div className="status-indicator-container">
            <button
              className={`status-badge-btn ${status?.immich?.status === 'connected' ? 'connected' : 'disconnected'}`}
              onClick={() => {
                setShowStatus(!showStatus);
                if (!showStatus) fetchStatus();
              }}
              title="Show system status"
            >
              <span className="status-dot"></span>
              <span className="status-text">
                {statusLoading ? 'Checking...' : status?.immich?.status === 'connected' ? 'System OK' : 'System Degraded'}
              </span>
            </button>
            
            {showStatus && (
              <>
                <div className="status-dropdown-backdrop" onClick={() => setShowStatus(false)} />
                <div className="status-dropdown">
                  <div className="status-dropdown-header">
                    <h4>System Diagnostics</h4>
                    <button 
                      className="status-refresh-btn" 
                      onClick={fetchStatus}
                      disabled={statusLoading}
                      title="Refresh diagnostics"
                    >
                      {statusLoading ? '...' : '↻'}
                    </button>
                  </div>
                  <div className="status-dropdown-body">
                    <div className="status-item">
                      <span className="status-label">Immich Connection</span>
                      <span className={`status-val ${status?.immich?.status === 'connected' ? 'ok' : 'error'}`}>
                        {status?.immich?.status === 'connected' ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    <div className="status-item">
                      <span className="status-label">Config Integrity</span>
                      <span className={`status-val ${status?.config?.status === 'valid' ? 'ok' : 'error'}`}>
                        {status?.config?.status === 'valid' ? 'Valid' : 'Degraded'}
                      </span>
                    </div>
                    <div className="status-item">
                      <span className="status-label">Config Backups</span>
                      <span className="status-val">{status?.backups?.count ?? 0} Backups</span>
                    </div>
                    <div className="status-item">
                      <span className="status-label">Latest Backup</span>
                      <span className="status-val" title={status?.backups?.lastBackup || 'None'}>
                        {status?.backups?.lastBackup ? new Date(status.backups.lastBackup).toLocaleDateString() : 'None'}
                      </span>
                    </div>
                    <div className="status-item">
                      <span className="status-label">In-Memory Cache</span>
                      <span className="status-val">{status?.cache?.size ?? 0} items</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-btn admin-btn-ghost"
            title="Open site in new tab"
          >
            ↗ Site
          </a>
          <button
            className="admin-btn admin-btn-ghost"
            onClick={handleReload}
            disabled={saving}
            title="Reload config & clear cache"
          >
            ↻ Reload
          </button>
          <button className="admin-btn admin-btn-ghost" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="admin-main">
        {activeTab === 'pages' && <PageBuilder />}
        {activeTab === 'settings' && <SettingsEditor />}
      </main>
    </div>
  );
}
