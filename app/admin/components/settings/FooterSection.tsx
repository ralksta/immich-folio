'use client';

import * as Icons from '../Icons';
import type { SectionProps } from './types';

export default function FooterSection({ settings, update }: SectionProps) {
  return (
    <div className="settings-panel">
      <div className="settings-section-header">
        <h3>
          <Icons.IconLink size={18} /> Footer &amp; Social Links
        </h3>
        <p className="settings-section-sub">
          Display branding, Instagram, email and website links in portfolio footer.
        </p>
      </div>

      <div className="admin-field">
        <label htmlFor="footer-brand-name">Footer Brand Name</label>
        <input
          id="footer-brand-name"
          value={settings.footer?.name || ''}
          onChange={(e) => update('footer.name', e.target.value)}
          placeholder="My Photography"
        />
      </div>
      <div className="admin-field">
        <label htmlFor="footer-instagram-url">Instagram URL</label>
        <input
          id="footer-instagram-url"
          value={settings.footer?.instagram || ''}
          onChange={(e) => update('footer.instagram', e.target.value)}
          placeholder="https://instagram.com/your-handle"
        />
      </div>
      <div className="admin-field-row">
        <div className="admin-field">
          <label htmlFor="footer-contact-email">Contact Email</label>
          <input
            id="footer-contact-email"
            value={settings.footer?.email || ''}
            onChange={(e) => update('footer.email', e.target.value)}
            placeholder="hello@example.com"
          />
        </div>
        <div className="admin-field">
          <label htmlFor="footer-personal-website">Personal Website</label>
          <input
            id="footer-personal-website"
            value={settings.footer?.website || ''}
            onChange={(e) => update('footer.website', e.target.value)}
            placeholder="https://example.com"
          />
        </div>
      </div>

      <div className="settings-section-header" style={{ marginTop: '2rem' }}>
        <h3>
          <Icons.IconLink size={18} /> Header Navigation Links (Experimental)
        </h3>
        <p className="settings-section-sub">
          External links shown after your pages in the header menu. Only http(s) URLs are allowed;
          they open in a new tab.
        </p>
      </div>

      {(settings.navLinks || []).map((link, i) => (
        <div className="admin-field-row" key={i}>
          <div className="admin-field">
            <label htmlFor="footer-label">Label</label>
            <input
              id="footer-label"
              value={link.label || ''}
              onChange={(e) => {
                const next = [...(settings.navLinks || [])];
                next[i] = { ...next[i], label: e.target.value };
                update('navLinks', next);
              }}
              placeholder="Shop"
            />
          </div>
          <div className="admin-field">
            <label htmlFor="footer-url">URL</label>
            <input
              id="footer-url"
              value={link.url || ''}
              onChange={(e) => {
                const next = [...(settings.navLinks || [])];
                next[i] = { ...next[i], url: e.target.value };
                update('navLinks', next);
              }}
              placeholder="https://shop.example.com"
            />
          </div>
          <button
            type="button"
            className="admin-btn admin-btn-sm"
            style={{ alignSelf: 'flex-end' }}
            onClick={() => {
              const next = (settings.navLinks || []).filter((_, j) => j !== i);
              update('navLinks', next.length > 0 ? next : undefined);
            }}
            title="Remove link"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="admin-btn admin-btn-sm"
        onClick={() => update('navLinks', [...(settings.navLinks || []), { label: '', url: '' }])}
      >
        + Add external link
      </button>
    </div>
  );
}
