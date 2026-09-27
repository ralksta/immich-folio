'use client';

/**
 * The settings form: loading, the section nav, dirty tracking and saving.
 * Each section is its own component in ./settings/ (#554) and edits the one
 * `settings` object through `update()`; About brings its own file and save
 * path through useAboutEditor().
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SaveBar, { type SaveStatus } from './SaveBar';
import { useUnsavedGuard } from './useUnsavedGuard';
import { useDraft } from './useDraft';
import DraftNotice from './DraftNotice';
import { useContentRestored } from './contentRestored';
import { reportIfSessionExpired } from './sessionExpiry';
import type { Settings, SectionProps } from './settings/types';
import GeneralSection from './settings/GeneralSection';
import ThemeSection from './settings/ThemeSection';
import GridSection from './settings/GridSection';
import FooterSection from './settings/FooterSection';
import LegalSection from './settings/LegalSection';
import SeoSection from './settings/SeoSection';
import SecuritySection from './settings/SecuritySection';
import AboutSection, { useAboutEditor } from './settings/AboutSection';
import PageHeader from './PageHeader';

const SETTINGS_SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'theme', label: 'Theme' },
  { id: 'grid', label: 'Grid' },
  { id: 'footer', label: 'Footer' },
  { id: 'legal', label: 'Legal' },
  { id: 'seo', label: 'SEO' },
  { id: 'security', label: 'Security & Protection' },
  { id: 'about', label: 'About' },
];

function withoutSitePassword(settings: Settings): Settings {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sitePassword, ...rest } = settings;
  return rest;
}

function withSitePasswordOf(draft: Settings, source: Settings): Settings {
  return source.sitePassword === undefined
    ? draft
    : { ...draft, sitePassword: source.sitePassword };
}

export default function SettingsEditor() {
  const router = useRouter();
  // Read here rather than passed in: the editor is mounted by the settings
  // layout, which does not receive the child route's params.
  const section = useParams<{ section?: string }>()?.section;
  // An unknown section in the URL falls back to General instead of an empty panel.
  const activeSection = SETTINGS_SECTIONS.some((sec) => sec.id === section)
    ? (section as string)
    : 'general';
  const [settings, setSettings] = useState<Settings>({});
  /** Resolved site URL and its origin, so the panel can name SITE_URL (#472). */
  const [siteUrlInfo, setSiteUrlInfo] = useState<{
    effective: string | null;
    source: 'env' | 'settings' | 'none';
  } | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * Set when the settings could not be fetched. It blocks saving, because an
   * empty form saved over a live settings.yaml replaces it with whatever one
   * field the user happened to touch.
   */
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null);

  const about = useAboutEditor(activeSection === 'about');

  // Unsaved edits survive a tab switch, Reload or Logout the way the page
  // builder's and the journal's do (#592) — useUnsavedGuard only covers
  // leaving the browser.
  const [serverSettings, setServerSettings] = useState<Settings>({});
  // The draft never sees `sitePassword`: sessionStorage is readable by any
  // script on the admin origin, and until it is saved (and hashed) the field
  // holds the password as typed. A restored draft takes the password from the
  // server instead; a new one is typed again after a reload.
  const settingsDraft = useDraft<Settings>('settings', withoutSitePassword(settings), dirty);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A restored settings.yaml replaces what this editor loaded. (About handles
  // its own file in useAboutEditor.)
  useContentRestored(({ target }) => {
    if (target === 'settings') loadSettings();
  });

  // Sync picked preset & accent color to document element immediately for live feedback
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (settings.theme?.preset) {
        document.documentElement.setAttribute('data-preset', settings.theme.preset);
      }
      if (settings.theme?.accent) {
        document.documentElement.style.setProperty('--accent', settings.theme.accent);
        document.documentElement.style.setProperty('--admin-accent', settings.theme.accent);
      }
    }
  }, [settings.theme?.preset, settings.theme?.accent]);

  // ── Keyboard shortcut: ⌘+S / Ctrl+S ─────────────────────────
  const handleSaveRef = useCallback(() => {
    saveAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving, settings, about]);

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

  useUnsavedGuard(dirty || about.dirty);

  async function loadSettings() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) {
        // 401 is the common one: the session lasts 24h and nothing re-checks
        // it, so a tab left open overnight lands here. reportIfSessionExpired
        // also drops the whole panel back to the login screen (#596); the
        // thrown message below still covers the brief moment before that
        // re-render happens, and any other non-ok status.
        reportIfSessionExpired(res);
        throw new Error(
          res.status === 401
            ? 'Your session has expired. Sign in again to continue.'
            : `The server answered ${res.status}.`,
        );
      }
      const { settings: data, siteUrl } = await res.json();
      const loaded: Settings = data || {};
      setServerSettings(loaded);
      const restoredDraft = settingsDraft.load(JSON.stringify(withoutSitePassword(loaded)));
      const restored = restoredDraft && withSitePasswordOf(restoredDraft, loaded);
      setSettings(restored ?? loaded);
      setDirty(restored !== null);
      setSiteUrlInfo(siteUrl ?? null);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setLoadError(err instanceof Error ? err.message : 'The settings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  /** Write several paths in one state update — used by the metadata master switch. */
  function updateMany(entries: Record<string, unknown>) {
    setSettings((s) => {
      const copy = JSON.parse(JSON.stringify(s));
      for (const [path, value] of Object.entries(entries)) {
        const parts = path.split('.');
        let obj = copy;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!obj[parts[i]]) obj[parts[i]] = {};
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
      }
      return copy;
    });
    setDirty(true);
    setSaveStatus(null);
  }

  function update(path: string, value: unknown) {
    setSettings((s) => {
      const copy = JSON.parse(JSON.stringify(s));
      const parts = path.split('.');
      let obj = copy;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      const key = parts[parts.length - 1];
      if (value === '' || value === undefined) {
        delete obj[key];
      } else {
        obj[key] = value;
      }
      return copy;
    });
    setDirty(true);
    setSaveStatus(null);
  }

  async function handleSave() {
    // The form is not rendered in this state, but Cmd+S still reaches here.
    if (loadError) return;

    setSaving(true);
    setSaveStatus(null);

    // Clean up empty objects
    const cleaned = JSON.parse(JSON.stringify(settings));
    for (const key of Object.keys(cleaned)) {
      if (typeof cleaned[key] === 'object' && Object.keys(cleaned[key]).length === 0) {
        delete cleaned[key];
      }
    }

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: cleaned }),
      });

      if (res.ok) {
        const data = await res.json();
        // The site password is stored hashed (#690); show that, not the typed text.
        const stored: Settings =
          typeof data.sitePassword === 'string'
            ? { ...cleaned, sitePassword: data.sitePassword }
            : cleaned;
        if (typeof data.sitePassword === 'string') {
          setSettings((s) => ({ ...s, sitePassword: data.sitePassword }));
        }
        setServerSettings(stored);
        settingsDraft.saved(JSON.stringify(withoutSitePassword(stored)));
        setDirty(false);
        setSaveStatus({ kind: 'success', message: data.message || 'Saved!' });
        router.refresh();
        setTimeout(() => setSaveStatus(null), 5000);
      } else if (!reportIfSessionExpired(res)) {
        const err = await res.json();
        // A rejected save names the fields that caused it. Listing them beats
        // "could not be saved" over a form with forty inputs; putting the
        // message next to each input is the job of #600.
        const fields: string[] = Array.isArray(err.fields)
          ? err.fields.map((f: { field?: string }) => f.field || 'settings')
          : [];
        setSaveStatus({
          kind: 'error',
          message: `Error: ${err.error}${fields.length ? ` — ${fields.join(', ')}` : ''}`,
        });
      }
    } catch {
      setSaveStatus({ kind: 'error', message: 'Error: Failed to save' });
    } finally {
      setSaving(false);
    }
  }

  /**
   * Save whatever is unsaved, in either file. The owner edits one set of
   * settings; that About lives in about.md and the rest in settings.yaml is
   * not theirs to keep track of.
   */
  function saveAll() {
    if (dirty && !saving) handleSave();
    if (about.dirty && !about.saving) about.save();
  }

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
      </div>
    );
  }

  /**
   * Deliberately replaces the form rather than sitting above it. An empty form
   * is indistinguishable from a site with no settings yet, and editing one
   * field in it used to publish that field as the entire settings.yaml.
   */
  if (loadError) {
    return (
      <div className="admin-error" role="alert">
        <strong>Settings could not be loaded.</strong> {loadError}
        <p>
          Nothing has been changed. Saving stays disabled until they load, so an empty form cannot
          overwrite your configuration.
        </p>
        <button className="admin-btn admin-btn-secondary" onClick={loadSettings}>
          Try again
        </button>
      </div>
    );
  }

  // An error from either save wins over the other's success.
  const saveBarStatus: SaveStatus =
    [saveStatus, about.status].find((st) => st?.kind === 'error') ?? saveStatus ?? about.status;

  const props: SectionProps = { settings, update, updateMany };

  return (
    <div className="settings-editor">
      {/* One bar for both files, on every section: an About edit stays visible
          from Theme, and a settings edit from About. */}
      <SaveBar
        dirty={dirty || about.dirty}
        saving={saving || about.saving}
        status={saveBarStatus}
        onSave={saveAll}
        label="Save Changes"
      />

      <DraftNotice
        status={settingsDraft.status}
        subject="settings"
        onDiscard={() => {
          settingsDraft.discard();
          setSettings(serverSettings);
          setDirty(false);
          setSaveStatus(null);
        }}
        onRestore={() => {
          const value = settingsDraft.takeConflicting();
          if (!value) return;
          setSettings(withSitePasswordOf(value, serverSettings));
          setDirty(true);
        }}
        onDismiss={settingsDraft.dismiss}
      />
      <DraftNotice
        status={about.draftStatus}
        subject="About page"
        onDiscard={about.discardDraft}
        onRestore={about.restoreDraft}
        onDismiss={about.dismissDraft}
      />

      <PageHeader
        kicker="Site"
        title="Settings"
        description="Saved changes apply to the site at once, no restart needed."
      />

      <div className="settings-layout">
        {/* Sidebar */}
        <nav className="settings-nav">
          {SETTINGS_SECTIONS.map((sec) => (
            <Link
              key={sec.id}
              href={`/admin/settings/${sec.id}`}
              className={`settings-nav-item ${activeSection === sec.id ? 'active' : ''}`}
              aria-current={activeSection === sec.id ? 'page' : undefined}
            >
              {sec.label}
            </Link>
          ))}
        </nav>

        {/* Content */}
        <div className="settings-content">
          {activeSection === 'general' && <GeneralSection {...props} />}
          {activeSection === 'theme' && <ThemeSection {...props} />}
          {activeSection === 'grid' && <GridSection {...props} />}
          {activeSection === 'footer' && <FooterSection {...props} />}
          {activeSection === 'legal' && <LegalSection {...props} />}
          {activeSection === 'seo' && <SeoSection {...props} siteUrlInfo={siteUrlInfo} />}
          {activeSection === 'security' && <SecuritySection {...props} />}
          {activeSection === 'about' && <AboutSection about={about} />}
        </div>
      </div>
    </div>
  );
}
