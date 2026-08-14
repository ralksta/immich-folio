'use client';

import { useState, useEffect, useCallback } from 'react';
import AssetPicker from './AssetPicker';
import SaveBar from './SaveBar';
import * as Icons from './Icons';

interface AboutState {
  portrait?: string;
  name: string;
  location: string;
  gear: string[];
  body: string;
  enabled: boolean;
}

const EMPTY: AboutState = {
  portrait: undefined,
  name: '',
  location: '',
  gear: [],
  body: '',
  enabled: true,
};

export default function AboutEditor() {
  const [about, setAbout] = useState<AboutState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    loadAbout();
  }, []);

  // ── Keyboard shortcut: ⌘+S / Ctrl+S ─────────────────────────
  const handleSaveRef = useCallback(() => {
    if (dirty && !saving) {
      handleSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving, about]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveRef();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveRef]);

  // ── Unsaved changes guard ────────────────────────────────────
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  async function loadAbout() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/about');
      if (res.ok) {
        const { about: data } = await res.json();
        setAbout({
          portrait: data.portrait,
          name: data.name || '',
          location: data.location || '',
          gear: Array.isArray(data.gear) ? data.gear : [],
          body: data.body || '',
          enabled: data.enabled !== false,
        });
      }
    } catch (err) {
      console.error('Failed to load about content:', err);
    } finally {
      setLoading(false);
    }
  }

  function update(patch: Partial<AboutState>) {
    setAbout((a) => ({ ...a, ...patch }));
    setDirty(true);
    setSaveMessage('');
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage('');

    const payload: AboutState = {
      portrait: about.portrait,
      name: about.name.trim(),
      location: about.location.trim(),
      gear: about.gear.map((g) => g.trim()).filter(Boolean),
      body: about.body,
      enabled: about.enabled,
    };

    try {
      const res = await fetch('/api/admin/about', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ about: payload }),
      });

      if (res.ok) {
        const data = await res.json();
        setAbout(payload);
        setDirty(false);
        setSaveMessage(data.message || 'Saved!');
        setTimeout(() => setSaveMessage(''), 5000);
      } else {
        const err = await res.json();
        setSaveMessage(`Error: ${err.error}`);
      }
    } catch {
      setSaveMessage('Error: Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function setGearItem(index: number, value: string) {
    setAbout((a) => {
      const gear = [...a.gear];
      gear[index] = value;
      return { ...a, gear };
    });
    setDirty(true);
    setSaveMessage('');
  }

  function removeGearItem(index: number) {
    setAbout((a) => ({ ...a, gear: a.gear.filter((_, i) => i !== index) }));
    setDirty(true);
    setSaveMessage('');
  }

  function addGearItem() {
    setAbout((a) => ({ ...a, gear: [...a.gear, ''] }));
    setDirty(true);
    setSaveMessage('');
  }

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
      </div>
    );
  }

  return (
    <div className="about-editor">
      <SaveBar
        dirty={dirty}
        saving={saving}
        saveMessage={saveMessage}
        onSave={handleSave}
        label="Save About Page"
      />

      <div className="settings-panel">
        <div className="settings-section-header">
          <h3>
            <Icons.IconUser size={18} /> About Page
          </h3>
          <p className="settings-section-sub">
            Configure the profile photo, name, location, gear list and biography shown at /about.
          </p>
        </div>

        {/* ── Visibility ─────────────────────────────────── */}
        <div className="admin-field" style={{ marginTop: '1rem' }}>
          <label>Page Visibility Status</label>
          <button
            type="button"
            className={`admin-toggle-card ${about.enabled ? 'active' : ''}`}
            onClick={() => update({ enabled: !about.enabled })}
            style={{
              padding: '10px 14px',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <div className="toggle-card-info" style={{ textAlign: 'left' }}>
              <span className="toggle-card-title" style={{ fontWeight: 600 }}>
                <span
                  className={`page-status-dot ${about.enabled ? 'is-on' : 'is-off'}`}
                  aria-hidden="true"
                />
                {about.enabled ? 'Page Active (Published)' : 'Page Disabled (Hidden)'}
              </span>
              <span
                className="toggle-card-desc"
                style={{ fontSize: '0.8rem', display: 'block', opacity: 0.75 }}
              >
                {about.enabled
                  ? 'Visible in the header menu and reachable via URL'
                  : 'Hidden from navigation menu. Returns 404 if accessed directly.'}
              </span>
            </div>
            <div className={`switch-toggle ${about.enabled ? 'on' : ''}`}>
              <span className="switch-slider" />
            </div>
          </button>
        </div>

        <div className="settings-section-divider" />

        {/* ── Profile Photo ─────────────────────────────────── */}
        <div className="admin-field">
          <label>Profile Photo</label>
          <div className="about-portrait-row">
            <div className="about-portrait-preview">
              {about.portrait ? (
                <img src={`/api/admin/thumbnail/${about.portrait}`} alt="" />
              ) : (
                <div className="about-portrait-empty">
                  <Icons.IconUser size={28} />
                </div>
              )}
            </div>
            <div className="about-portrait-actions">
              <button
                type="button"
                className="admin-btn admin-btn-sm"
                onClick={() => setShowPicker(true)}
              >
                <Icons.IconImage size={14} /> {about.portrait ? 'Change Photo' : 'Select Photo'}
              </button>
              {about.portrait && (
                <button
                  type="button"
                  className="admin-btn admin-btn-sm admin-btn-ghost"
                  onClick={() => update({ portrait: undefined })}
                >
                  <Icons.IconTrash size={14} /> Remove
                </button>
              )}
              <span className="admin-field-hint">
                Uses the same photo selector as the homepage hero. A portrait asset ID can also be
                pasted directly.
              </span>
            </div>
          </div>
        </div>

        <div className="settings-section-divider" />

        <div className="admin-field-row">
          <div className="admin-field">
            <label>Name</label>
            <input
              value={about.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Jane Doe"
            />
          </div>
          <div className="admin-field">
            <label>Location</label>
            <input
              value={about.location}
              onChange={(e) => update({ location: e.target.value })}
              placeholder="Anytown, USA"
            />
          </div>
        </div>

        <div className="settings-section-divider" />

        {/* ── Biography ──────────────────────────────────────── */}
        <div className="admin-field">
          <label>Biography</label>
          <textarea
            value={about.body}
            onChange={(e) => update({ body: e.target.value })}
            placeholder={'Photographer based in Anytown, USA.\nObsessed with light, geometry, and the quiet in-between.'}
            rows={6}
          />
          <span className="admin-field-hint">
            One paragraph per line. Blank lines are ignored on the public page.
          </span>
        </div>

        <div className="settings-section-divider" />

        {/* ── Gear ───────────────────────────────────────────── */}
        <div className="admin-field">
          <label>Gear</label>
          <div className="about-gear-list">
            {about.gear.map((item, i) => (
              <div className="about-gear-row" key={i}>
                <input
                  value={item}
                  onChange={(e) => setGearItem(i, e.target.value)}
                  placeholder="e.g. Leica Q3"
                />
                <button
                  type="button"
                  className="admin-btn-icon admin-btn-icon-danger"
                  onClick={() => removeGearItem(i)}
                  title="Remove gear item"
                >
                  <Icons.IconTrash size={14} />
                </button>
              </div>
            ))}
            {about.gear.length === 0 && <p className="empty-hint">No gear listed.</p>}
            <button type="button" className="admin-btn admin-btn-sm" onClick={addGearItem}>
              <Icons.IconPlus size={14} /> Add Gear Item
            </button>
          </div>
        </div>
      </div>

      {showPicker && (
        <AssetPicker
          onSelect={(assetId) => {
            update({ portrait: assetId });
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
          currentAssetIds={about.portrait ? [about.portrait] : []}
          title="Select Profile Photo"
        />
      )}
    </div>
  );
}
