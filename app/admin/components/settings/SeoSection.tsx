'use client';

import * as Icons from '../Icons';
import ToggleCard from '../fields/ToggleCard';
import { FieldError } from './fields';
import type { SectionProps } from './types';
import { rich, useAdminDictionary } from '../AdminI18n';

export default function SeoSection({
  settings,
  update,
  fieldErrors,
  siteUrlInfo,
}: SectionProps & {
  /** Resolved site URL and its origin, so the panel can name SITE_URL (#472). */
  siteUrlInfo: { effective: string | null; source: 'env' | 'settings' | 'none' } | null;
}) {
  const t = useAdminDictionary().settings.seo;
  const templateFallback = `%s | ${settings.seo?.title || settings.title || t.titleTemplateFallback}`;
  return (
    <div className="settings-panel">
      <div className="settings-section-header">
        <h3>
          <Icons.IconSearch size={18} /> {t.title}
        </h3>
        <p className="settings-section-sub">{t.sub}</p>
      </div>

      {/* Live Google Search Result Snippet Card */}
      <div className="google-snippet-preview">
        <div className="google-snippet-header">
          <span>
            <Icons.IconGlobe size={14} /> {t.snippetPreview}
          </span>
        </div>
        <div className="google-snippet-card">
          <div className="google-snippet-url">
            https://yourportfolio.com <span className="google-snippet-arrow">▼</span>
          </div>
          <div className="google-snippet-title">
            {settings.seo?.title || settings.title || t.snippetTitle}
          </div>
          <div className="google-snippet-desc">
            {settings.seo?.description || settings.subtitle || t.snippetDesc}
          </div>
        </div>
      </div>

      <div className="admin-field">
        <label htmlFor="seo-site-url">{t.siteUrl}</label>
        <input
          id="seo-site-url"
          value={settings.url || ''}
          onChange={(e) => update('url', e.target.value)}
          placeholder="https://folio.example"
          aria-invalid={fieldErrors?.url ? true : undefined}
          aria-describedby={fieldErrors?.url ? 'seo-site-url-error' : undefined}
        />
        <FieldError id="seo-site-url-error" message={fieldErrors?.url} />
        <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '4px' }}>
          {rich(t.siteUrlHint, { sitemap: <code>sitemap.xml</code> })}
          {siteUrlInfo?.source === 'env' && (
            <>
              <br />
              {rich(t.siteUrlFromEnv, {
                variable: <code>SITE_URL</code>,
                value: <code>{siteUrlInfo.effective}</code>,
              })}
            </>
          )}
        </p>
      </div>

      <div className="admin-field">
        <label htmlFor="seo-meta-title">{t.metaTitle}</label>
        <input
          id="seo-meta-title"
          value={settings.seo?.title || ''}
          onChange={(e) => update('seo.title', e.target.value)}
          placeholder={t.metaTitlePlaceholder}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="seo-subpage-title-template">{t.titleTemplate}</label>
        <input
          id="seo-subpage-title-template"
          value={settings.seo?.titleTemplate || ''}
          onChange={(e) => update('seo.titleTemplate', e.target.value)}
          placeholder={templateFallback}
        />
        <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '4px' }}>
          {rich(t.titleTemplateHint, { placeholder: <code>%s</code> })}
          <br />
          <strong>{t.previewLabel}</strong>{' '}
          {(settings.seo?.titleTemplate || templateFallback).replace('%s', t.previewExample)}
        </p>
      </div>

      <div className="admin-field">
        <label htmlFor="seo-meta-description">{t.metaDescription}</label>
        <textarea
          id="seo-meta-description"
          value={settings.seo?.description || ''}
          onChange={(e) => update('seo.description', e.target.value)}
          placeholder={t.metaDescriptionPlaceholder}
          rows={3}
        />
      </div>

      <div className="settings-section-divider" />

      <div className="settings-section-header">
        <h3>
          <Icons.IconGlobe size={18} /> {t.crawlerTitle}
        </h3>
        <p className="settings-section-sub">{t.crawlerSub}</p>
      </div>

      <div className="admin-toggle-cards-grid">
        <ToggleCard
          icon={<Icons.IconBan size={16} />}
          title={t.noIndex}
          description={t.noIndexDesc}
          checked={settings.seo?.noIndex === true}
          onToggle={() => update('seo.noIndex', !settings.seo?.noIndex)}
        />

        <ToggleCard
          icon={<Icons.IconLink size={16} />}
          title={t.noFollow}
          description={t.noFollowDesc}
          checked={settings.seo?.noFollow === true}
          onToggle={() => update('seo.noFollow', !settings.seo?.noFollow)}
        />
      </div>
    </div>
  );
}
