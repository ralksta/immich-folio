'use client';

import * as Icons from '../Icons';
import { FieldError } from './fields';
import type { SectionProps } from './types';
import { useAdminDictionary } from '../AdminI18n';

export default function FooterSection({ settings, update, fieldErrors }: SectionProps) {
  const dict = useAdminDictionary();
  const t = dict.settings.footer;
  return (
    <div className="settings-panel">
      <div className="settings-section-header">
        <h3>
          <Icons.IconLink size={18} /> {t.title}
        </h3>
        <p className="settings-section-sub">{t.sub}</p>
      </div>

      <div className="admin-field">
        <label htmlFor="footer-brand-name">{t.brandName}</label>
        <input
          id="footer-brand-name"
          value={settings.footer?.name || ''}
          onChange={(e) => update('footer.name', e.target.value)}
          placeholder={t.brandNamePlaceholder}
        />
      </div>
      <div className="admin-field">
        <label htmlFor="footer-instagram-url">{t.instagram}</label>
        <input
          id="footer-instagram-url"
          value={settings.footer?.instagram || ''}
          onChange={(e) => update('footer.instagram', e.target.value)}
          placeholder="https://instagram.com/your-handle"
        />
      </div>
      <div className="admin-field-row">
        <div className="admin-field">
          <label htmlFor="footer-contact-email">{t.email}</label>
          <input
            id="footer-contact-email"
            value={settings.footer?.email || ''}
            onChange={(e) => update('footer.email', e.target.value)}
            placeholder="hello@example.com"
          />
        </div>
        <div className="admin-field">
          <label htmlFor="footer-personal-website">{t.website}</label>
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
          <Icons.IconLink size={18} /> {t.navTitle}
        </h3>
        <p className="settings-section-sub">{t.navSub}</p>
      </div>

      {(settings.navLinks || []).map((link, i) => (
        <div className="admin-field-row" key={i}>
          <div className="admin-field">
            <label htmlFor={`navlink-${i}-label`}>{t.linkLabel}</label>
            <input
              id={`navlink-${i}-label`}
              aria-invalid={fieldErrors?.[`navLinks.${i}.label`] ? true : undefined}
              aria-describedby={
                fieldErrors?.[`navLinks.${i}.label`] ? `navlink-${i}-label-error` : undefined
              }
              value={link.label || ''}
              onChange={(e) => {
                const next = [...(settings.navLinks || [])];
                next[i] = { ...next[i], label: e.target.value };
                update('navLinks', next);
              }}
              placeholder={t.linkLabelPlaceholder}
            />
            <FieldError
              id={`navlink-${i}-label-error`}
              message={fieldErrors?.[`navLinks.${i}.label`]}
            />
          </div>
          <div className="admin-field">
            <label htmlFor={`navlink-${i}-url`}>{t.linkUrl}</label>
            <input
              id={`navlink-${i}-url`}
              aria-invalid={fieldErrors?.[`navLinks.${i}.url`] ? true : undefined}
              aria-describedby={
                fieldErrors?.[`navLinks.${i}.url`] ? `navlink-${i}-url-error` : undefined
              }
              value={link.url || ''}
              onChange={(e) => {
                const next = [...(settings.navLinks || [])];
                next[i] = { ...next[i], url: e.target.value };
                update('navLinks', next);
              }}
              placeholder="https://shop.example.com"
            />
            <FieldError
              id={`navlink-${i}-url-error`}
              message={fieldErrors?.[`navLinks.${i}.url`]}
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
            title={t.removeLink}
          >
            {dict.common.remove}
          </button>
        </div>
      ))}
      <button
        type="button"
        className="admin-btn admin-btn-sm"
        onClick={() => update('navLinks', [...(settings.navLinks || []), { label: '', url: '' }])}
      >
        {t.addLink}
      </button>
    </div>
  );
}
