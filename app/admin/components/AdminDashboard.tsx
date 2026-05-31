'use client';

import { useState } from 'react';
import PageBuilder from './PageBuilder';
import SettingsEditor from './SettingsEditor';

interface Props {
  onLogout: () => void;
}

type Tab = 'pages' | 'settings';

export default function AdminDashboard({ onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('pages');
  const [saving, setSaving] = useState(false);

  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    onLogout();
  }

  async function handleReload() {
    setSaving(true);
    try {
      await fetch('/api/admin/reload', { method: 'POST' });
    } finally {
      setSaving(false);
    }
  }

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
