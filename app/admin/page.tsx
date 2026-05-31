'use client';

import { useState, useEffect } from 'react';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import './admin.css';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch('/api/admin/auth');
      const data = await res.json();
      setAuthenticated(data.authenticated);
      setEnabled(data.enabled);
    } catch {
      setAuthenticated(false);
    }
  }

  if (authenticated === null) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="admin-disabled">
        <div className="admin-disabled-card">
          <h1>Admin Panel</h1>
          <p>
            The admin panel is not enabled. Set <code>ADMIN_PASSWORD</code> in your environment
            variables to activate it.
          </p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <AdminLogin onSuccess={() => setAuthenticated(true)} />;
  }

  return <AdminDashboard onLogout={() => setAuthenticated(false)} />;
}
