'use client';

import * as Icons from './Icons';
import { getDictionary } from '@/lib/i18n';
import { LIGHTBOX_SHORTCUTS, shortcutDisplayKeys } from '@/lib/lightboxShortcuts';
import PageHeader from './PageHeader';
import { rich, useAdminDictionary, useAdminLocale } from './AdminI18n';

/**
 * The admin help section.
 *
 * It exists because parts of the portfolio have no control of their own. The
 * lightbox is the clearest case: its keys are deliberately unadvertised to
 * visitors, which also left the site owner with no way to learn they exist
 * (#473). This is where the owner finds out what their portfolio can do.
 *
 * Labels come from the visitor dictionary rather than being retyped, so what
 * this page promises is what a visitor is actually shown — in the panel's
 * language, which is usually the site's too (#604).
 */
export default function HelpView() {
  const t = useAdminDictionary().system.help;
  const visitor = getDictionary(useAdminLocale());
  return (
    <div className="settings-panel">
      <PageHeader kicker={t.kicker} title={t.title} description={t.description} />

      <div className="settings-group">
        <div className="settings-group-head">
          <span className="settings-group-title">
            <Icons.IconFilm size={13} />
            {t.viewer}
          </span>
          <span className="settings-group-desc">
            {rich(t.viewerIntro, {
              question: <kbd className="help-kbd">?</kbd>,
              h: <kbd className="help-kbd">H</kbd>,
            })}
          </span>
        </div>

        <dl className="help-shortcuts">
          {LIGHTBOX_SHORTCUTS.map((shortcut) => (
            <div key={shortcut.labelKey} className="help-shortcuts-row">
              <dt className="help-shortcuts-keys">
                {shortcutDisplayKeys(shortcut).map((key) => (
                  <kbd key={key} className="help-kbd">
                    {key}
                  </kbd>
                ))}
              </dt>
              <dd className="help-shortcuts-label">
                {visitor.lightbox[shortcut.labelKey]}
                {shortcut.note && (
                  <span className="help-shortcuts-note">
                    {t.notes[shortcut.labelKey as keyof typeof t.notes] ?? shortcut.note}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="settings-group">
        <div className="settings-group-head">
          <span className="settings-group-title">
            <Icons.IconShieldCheck size={13} />
            {t.diagnostics}
          </span>
          <span className="settings-group-desc">
            {rich(t.diagnosticsIntro, { tab: <strong>{t.diagnosticsTab}</strong> })}
          </span>
        </div>
      </div>
    </div>
  );
}
