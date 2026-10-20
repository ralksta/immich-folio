'use client';

import { useState } from 'react';
import * as Icons from '../Icons';
import type { SaveStatus } from '../SaveBar';
import { resolveExifDisplay } from '@/lib/config/schema';
import { SUPPORTED_LOCALES, getDictionary, resolveLocale, type Locale } from '@/lib/i18n';
import { FeatureGroup, FeatureRow, SettingRow } from './fields';
import type { SectionProps } from './types';
import { useConfirm } from '../ConfirmDialog';
import { rich, useAdminDictionary } from '../AdminI18n';

/** Each language in its own name, so it can be found whatever the panel's language. */
const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English (US)',
  de: 'Deutsch (DE)',
  fr: 'Français (FR)',
  es: 'Español (ES)',
  it: 'Italiano (IT)',
  nl: 'Nederlands (NL)',
};

export default function GeneralSection({
  settings,
  update,
  updateMany,
  siteTitleEnv,
}: SectionProps & { siteTitleEnv?: string | null }) {
  const confirm = useConfirm();
  const dict = useAdminDictionary();
  const t = dict.settings.general;
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
      exif.camera && t.metadataSummary.camera,
      exif.settings && t.metadataSummary.exposure,
      exif.location && t.metadataSummary.location,
      exif.caption && t.metadataSummary.description,
    ]
      .filter(Boolean)
      .join(' · ') || t.metadataSummary.none;

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
          <Icons.IconGear size={18} /> {t.title}
        </h3>
        <p className="settings-section-sub">{t.sub}</p>
      </div>

      <div className="admin-field">
        <label htmlFor="general-site-title">{t.siteTitle}</label>
        <input
          id="general-site-title"
          value={settings.title || ''}
          onChange={(e) => update('title', e.target.value)}
          placeholder={fallbackTitle}
          aria-describedby="general-site-title-hint"
        />
        <p id="general-site-title-hint" className="admin-field-hint">
          {settings.title ? t.siteTitleHint : t.siteTitleEmpty(fallbackTitle, !!siteTitleEnv)}
        </p>
      </div>
      <div className="admin-field">
        <label htmlFor="general-subtitle">{t.subtitle}</label>
        <input
          id="general-subtitle"
          value={settings.subtitle || ''}
          onChange={(e) => update('subtitle', e.target.value)}
          placeholder={t.subtitlePlaceholder}
        />
      </div>
      <div className="admin-field">
        <label htmlFor="general-language">{t.language}</label>
        <select
          id="general-language"
          aria-label={t.language}
          value={settings.lang || 'en'}
          onChange={(e) => update('lang', e.target.value)}
        >
          {SUPPORTED_LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {LOCALE_NAMES[locale]}
            </option>
          ))}
          <option value="ja">日本語 (JA)</option>
        </select>
        <p className="admin-field-hint">
          {rich(t.languageHint, {
            locales: SUPPORTED_LOCALES.join(', '),
            htmlLang: <code>&lt;html lang&gt;</code>,
          })}
        </p>
      </div>
      {/* The panel's own language (#604). Empty follows the site; only the
          languages the panel has a dictionary for are offered. */}
      <div className="admin-field">
        <label htmlFor="general-admin-language">{t.adminLanguage}</label>
        <select
          id="general-admin-language"
          value={settings.adminLang || ''}
          onChange={(e) => update('adminLang', e.target.value)}
          aria-describedby="general-admin-language-hint"
        >
          <option value="">{t.adminLanguageSame}</option>
          {SUPPORTED_LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {LOCALE_NAMES[locale]}
            </option>
          ))}
        </select>
        <p id="general-admin-language-hint" className="admin-field-hint">
          {t.adminLanguageHint}
        </p>
      </div>

      <div className="settings-section-divider" />

      <div className="settings-section-header">
        <h3>
          <Icons.IconSparkles size={18} /> {t.featuresTitle}
        </h3>
        <p className="settings-section-sub">{t.featuresSub}</p>
      </div>

      <FeatureGroup
        icon={<Icons.IconFrame size={13} />}
        title={t.modules}
        description={t.modulesDesc}
      >
        <div className="feature-list">
          <FeatureRow
            icon={<Icons.IconCamera size={15} />}
            title={t.aboutPage}
            description={t.aboutPageDesc}
            checked={settings.about?.enabled !== false}
            onToggle={() => update('about.enabled', settings.about?.enabled === false)}
            href="/admin/settings/about"
          />
          <FeatureRow
            icon={<Icons.IconMap size={15} />}
            title={t.map}
            description={t.mapDesc}
            checked={settings.map === true}
            onToggle={() => update('map', !settings.map)}
          />
          <FeatureRow
            icon={<Icons.IconHeart size={15} />}
            title={t.proofing}
            description={t.proofingDesc}
            checked={settings.proofing?.enabled !== false}
            onToggle={() => update('proofing.enabled', settings.proofing?.enabled === false)}
          />
          <FeatureRow
            icon={<Icons.IconSearch size={15} />}
            title={t.zoom}
            description={t.zoomDesc}
            checked={settings.zoom === true}
            onToggle={() => update('zoom', !settings.zoom)}
          />
        </div>
        {/* Shown even while proofing is off globally: a subpage can switch it
            on for itself (`proofing: true`), so the address still has to be
            settable from here. */}
        <div className="admin-field">
          <label htmlFor="proofing-email">{t.proofingEmail}</label>
          <input
            id="proofing-email"
            type="email"
            value={settings.proofing?.email || ''}
            onChange={(e) => update('proofing.email', e.target.value)}
            placeholder={t.proofingEmailPlaceholder}
          />
          <p className="admin-field-hint">{t.proofingEmailHint}</p>
        </div>
      </FeatureGroup>

      <FeatureGroup
        icon={<Icons.IconShieldCheck size={13} />}
        title={t.privacyGroup}
        description={t.privacyGroupDesc}
        chip={t.privacyGroupChip}
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
                <Icons.IconCamera size={16} /> {t.photoMetadata}
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
            {t.details}
            <Icons.IconChevronDown
              size={13}
              className={`metadata-details-chevron${metadataOpen ? ' open' : ''}`}
            />
          </button>

          {metadataOpen && (
            <div className="metadata-details">
              <SettingRow
                title={t.exifCamera}
                description={t.exifCameraDesc}
                checked={exif.camera}
                onToggle={() => update('exif.camera', !exif.camera)}
              />
              <SettingRow
                title={t.exifSettings}
                description={t.exifSettingsDesc}
                checked={exif.settings}
                onToggle={() => update('exif.settings', !exif.settings)}
              />
              <SettingRow
                title={t.exifLocation}
                description={t.exifLocationDesc}
                checked={exif.location}
                onToggle={() => update('exif.location', !exif.location)}
              />
              <SettingRow
                title={t.exifCaption}
                description={t.exifCaptionDesc}
                checked={exif.caption}
                onToggle={() => update('exif.caption', !exif.caption)}
              />

              {/* Dependent, not a peer: this only controls the grid overlay, and
                      the overlay carries camera and lens. With those off it has
                      nothing to show, which used to leave it switched on and
                      silently doing nothing (#510). */}
              <SettingRow
                indented
                title={t.gridHover}
                description={t.gridHoverDesc}
                checked={settings.exifOnHover !== false}
                disabled={!exif.camera}
                hint={exif.camera ? undefined : t.gridHoverNeedsCamera}
                onToggle={() => update('exifOnHover', settings.exifOnHover === false)}
              />
            </div>
          )}
        </div>
        <div className="feature-list">
          <FeatureRow
            icon={<Icons.IconBarChart size={15} />}
            title={t.analytics}
            description={t.analyticsDesc}
            checked={settings.analytics !== false}
            onToggle={() => update('analytics', settings.analytics === false)}
            href="/admin/analytics"
          />
        </div>
      </FeatureGroup>

      <div className="admin-field favicon-field">
        <span className="admin-field-label" id="favicon-label">
          {t.favicon}
        </span>
        <div className="favicon-row">
          {/* eslint-disable-next-line @next/next/no-img-element -- the site's own icon route, a 32px preview */}
          <img
            className="favicon-preview"
            src={`/api/favicon?v=${faviconVersion}`}
            alt={t.faviconAlt}
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
                    : { kind: 'error', message: dict.common.errorWith(data.error) },
                );
                if (res.ok) setFaviconVersion((v) => v + 1);
              } catch {
                setFaviconStatus({
                  kind: 'error',
                  message: dict.common.errorWith(t.faviconUploadFailed),
                });
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
            <Icons.IconImage size={14} /> {t.faviconUpload}
          </label>
          <button
            type="button"
            className="admin-btn admin-btn-sm admin-btn-secondary"
            disabled={faviconUploading}
            onClick={async () => {
              // Deletes the uploaded file at once, outside the staged form.
              const ok = await confirm({
                title: t.faviconResetTitle,
                message: t.faviconResetMessage,
                confirmLabel: dict.common.reset,
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
                    : { kind: 'error', message: dict.common.errorWith(data.error) },
                );
                if (res.ok) setFaviconVersion((v) => v + 1);
              } catch {
                setFaviconStatus({
                  kind: 'error',
                  message: dict.common.errorWith(t.faviconResetFailed),
                });
              } finally {
                setFaviconUploading(false);
              }
            }}
          >
            {dict.common.reset}
          </button>
          {faviconUploading && <div className="admin-spinner" />}
        </div>
        {faviconStatus && (
          <p className={`save-message ${faviconStatus.kind}`}>{faviconStatus.message}</p>
        )}
        <span id="favicon-hint" className="admin-field-hint">
          {t.faviconHint}
        </span>
      </div>
    </div>
  );
}
