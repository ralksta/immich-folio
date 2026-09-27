'use client';

import { useState } from 'react';
import * as Icons from '../Icons';
import ToggleCard from '../fields/ToggleCard';
import type { SaveStatus } from '../SaveBar';
import { resolveExifDisplay } from '@/lib/config/schema';
import { SUPPORTED_LOCALES } from '@/lib/i18n';
import { FeatureGroup, SettingRow } from './fields';
import type { SectionProps } from './types';
import { useConfirm } from '../ConfirmDialog';

export default function GeneralSection({ settings, update, updateMany }: SectionProps) {
  const confirm = useConfirm();
  // Collapsed by default: the four metadata switches are a detail of one
  // decision, and showing them permanently is what made the section a wall (#510).
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [faviconStatus, setFaviconStatus] = useState<SaveStatus>(null);

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
        <label>Site Title</label>
        <input
          value={settings.title || ''}
          onChange={(e) => update('title', e.target.value)}
          placeholder="My Portfolio"
        />
      </div>
      <div className="admin-field">
        <label>Subtitle</label>
        <input
          value={settings.subtitle || ''}
          onChange={(e) => update('subtitle', e.target.value)}
          placeholder="A visual journal"
        />
      </div>
      <div className="admin-field">
        <label>Language</label>
        <select
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
          Enable or disable optional portfolio modules, privacy analytics, and map widgets.
        </p>
      </div>

      <FeatureGroup
        icon={<Icons.IconFrame size={13} />}
        title="Pages &amp; motion"
        description="Chrome the visitor sees on every page."
      >
        <div className="admin-toggle-cards-grid">
          <ToggleCard
            icon={<Icons.IconCamera size={16} />}
            title="About Page"
            description="Show a portrait, bio, and gear section on your portfolio"
            checked={settings.about?.enabled !== false}
            onToggle={() => update('about.enabled', settings.about?.enabled === false)}
          />

          <ToggleCard
            icon={<Icons.IconSparkles size={16} />}
            title="Smooth Page Transitions"
            description="Enable subtle fade-in animations between page navigation"
            checked={settings.transitions !== false}
            onToggle={() => update('transitions', settings.transitions === false)}
          />

          <ToggleCard
            icon={<Icons.IconArrowUp size={16} />}
            title="Scroll-to-Top Button"
            description="Show a floating arrow that returns visitors to the top of long pages"
            checked={settings.scrollToTop !== false}
            onToggle={() => update('scrollToTop', settings.scrollToTop === false)}
          />
        </div>
      </FeatureGroup>

      <FeatureGroup
        icon={<Icons.IconShieldCheck size={13} />}
        title="What each photo reveals"
        description="Published to anyone who opens a photo."
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
      </FeatureGroup>

      <FeatureGroup
        icon={<Icons.IconHeart size={13} />}
        title="What visitors can do"
        description="Optional pages and interactions."
      >
        <div className="admin-toggle-cards-grid">
          <ToggleCard
            icon={<Icons.IconMap size={16} />}
            title="Interactive GPS Map"
            description="Enable /map view showing photo locations on a world map"
            checked={settings.map === true}
            onToggle={() => update('map', !settings.map)}
          />

          <ToggleCard
            icon={<Icons.IconHeart size={16} />}
            title="Client Proofing & Favorites"
            description="Allow visitors & clients to heart, filter, and export favorite photo selections"
            checked={settings.proofing?.enabled !== false}
            onToggle={() => update('proofing.enabled', settings.proofing?.enabled === false)}
          />
        </div>
      </FeatureGroup>

      <FeatureGroup
        icon={<Icons.IconBarChart size={13} />}
        title="Measurement"
        description="Cookieless and self-hosted — nothing leaves your server."
      >
        <div className="admin-toggle-cards-grid">
          <ToggleCard
            icon={<Icons.IconBarChart size={16} />}
            title="Analytics Tracking"
            description="Collect anonymous privacy-friendly visit statistics"
            checked={settings.analytics !== false}
            onToggle={() => update('analytics', settings.analytics === false)}
          />
        </div>
      </FeatureGroup>

      <div className="admin-field favicon-field">
        <label>Favicon</label>
        <div className="favicon-row">
          <input
            type="file"
            accept=".svg,.png,.ico,.jpg,.jpeg"
            disabled={faviconUploading}
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
              } catch {
                setFaviconStatus({ kind: 'error', message: 'Error: Upload failed' });
              } finally {
                setFaviconUploading(false);
                e.target.value = '';
              }
            }}
          />
          <button
            type="button"
            className="admin-btn"
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
        <span className="admin-field-hint">
          SVG, PNG, ICO, or JPEG — max 512 kB. Stored in the content volume. Reset restores the
          bundled default.
        </span>
      </div>
    </div>
  );
}
