'use client';

import { useState } from 'react';
import * as Icons from '../Icons';
import type { SaveStatus } from '../SaveBar';
import { resolveExifDisplay } from '@/lib/config/schema';
import { SUPPORTED_LOCALES, getDictionary, resolveLocale } from '@/lib/i18n';
import { FeatureGroup, FeatureRow, SettingRow } from './fields';
import type { SectionProps } from './types';
import { useConfirm } from '../ConfirmDialog';

export default function GeneralSection({
  settings,
  update,
  updateMany,
  siteTitleEnv,
}: SectionProps & { siteTitleEnv?: string | null }) {
  const confirm = useConfirm();
  // What the site shows while the field is empty, resolved as getConfig does:
  // SITE_TITLE, else the site language's word for a gallery (QA A-15).
  const fallbackTitle = siteTitleEnv || getDictionary(resolveLocale(settings.lang)).common.gallery;
  // Collapsed by default: the four metadata switches are a detail of one
  // decision, and showing them permanently is what made the section a wall (#510).
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [faviconStatus, setFaviconStatus] = useState<SaveStatus>(null);
  /** Bumped after an upload or reset so the preview fetches the new icon. */
  const [faviconVersion, setFaviconVersion] = useState(0);

  // Resolved the same way the site resolves it, so the switches show what a
  // visitor actually sees — including a config that only ever set the older
  // `exifOnHover`.
  const exif = resolveExifDisplay(settings.exif, settings.exifOnHover);

  // The master switch has no key of its own and needs none: "off" is all four
  // groups off, a state the site already acts on — with nothing left to show,
  // the lightbox withdraws its info button and the `i` key entirely (#506).
  const anyMetadata = exif.camera || exif.settings || exif.location || exif.caption;
  const metadataSummary =
    [
      exif.camera && 'Camera & lens',
      exif.settings && 'Exposure',
      exif.location && 'Location',
      exif.caption && 'Description',
    ]
      .filter(Boolean)
      .join(' · ') || 'Nothing published — the lightbox hides its info panel';

  /** Turning it back on selects everything; the details below narrow it again. */
  const toggleMetadata = () =>
    updateMany({
      'exif.camera': !anyMetadata,
      'exif.settings': !anyMetadata,
      'exif.location': !anyMetadata,
      'exif.caption': !anyMetadata,
    });

  return (
    <div className="settings-panel">
      <div className="settings-section-header">
        <h3>
          <Icons.IconGear size={18} /> General Site Settings
        </h3>
        <p className="settings-section-sub">
          Configure basic site identity, language, and core feature toggles.
        </p>
      </div>

      <div className="admin-field">
        <label htmlFor="general-site-title">Site Title</label>
        <input
          id="general-site-title"
          value={settings.title || ''}
          onChange={(e) => update('title', e.target.value)}
          placeholder={fallbackTitle}
          aria-describedby="general-site-title-hint"
        />
        <p id="general-site-title-hint" className="admin-field-hint">
          {settings.title
            ? 'Shown in the header, the browser tab and link previews.'
            : `Empty, so the site shows “${fallbackTitle}”${siteTitleEnv ? ', from SITE_TITLE' : ''}.`}
        </p>
      </div>
      <div className="admin-field">
        <label htmlFor="general-subtitle">Subtitle</label>
        <input
          id="general-subtitle"
          value={settings.subtitle || ''}
          onChange={(e) => update('subtitle', e.target.value)}
          placeholder="A visual journal"
        />
      </div>
      <div className="admin-field">
        <label htmlFor="general-language">Language</label>
        <select
          id="general-language"
          aria-label="Language"
          value={settings.lang || 'en'}
          onChange={(e) => update('lang', e.target.value)}
        >
          <option value="en">English (US)</option>
          <option value="de">Deutsch (DE)</option>
          <option value="fr">Français (FR)</option>
          <option value="es">Español (ES)</option>
          <option value="it">Italiano (IT)</option>
          <option value="nl">Nederlands (NL)</option>
          <option value="ja">日本語 (JA)</option>
        </select>
        <p className="admin-field-hint">
          The visitor-facing interface is translated for {SUPPORTED_LOCALES.join(', ')}. Other
          languages still set <code>&lt;html lang&gt;</code> and date formatting, but show the
          English interface. The admin panel is always English.
        </p>
      </div>

      <div className="settings-section-divider" />

      <div className="settings-section-header">
        <h3>
          <Icons.IconSparkles size={18} /> Portfolio Features &amp; Modules
        </h3>
        <p className="settings-section-sub">
          Optional pages, and what the site reveals about your photos and counts about visits.
        </p>
      </div>

      <FeatureGroup
        icon={<Icons.IconFrame size={13} />}
        title="Modules"
        description="Each one adds a page or a control visitors can use."
      >
        <div className="feature-list">
          <FeatureRow
            icon={<Icons.IconCamera size={15} />}
            title="About page"
            description="Portrait, bio and gear at /about"
            checked={settings.about?.enabled !== false}
            onToggle={() => update('about.enabled', settings.about?.enabled === false)}
            href="/admin/settings/about"
          />
          <FeatureRow
            icon={<Icons.IconMap size={15} />}
            title="Map"
            description="Photo locations on a world map at /map"
            checked={settings.map === true}
            onToggle={() => update('map', !settings.map)}
          />
          <FeatureRow
            icon={<Icons.IconHeart size={15} />}
            title="Client proofing"
            description="Visitors heart, filter and export a selection of photos"
            checked={settings.proofing?.enabled !== false}
            onToggle={() => update('proofing.enabled', settings.proofing?.enabled === false)}
          />
          <FeatureRow
            icon={<Icons.IconSearch size={15} />}
            title="Photo zoom"
            description="Visitors zoom into a photo to full resolution (1:1) to check sharpness. Pages and albums can override this"
            checked={settings.zoom === true}
            onToggle={() => update('zoom', !settings.zoom)}
          />
        </div>
        {/* Shown even while proofing is off globally: a subpage can switch it
            on for itself (`proofing: true`), so the address still has to be
            settable from here. */}
        <div className="admin-field">
          <label htmlFor="proofing-email">Proofing email</label>
          <input
            id="proofing-email"
            type="email"
            value={settings.proofing?.email || ''}
            onChange={(e) => update('proofing.email', e.target.value)}
            placeholder="Defaults to the footer contact email"
          />
          <p className="admin-field-hint">
            Where &ldquo;Email to photographer&rdquo; sends a selection. Falls back to the footer
            contact email; when neither is set, the button is hidden.
          </p>
        </div>
      </FeatureGroup>

      <FeatureGroup
        icon={<Icons.IconShieldCheck size={13} />}
        title="What visitors learn about you"
        description="What each photo reveals, and what is counted about a visit."
        chip="visible to visitors"
      >
        <div className={`metadata-card ${anyMetadata ? 'active' : ''}`}>
          <button
            type="button"
            className="metadata-card-main"
            onClick={toggleMetadata}
            aria-pressed={anyMetadata}
          >
            <span className="toggle-card-info">
              <span className="toggle-card-title">
                <Icons.IconCamera size={16} /> Photo metadata
              </span>
              <span className="toggle-card-desc">{metadataSummary}</span>
            </span>
            <span className={`switch-toggle ${anyMetadata ? 'on' : ''}`}>
              <span className="switch-slider" />
            </span>
          </button>

          <button
            type="button"
            className="metadata-details-btn"
            onClick={() => setMetadataOpen((open) => !open)}
            aria-expanded={metadataOpen}
          >
            Details
            <Icons.IconChevronDown
              size={13}
              className={`metadata-details-chevron${metadataOpen ? ' open' : ''}`}
            />
          </button>

          {metadataOpen && (
            <div className="metadata-details">
              <SettingRow
                title="Camera &amp; Lens"
                description="Body, lens and focal length"
                checked={exif.camera}
                onToggle={() => update('exif.camera', !exif.camera)}
              />
              <SettingRow
                title="Exposure Settings"
                description="Aperture, shutter speed and ISO"
                checked={exif.settings}
                onToggle={() => update('exif.settings', !exif.settings)}
              />
              <SettingRow
                title="Location"
                description="City and country from the photo's GPS data"
                checked={exif.location}
                onToggle={() => update('exif.location', !exif.location)}
              />
              <SettingRow
                title="Photo Description"
                description="The description written in Immich"
                checked={exif.caption}
                onToggle={() => update('exif.caption', !exif.caption)}
              />

              {/* Dependent, not a peer: this only controls the grid overlay, and
                      the overlay carries camera and lens. With those off it has
                      nothing to show, which used to leave it switched on and
                      silently doing nothing (#510). */}
              <SettingRow
                indented
                title="Summary on grid hover"
                description="Camera and lens over the photo, not only in the lightbox"
                checked={settings.exifOnHover !== false}
                disabled={!exif.camera}
                hint={exif.camera ? undefined : 'Needs Camera & Lens'}
                onToggle={() => update('exifOnHover', settings.exifOnHover === false)}
              />
            </div>
          )}
        </div>
        <div className="feature-list">
          <FeatureRow
            icon={<Icons.IconBarChart size={15} />}
            title="Analytics"
            description="Cookieless view counts, stored on your server only"
            checked={settings.analytics !== false}
            onToggle={() => update('analytics', settings.analytics === false)}
            href="/admin/analytics"
          />
        </div>
      </FeatureGroup>

      <div className="admin-field favicon-field">
        <span className="admin-field-label" id="favicon-label">
          Favicon
        </span>
        <div className="favicon-row">
          {/* eslint-disable-next-line @next/next/no-img-element -- the site's own icon route, a 32px preview */}
          <img
            className="favicon-preview"
            src={`/api/favicon?v=${faviconVersion}`}
            alt="Current favicon"
            width={32}
            height={32}
          />
          {/* The native file input stays the control — focusable, keyboard
              operable, announced as a file picker — but is visually hidden;
              its label is drawn as the admin's secondary button, with the
              focus ring passed through (QA A-18). */}
          <input
            id="favicon-file"
            className="favicon-file-input"
            type="file"
            accept=".svg,.png,.ico,.jpg,.jpeg"
            disabled={faviconUploading}
            aria-labelledby="favicon-label favicon-file-button"
            aria-describedby="favicon-hint"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setFaviconStatus(null);
              setFaviconUploading(true);
              const form = new FormData();
              form.append('file', file);
              try {
                const res = await fetch('/api/admin/favicon', {
                  method: 'PUT',
                  body: form,
                });
                const data = await res.json();
                setFaviconStatus(
                  res.ok
                    ? { kind: 'success', message: data.message }
                    : { kind: 'error', message: `Error: ${data.error}` },
                );
                if (res.ok) setFaviconVersion((v) => v + 1);
              } catch {
                setFaviconStatus({ kind: 'error', message: 'Error: Upload failed' });
              } finally {
                setFaviconUploading(false);
                e.target.value = '';
              }
            }}
          />
          <label
            htmlFor="favicon-file"
            id="favicon-file-button"
            className="admin-btn admin-btn-sm admin-btn-secondary favicon-upload-btn"
          >
            <Icons.IconImage size={14} /> Upload icon
          </label>
          <button
            type="button"
            className="admin-btn admin-btn-sm admin-btn-secondary"
            disabled={faviconUploading}
            onClick={async () => {
              // Deletes the uploaded file at once, outside the staged form.
              const ok = await confirm({
                title: 'Reset the favicon?',
                message: 'The uploaded icon is deleted and the bundled default is used again.',
                confirmLabel: 'Reset',
                danger: true,
              });
              if (!ok) return;
              setFaviconStatus(null);
              setFaviconUploading(true);
              try {
                const res = await fetch('/api/admin/favicon', { method: 'DELETE' });
                const data = await res.json();
                setFaviconStatus(
                  res.ok
                    ? { kind: 'success', message: data.message }
                    : { kind: 'error', message: `Error: ${data.error}` },
                );
                if (res.ok) setFaviconVersion((v) => v + 1);
              } catch {
                setFaviconStatus({ kind: 'error', message: 'Error: Reset failed' });
              } finally {
                setFaviconUploading(false);
              }
            }}
          >
            Reset
          </button>
          {faviconUploading && <div className="admin-spinner" />}
        </div>
        {faviconStatus && (
          <p className={`save-message ${faviconStatus.kind}`}>{faviconStatus.message}</p>
        )}
        <span id="favicon-hint" className="admin-field-hint">
          SVG, PNG, ICO, or JPEG — max 512 kB. Stored in the content volume. Reset restores the
          bundled default.
        </span>
      </div>
    </div>
  );
}
