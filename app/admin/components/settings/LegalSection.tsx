'use client';

import * as Icons from '../Icons';
import ToggleCard from '../fields/ToggleCard';
import PrivacyEditor from '../PrivacyEditor';
import { CONTACT_RETENTION_DEFAULT, CONTACT_RETENTION_MAX, isHttpUrl } from '@/lib/config/schema';
import type { SectionProps } from './types';

export default function LegalSection({ settings, update }: SectionProps) {
  // The Impressum drops a non-http(s) contact URL with a warning in the server
  // log, where nobody looks; say it here instead.
  const contactUrl = settings.legal?.contactUrl?.trim();
  const contactUrlInvalid = !!contactUrl && !isHttpUrl(contactUrl);
  const notifyUrl = settings.contact?.notifyUrl?.trim();
  const notifyUrlInvalid = !!notifyUrl && !isHttpUrl(notifyUrl);

  return (
    <div className="settings-panel">
      <div className="settings-section-header">
        <h3>
          <Icons.IconScale size={18} /> Legal Notice &amp; Impressum
        </h3>
        <p className="settings-section-sub">
          Configure the legal disclosure page required by the German Digitale-Dienste-Gesetz (DDG).
        </p>
        {settings.legal?.enabled && (
          <a
            href="/impressum"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-btn admin-btn-sm settings-section-action"
          >
            View /impressum ↗
          </a>
        )}
      </div>

      <div className="admin-toggle-cards-grid" style={{ marginBottom: '1.25rem' }}>
        <ToggleCard
          icon={<Icons.IconFileText size={16} />}
          title="Enable Impressum Page (/impressum)"
          description="Automatically generates and links /impressum in footer"
          checked={settings.legal?.enabled === true}
          onToggle={() => update('legal.enabled', !settings.legal?.enabled)}
        />
      </div>

      {settings.legal?.enabled && (
        <>
          <div className="admin-field">
            <label htmlFor="legal-heading">Heading</label>
            <input
              id="legal-heading"
              value={settings.legal?.heading || ''}
              onChange={(e) => update('legal.heading', e.target.value)}
              placeholder="Angaben gemäß § 5 DDG"
            />
            <p className="admin-field-hint">
              Leave empty for the § 5 DDG line in the site language. Set it when a different law
              applies, e.g. § 5 ECG in Austria.
            </p>
          </div>
          <div className="admin-field-row">
            <div className="admin-field">
              <label htmlFor="legal-full-name-business-name">Full Name / Business Name</label>
              <input
                id="legal-full-name-business-name"
                value={settings.legal?.name || ''}
                onChange={(e) => update('legal.name', e.target.value)}
                placeholder="Max Mustermann"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="legal-street-address">Street Address</label>
              <input
                id="legal-street-address"
                value={settings.legal?.address || ''}
                onChange={(e) => update('legal.address', e.target.value)}
                placeholder="Musterstraße 1"
              />
            </div>
          </div>
          <div className="admin-field-row">
            <div className="admin-field">
              <label htmlFor="legal-zip-city">ZIP &amp; City</label>
              <input
                id="legal-zip-city"
                value={settings.legal?.zipCity || ''}
                onChange={(e) => update('legal.zipCity', e.target.value)}
                placeholder="12345 Berlin"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="legal-country">Country</label>
              <input
                id="legal-country"
                value={settings.legal?.country || ''}
                onChange={(e) => update('legal.country', e.target.value)}
                placeholder="Germany"
              />
            </div>
          </div>
          <div className="admin-field-row">
            <div className="admin-field">
              <label htmlFor="legal-email">Legal Email</label>
              <input
                id="legal-email"
                value={settings.legal?.email || ''}
                onChange={(e) => update('legal.email', e.target.value)}
                placeholder="legal@example.com"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="legal-phone-number">Phone Number</label>
              <input
                id="legal-phone-number"
                value={settings.legal?.phone || ''}
                onChange={(e) => update('legal.phone', e.target.value)}
                placeholder="+49 123 456789"
              />
            </div>
          </div>
          <div className="admin-field-row">
            <div className="admin-field">
              <label htmlFor="legal-contact-url">Contact Form URL</label>
              <input
                id="legal-contact-url"
                type="url"
                value={settings.legal?.contactUrl || ''}
                onChange={(e) => update('legal.contactUrl', e.target.value)}
                placeholder="https://example.com/contact"
                aria-invalid={contactUrlInvalid || undefined}
                aria-describedby={contactUrlInvalid ? 'legal-contact-url-error' : undefined}
              />
              {contactUrlInvalid && (
                <p
                  id="legal-contact-url-error"
                  className="admin-field-hint admin-field-hint--error"
                >
                  Must start with https:// or http://. Any other link is left off the page.
                </p>
              )}
            </div>
            <div className="admin-field">
              <label htmlFor="legal-contact-link-text">Contact Link Text</label>
              <input
                id="legal-contact-link-text"
                value={settings.legal?.contactLabel || ''}
                onChange={(e) => update('legal.contactLabel', e.target.value)}
                placeholder="Contact form"
              />
            </div>
          </div>
          <div className="admin-field-row">
            <div className="admin-field">
              <label htmlFor="legal-vat-id">VAT ID</label>
              <input
                id="legal-vat-id"
                value={settings.legal?.vatId || ''}
                onChange={(e) => update('legal.vatId', e.target.value)}
                placeholder="DE123456789"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="legal-tax-number">Tax Number</label>
              <input
                id="legal-tax-number"
                value={settings.legal?.taxId || ''}
                onChange={(e) => update('legal.taxId', e.target.value)}
                placeholder="12/345/67890"
              />
            </div>
          </div>
          <div className="admin-field">
            <label htmlFor="legal-additional-disclosures">Additional Disclosures</label>
            <textarea
              id="legal-additional-disclosures"
              value={settings.legal?.extraInfo || ''}
              onChange={(e) => update('legal.extraInfo', e.target.value)}
              placeholder="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV..."
              rows={3}
            />
          </div>
        </>
      )}

      <div className="settings-section-divider" />

      <div className="admin-toggle-cards-grid" style={{ marginBottom: '1.25rem' }}>
        <ToggleCard
          icon={<Icons.IconFileText size={16} />}
          title="Contact Form (/contact)"
          description="Messages are stored on this server and read under Messages. No mail is sent."
          checked={settings.contact?.enabled === true}
          onToggle={() => update('contact.enabled', !settings.contact?.enabled)}
        />
      </div>

      {settings.contact?.enabled && (
        <div className="admin-field-row">
          <div className="admin-field">
            <label htmlFor="contact-notify-url">Notification URL (ntfy)</label>
            <input
              id="contact-notify-url"
              type="url"
              value={settings.contact?.notifyUrl || ''}
              onChange={(e) => update('contact.notifyUrl', e.target.value)}
              placeholder="https://ntfy.sh/your-secret-topic"
              aria-invalid={notifyUrlInvalid || undefined}
              aria-describedby="contact-notify-url-hint"
            />
            <p
              id="contact-notify-url-hint"
              className={`admin-field-hint${notifyUrlInvalid ? ' admin-field-hint--error' : ''}`}
            >
              {notifyUrlInvalid
                ? 'Must start with https:// or http://.'
                : 'Gets a fixed "new message" push, with nothing about the sender. Pick a topic name nobody can guess. CONTACT_NOTIFY_URL overrides this.'}
            </p>
          </div>
          <div className="admin-field">
            <label htmlFor="contact-retention">Delete messages after (days)</label>
            <input
              id="contact-retention"
              type="number"
              min={1}
              max={CONTACT_RETENTION_MAX}
              value={settings.contact?.retentionDays ?? CONTACT_RETENTION_DEFAULT}
              onChange={(e) =>
                update(
                  'contact.retentionDays',
                  parseInt(e.target.value) || CONTACT_RETENTION_DEFAULT,
                )
              }
            />
          </div>
        </div>
      )}

      <div className="settings-section-divider" />

      <div className="admin-toggle-cards-grid" style={{ marginBottom: '1.25rem' }}>
        <ToggleCard
          icon={<Icons.IconShieldCheck size={16} />}
          title="Privacy Policy (/privacy)"
          description="Shown and linked in the footer once the text below is saved"
          checked={settings.privacy?.enabled !== false}
          onToggle={() => update('privacy.enabled', settings.privacy?.enabled === false)}
        />
      </div>

      <PrivacyEditor />
    </div>
  );
}
