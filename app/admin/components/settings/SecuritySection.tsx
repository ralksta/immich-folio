'use client';

import * as Icons from '../Icons';
import ToggleCard from '../fields/ToggleCard';
import PasswordField from '../fields/PasswordField';
import EnvLockNote from '../fields/EnvLockNote';
import { resolveWatermarkOpacity } from '@/lib/config/schema';
import type { SectionProps } from './types';
import { rich, useAdminDictionary } from '../AdminI18n';

export default function SecuritySection({ settings, update, envLocks }: SectionProps) {
  const t = useAdminDictionary().settings.security;
  const passwordLock = envLocks?.sitePassword;
  return (
    <div className="settings-panel">
      <div className="settings-section-header">
        <h3>
          <Icons.IconLock size={18} /> {t.title}
        </h3>
        <p className="settings-section-sub">{t.sub}</p>
      </div>

      <div className="admin-field">
        <label htmlFor="security-site-password">{t.sitePassword}</label>
        <PasswordField
          id="security-site-password"
          value={settings.sitePassword}
          onChange={(password) => update('sitePassword', password ?? '')}
          placeholder={t.sitePasswordPlaceholder}
          label={t.sitePasswordAria}
          disabled={!!passwordLock}
        />
        {passwordLock && <EnvLockNote variable={passwordLock} />}
        <p className="admin-field-hint">
          {rich(t.storedHashed, { hash: <code>scrypt:…</code>, file: <code>settings.yaml</code> })}
          {!passwordLock && (
            <> {rich(t.envOverride, { variable: <code>SITE_PASSWORD</code> })}</>
          )}{' '}
          {t.adminSeparate}
        </p>
      </div>

      <div className="settings-section-divider" />

      <div className="settings-section-header">
        <h3>
          <Icons.IconShieldCheck size={18} /> {t.protectionTitle}
        </h3>
        <p className="settings-section-sub">{t.protectionSub}</p>
      </div>

      <div className="admin-toggle-cards-grid">
        <ToggleCard
          icon={<Icons.IconLock size={16} />}
          title={t.rightClick}
          description={t.rightClickDesc}
          checked={settings.protection?.disableRightClick === true}
          onToggle={() =>
            update('protection.disableRightClick', !settings.protection?.disableRightClick)
          }
        />

        <ToggleCard
          icon={<Icons.IconBan size={16} />}
          title={t.imageDrag}
          description={t.imageDragDesc}
          checked={settings.protection?.disableImageDrag === true}
          onToggle={() =>
            update('protection.disableImageDrag', !settings.protection?.disableImageDrag)
          }
        />
      </div>

      <div className="settings-section-divider" />

      <div className="settings-section-header">
        <h3>
          <Icons.IconSparkles size={18} /> {t.watermarkTitle}
        </h3>
        <p className="settings-section-sub">{t.watermarkSub}</p>
      </div>

      <div className="admin-toggle-cards-grid" style={{ marginBottom: '1.25rem' }}>
        <ToggleCard
          icon={<Icons.IconFrame size={16} />}
          title={t.watermarkEnable}
          description={t.watermarkEnableDesc}
          checked={settings.watermark?.enabled === true}
          onToggle={() => update('watermark.enabled', !settings.watermark?.enabled)}
        />
      </div>

      {settings.watermark?.enabled && (
        <>
          <div className="admin-field">
            <label htmlFor="security-watermark-text">{t.watermarkText}</label>
            <input
              id="security-watermark-text"
              value={settings.watermark?.text || ''}
              onChange={(e) => update('watermark.text', e.target.value)}
              placeholder="© Ralfo Photography"
            />
          </div>

          <div className="admin-field-row">
            <div className="admin-field">
              <label htmlFor="security-position">{t.position}</label>
              <select
                id="security-position"
                aria-label={t.positionAria}
                value={settings.watermark?.position || 'bottom-right'}
                onChange={(e) => update('watermark.position', e.target.value)}
              >
                <option value="bottom-right">{t.positionBottomRight}</option>
                <option value="bottom-left">{t.positionBottomLeft}</option>
                <option value="center">{t.positionCenter}</option>
              </select>
            </div>
            <div className="admin-field">
              {/* Read through the same normaliser the lightbox uses, so a
                          config written as a percentage shows as "90%" here rather
                          than "9000%" — and is written back as a fraction on save. */}
              <label htmlFor="security-opacity-100">
                {t.opacity(Math.round(resolveWatermarkOpacity(settings.watermark?.opacity) * 100))}
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
