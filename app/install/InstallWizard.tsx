'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import '../admin/admin.css';
import './install.css';

interface Album {
  id: string;
  albumName: string;
  assetCount: number;
  description: string;
}

interface Props {
  initialApiUrl: string;
  setupToken: string;
}

const STEPS = ['Connect', 'Albums', 'Site', 'Finish'] as const;

const THEME_OPTIONS = [
  { value: 'studio', label: 'Studio', description: 'Classic portfolio, red accent' },
  { value: 'studio-modern', label: 'Studio Modern', description: 'Clean with soft corners' },
  { value: 'minimal', label: 'Minimal', description: 'Bare-bones, monochrome' },
  { value: 'editorial', label: 'Editorial', description: 'Magazine-style serif' },
  { value: 'classic', label: 'Classic', description: 'Warm gold, traditional' },
  { value: 'noir', label: 'Noir', description: 'Dark, high-contrast' },
  { value: 'monograph', label: 'Monograph', description: 'Typographic, text-first' },
];

export function InstallWizard({ initialApiUrl, setupToken }: Props) {
  const [step, setStep] = useState(0);

  // Step 1 — connection
  const [apiUrl, setApiUrl] = useState(initialApiUrl);
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState('');

  // Step 2 — album selection (optional)
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState(false);

  // Step 3 — site settings
  const [siteTitle, setSiteTitle] = useState('');
  const [siteSubtitle, setSiteSubtitle] = useState('');
  const [theme, setTheme] = useState('studio');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirm, setAdminConfirm] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Step 4 — finish
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState('');
  const [done, setDone] = useState(false);

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const filteredAlbums = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return albums;
    return albums.filter((a) => a.albumName.toLowerCase().includes(q));
  }, [albums, search]);

  async function testConnection() {
    setTesting(true);
    setTestError('');
    try {
      const res = await fetch('/api/install/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-setup-token': setupToken },
        body: JSON.stringify({ apiUrl: apiUrl.trim(), apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestError(data.error || 'Could not connect to Immich');
        return;
      }
      setAlbums(data.albums || []);
      setLoaded(true);
      setStep(1);
    } catch {
      setTestError('Could not reach the install service');
    } finally {
      setTesting(false);
    }
  }

  function toggleAlbum(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function validateSiteStep(): boolean {
    if (adminPassword && adminPassword !== adminConfirm) {
      setPasswordError('Passwords do not match');
      return false;
    }
    setPasswordError('');
    return true;
  }

  async function runInstall() {
    setInstalling(true);
    setInstallError('');
    try {
      const res = await fetch('/api/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-setup-token': setupToken },
        body: JSON.stringify({
          apiUrl: apiUrl.trim(),
          apiKey: apiKey.trim(),
          siteTitle,
          siteSubtitle,
          theme,
          albums: Object.keys(selected).filter((id) => selected[id]),
          ...(adminPassword ? { adminPassword } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInstallError(data.error || 'Install failed');
        return;
      }
      setDone(true);
    } catch {
      setInstallError('Could not reach the install service');
    } finally {
      setInstalling(false);
    }
  }

  if (done) {
    return (
      <div className="admin-layout">
        <div className="install-page">
          <div className="install-card">
            <div className="install-card__header">
              <span className="install-card__kicker">Immich Folio</span>
              <h1>Install complete</h1>
              <p>Your portfolio is ready. Add or rearrange albums any time from the admin panel.</p>
            </div>
            <div className="install-actions">
              <Link className="admin-btn admin-btn-primary" href="/">
                Visit your gallery
              </Link>
              {adminPassword && (
                <Link className="admin-btn" href="/admin">
                  Open admin panel
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <div className="install-page">
        <div className="install-card">
          <div className="install-card__header">
            <span className="install-card__kicker">Immich Folio</span>
            <h1>Install wizard</h1>
            <p>Connect your Immich server, choose what to show, and publish your portfolio.</p>
          </div>

          <ol className="install-steps" aria-label="Install steps">
            {STEPS.map((label, i) => (
              <li key={label} className={i < step ? 'is-done' : i === step ? 'is-active' : ''}>
                <span className="install-steps__dot">{i < step ? '✓' : i + 1}</span>
                <span className="install-steps__label">{label}</span>
              </li>
            ))}
          </ol>

          <div className="install-body">
            {step === 0 && (
              <form
                className="install-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  testConnection();
                }}
              >
                <div className="admin-field">
                  <label htmlFor="install-url">Immich server URL</label>
                  <input
                    id="install-url"
                    type="url"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://photos.example.com"
                    required
                    autoFocus
                    disabled={testing}
                  />
                  <p className="admin-hint">
                    The base URL of your Immich instance (no /api). Example:{' '}
                    <code>https://photos.example.com</code>
                  </p>
                </div>

                <div className="admin-field">
                  <label htmlFor="install-key">Immich API key</label>
                  <input
                    id="install-key"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Your Immich API key"
                    required
                    disabled={testing}
                  />
                  <p className="admin-hint">
                    Create one in Immich under Admin Settings → API Keys.
                  </p>
                </div>

                {testError && <div className="admin-error">{testError}</div>}

                <div className="install-actions">
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary"
                    disabled={testing || !apiUrl || !apiKey}
                  >
                    {testing ? 'Testing connection…' : 'Test connection & continue'}
                  </button>
                </div>
              </form>
            )}

            {step === 1 && (
              <div className="install-albums">
                <p className="admin-hint">
                  Pick albums to publish. This step is <strong>optional</strong> — you can add
                  albums later from the admin panel.
                </p>

                {albums.length === 0 ? (
                  <div className="install-empty">
                    <p>
                      {loaded
                        ? 'No shared albums found on this Immich server.'
                        : 'Albums could not be loaded.'}
                    </p>
                    <p className="admin-hint">
                      Immich only lists albums that have been shared. You can still continue and add
                      them later.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="admin-field">
                      <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search albums…"
                        aria-label="Search albums"
                      />
                    </div>

                    <ul className="install-albums__list">
                      {filteredAlbums.map((album) => (
                        <li key={album.id}>
                          <label className="install-albums__item">
                            <input
                              type="checkbox"
                              checked={!!selected[album.id]}
                              onChange={() => toggleAlbum(album.id)}
                            />
                            <span className="install-albums__name">{album.albumName}</span>
                            <span className="install-albums__meta">
                              {album.assetCount} photo{album.assetCount === 1 ? '' : 's'}
                            </span>
                          </label>
                        </li>
                      ))}
                      {filteredAlbums.length === 0 && (
                        <li className="install-empty">No albums match “{search}”.</li>
                      )}
                    </ul>
                  </>
                )}

                <div className="install-actions">
                  <button className="admin-btn" onClick={() => setStep(0)} disabled={installing}>
                    Back
                  </button>
                  <button
                    className="admin-btn admin-btn-primary"
                    onClick={() => setStep(2)}
                    disabled={installing}
                  >
                    {selectedCount > 0
                      ? `Continue with ${selectedCount} album${selectedCount === 1 ? '' : 's'}`
                      : 'Skip — continue with no albums'}
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <form
                className="install-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (validateSiteStep()) setStep(3);
                }}
              >
                <div className="admin-field">
                  <label htmlFor="install-title">Site title</label>
                  <input
                    id="install-title"
                    type="text"
                    value={siteTitle}
                    onChange={(e) => setSiteTitle(e.target.value)}
                    placeholder="My Photography"
                    autoFocus
                  />
                </div>

                <div className="admin-field">
                  <label htmlFor="install-subtitle">Subtitle</label>
                  <input
                    id="install-subtitle"
                    type="text"
                    value={siteSubtitle}
                    onChange={(e) => setSiteSubtitle(e.target.value)}
                    placeholder="A visual journal"
                  />
                </div>

                <div className="admin-field">
                  <label htmlFor="install-theme">Theme</label>
                  <select
                    id="install-theme"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                  >
                    {THEME_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <p className="admin-hint">
                    {THEME_OPTIONS.find((t) => t.value === theme)?.description}
                  </p>
                </div>

                <div className="install-divider">
                  <span>Optional — admin panel</span>
                </div>

                <div className="admin-field">
                  <label htmlFor="install-admin-password">Admin password</label>
                  <input
                    id="install-admin-password"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Leave empty to disable the admin panel"
                  />
                </div>

                {adminPassword && (
                  <div className="admin-field">
                    <label htmlFor="install-admin-confirm">Repeat admin password</label>
                    <input
                      id="install-admin-confirm"
                      type="password"
                      value={adminConfirm}
                      onChange={(e) => setAdminConfirm(e.target.value)}
                      placeholder="Repeat the password"
                    />
                  </div>
                )}

                {passwordError && <div className="admin-error">{passwordError}</div>}

                <div className="install-actions">
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => setStep(1)}
                    disabled={installing}
                  >
                    Back
                  </button>
                  <button type="submit" className="admin-btn admin-btn-primary">
                    Review install
                  </button>
                </div>
              </form>
            )}

            {step === 3 && (
              <div className="install-review">
                <dl className="install-review__list">
                  <div>
                    <dt>Immich server</dt>
                    <dd>{apiUrl}</dd>
                  </div>
                  <div>
                    <dt>Albums</dt>
                    <dd>
                      {selectedCount > 0
                        ? `${selectedCount} selected`
                        : 'None — you can add them later'}
                    </dd>
                  </div>
                  <div>
                    <dt>Site title</dt>
                    <dd>{siteTitle || 'Gallery'}</dd>
                  </div>
                  <div>
                    <dt>Theme</dt>
                    <dd>{THEME_OPTIONS.find((t) => t.value === theme)?.label}</dd>
                  </div>
                  <div>
                    <dt>Admin panel</dt>
                    <dd>{adminPassword ? 'Enabled' : 'Disabled'}</dd>
                  </div>
                </dl>

                {installError && <div className="admin-error">{installError}</div>}

                <div className="install-actions">
                  <button className="admin-btn" onClick={() => setStep(2)} disabled={installing}>
                    Back
                  </button>
                  <button
                    className="admin-btn admin-btn-primary"
                    onClick={runInstall}
                    disabled={installing}
                  >
                    {installing ? 'Installing…' : 'Install'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
