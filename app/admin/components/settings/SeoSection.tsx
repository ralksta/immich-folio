'use client';

import * as Icons from '../Icons';
import ToggleCard from '../fields/ToggleCard';
import { FieldError } from './fields';
import type { SectionProps } from './types';

export default function SeoSection({
  settings,
  update,
  fieldErrors,
  siteUrlInfo,
}: SectionProps & {
  /** Resolved site URL and its origin, so the panel can name SITE_URL (#472). */
  siteUrlInfo: { effective: string | null; source: 'env' | 'settings' | 'none' } | null;
}) {
  return (
    <div className="settings-panel">
      <div className="settings-section-header">
        <h3>
          <Icons.IconSearch size={18} /> Search Engine Optimization (SEO)
        </h3>
        <p className="settings-section-sub">
          Customize search engine metadata, OpenGraph tags, and indexing rules.
        </p>
      </div>

      {/* Live Google Search Result Snippet Card */}
      <div className="google-snippet-preview">
        <div className="google-snippet-header">
          <span>
            <Icons.IconGlobe size={14} /> Google Search Result Preview
          </span>
        </div>
        <div className="google-snippet-card">
          <div className="google-snippet-url">
            https://yourportfolio.com <span className="google-snippet-arrow">▼</span>
          </div>
          <div className="google-snippet-title">
            {settings.seo?.title || settings.title || 'My Photography Portfolio'}
          </div>
          <div className="google-snippet-desc">
            {settings.seo?.description ||
              settings.subtitle ||
              'A curated selection of photography work.'}
          </div>
        </div>
      </div>

      <div className="admin-field">
        <label htmlFor="seo-site-url">Site URL</label>
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
          Needed for <code>sitemap.xml</code>, the feed and structured data — those are generated
          without a request, so the address cannot be derived from it. Leave empty and the sitemap
          stays empty rather than guessing.
          {siteUrlInfo?.source === 'env' && (
            <>
              <br />
              Currently supplied by the <code>SITE_URL</code> environment variable (
              <code>{siteUrlInfo.effective}</code>). A value entered here takes precedence once
              saved.
            </>
          )}
        </p>
      </div>

      <div className="admin-field">
        <label htmlFor="seo-meta-title">SEO Meta Title</label>
        <input
          id="seo-meta-title"
          value={settings.seo?.title || ''}
          onChange={(e) => update('seo.title', e.target.value)}
          placeholder="Overrides default site title for Google search results"
        />
      </div>

      <div className="admin-field">
        <label htmlFor="seo-subpage-title-template">Subpage Title Template</label>
        <input
          id="seo-subpage-title-template"
          value={settings.seo?.titleTemplate || ''}
          onChange={(e) => update('seo.titleTemplate', e.target.value)}
          placeholder={`%s | ${settings.seo?.title || settings.title || 'My Portfolio'}`}
        />
        <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '4px' }}>
          Template for subpages &amp; albums. Use <code>%s</code> as placeholder for the page title.
          <br />
          <strong>Preview:</strong>{' '}
          {(
            settings.seo?.titleTemplate ||
            `%s | ${settings.seo?.title || settings.title || 'My Portfolio'}`
          ).replace('%s', 'Landscapes')}
        </p>
      </div>

      <div className="admin-field">
        <label htmlFor="seo-meta-description">SEO Meta Description</label>
        <textarea
          id="seo-meta-description"
          value={settings.seo?.description || ''}
          onChange={(e) => update('seo.description', e.target.value)}
          placeholder="A curated selection of photography work..."
          rows={3}
        />
      </div>

      <div className="settings-section-divider" />

      <div className="settings-section-header">
        <h3>
          <Icons.IconGlobe size={18} /> Search Crawler Directives
        </h3>
        <p className="settings-section-sub">
          Control how Googlebot and other web crawlers index your site.
        </p>
      </div>

      <div className="admin-toggle-cards-grid">
        <ToggleCard
          icon={<Icons.IconBan size={16} />}
          title="noindex (Hide from Google)"
          description="Instructs search engines NOT to index this site in search results"
          checked={settings.seo?.noIndex === true}
          onToggle={() => update('seo.noIndex', !settings.seo?.noIndex)}
        />

        <ToggleCard
          icon={<Icons.IconLink size={16} />}
          title="nofollow (Block Link Following)"
          description="Instructs search engine crawlers not to follow outgoing links"
          checked={settings.seo?.noFollow === true}
          onToggle={() => update('seo.noFollow', !settings.seo?.noFollow)}
        />
      </div>
    </div>
  );
}
