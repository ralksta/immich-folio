'use client';

import * as Icons from '../Icons';
import ToggleCard from '../fields/ToggleCard';
import PasswordField from '../fields/PasswordField';
import EnvLockNote from '../fields/EnvLockNote';
import { resolveWatermarkOpacity } from '@/lib/config/schema';
import type { SectionProps } from './types';

export default function SecuritySection({ settings, update, envLocks }: SectionProps) {
  const passwordLock = envLocks?.sitePassword;
  return (
    <div className="settings-panel">
      <div className="settings-section-header">
        <h3>
          <Icons.IconLock size={18} /> Site Password
        </h3>
        <p className="settings-section-sub">
          Puts the whole public site behind one password — useful while a portfolio is still being
          built, or for a folio only ever shown to clients.
        </p>
      </div>

      <div className="admin-field">
        <label htmlFor="security-site-password">Site Password</label>
        <PasswordField
          id="security-site-password"
          value={settings.sitePassword}
          onChange={(password) => update('sitePassword', password ?? '')}
          placeholder="Leave empty for a public site"
          label="Site password"
          disabled={!!passwordLock}
        />
        {passwordLock && <EnvLockNote variable={passwordLock} />}
        <p className="admin-field-hint">
          Stored as a <code>scrypt:…</code> hash in <code>settings.yaml</code>, never as typed.
          {!passwordLock && (
            <>
              {' '}
              The <code>SITE_PASSWORD</code> environment variable overrides this field.
            </>
          )}{' '}
          The admin panel keeps its own password and is never behind this gate.
        </p>
      </div>

      <div className="settings-section-divider" />

      <div className="settings-section-header">
        <h3>
          <Icons.IconShieldCheck size={18} /> Asset Protection &amp; Watermark
        </h3>
        <p className="settings-section-sub">
          Configure image protection rules, right-click prevention, and watermark overlay.
        </p>
      </div>

      <div className="admin-toggle-cards-grid">
        <ToggleCard
          icon={<Icons.IconLock size={16} />}
          title="Disable Right-Click Menu"
          description="Prevents context menu on portfolio images to hinder unauthorized downloads"
          checked={settings.protection?.disableRightClick === true}
          onToggle={() =>
            update('protection.disableRightClick', !settings.protection?.disableRightClick)
          }
        />

        <ToggleCard
          icon={<Icons.IconBan size={16} />}
          title="Disable Image Dragging"
          description="Prevents visitors from dragging images off the portfolio page"
          checked={settings.protection?.disableImageDrag === true}
          onToggle={() =>
            update('protection.disableImageDrag', !settings.protection?.disableImageDrag)
          }
        />
      </div>

      <div className="settings-section-divider" />

      <div className="settings-section-header">
        <h3>
          <Icons.IconSparkles size={18} /> Dynamic Watermark Overlay
        </h3>
        <p className="settings-section-sub">Overlay copyright branding text on Lightbox images.</p>
      </div>

      <div className="admin-toggle-cards-grid" style={{ marginBottom: '1.25rem' }}>
        <ToggleCard
          icon={<Icons.IconFrame size={16} />}
          title="Enable Watermark"
          description="Overlay copyright text on portfolio image views"
          checked={settings.watermark?.enabled === true}
          onToggle={() => update('watermark.enabled', !settings.watermark?.enabled)}
        />
      </div>

      {settings.watermark?.enabled && (
        <>
          <div className="admin-field">
            <label htmlFor="security-watermark-text">Watermark Text</label>
            <input
              id="security-watermark-text"
              value={settings.watermark?.text || ''}
              onChange={(e) => update('watermark.text', e.target.value)}
              placeholder="© Ralfo Photography"
            />
          </div>

          <div className="admin-field-row">
            <div className="admin-field">
              <label htmlFor="security-position">Position</label>
              <select
                id="security-position"
                aria-label="Watermark position"
                value={settings.watermark?.position || 'bottom-right'}
                onChange={(e) => update('watermark.position', e.target.value)}
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="center">Center Overlay</option>
              </select>
            </div>
            <div className="admin-field">
              {/* Read through the same normaliser the lightbox uses, so a
                          config written as a percentage shows as "90%" here rather
                          than "9000%" — and is written back as a fraction on save. */}
              <label htmlFor="security-opacity-100">
                Opacity ({Math.round(resolveWatermarkOpacity(settings.watermark?.opacity) * 100)}
                %)
              </label>
              <input
                id="security-opacity-100"
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={resolveWatermarkOpacity(settings.watermark?.opacity)}
                onChange={(e) => update('watermark.opacity', parseFloat(e.target.value))}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
