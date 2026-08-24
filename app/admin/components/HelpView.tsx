'use client';

import { useState } from 'react';
import DoctorModal from './DoctorModal';
import * as Icons from './Icons';
import { en } from '@/lib/i18n/locales/en';
import { LIGHTBOX_SHORTCUTS, shortcutKeyLabel } from '@/lib/lightboxShortcuts';

/**
 * The admin help section.
 *
 * It exists because parts of the portfolio have no control of their own. The
 * lightbox is the clearest case: its keys are deliberately unadvertised to
 * visitors, which also left the site owner with no way to learn they exist
 * (#473). This is where the owner finds out what their portfolio can do.
 *
 * Labels come from the English dictionary rather than being retyped, so what
 * this page promises is what a visitor is actually shown. The admin panel is
 * English-only, hence `en` directly.
 */
export default function HelpView() {
  const [showDoctor, setShowDoctor] = useState(false);

  return (
    <div className="settings-panel">
      <div className="settings-section-header">
        <h3>
          <Icons.IconFileText size={18} /> Help
        </h3>
        <p className="settings-section-sub">
          What your portfolio can do that has no button of its own.
        </p>
      </div>

      <div className="settings-group">
        <div className="settings-group-head">
          <span className="settings-group-title">
            <Icons.IconFilm size={13} />
            Image viewer
          </span>
          <span className="settings-group-desc">
            Keys a visitor can press in the lightbox. There is deliberately no toolbar for these — a
            permanent control over a photograph costs every visitor something — but visitors can
            call up the same list with <kbd className="help-kbd">?</kbd> or{' '}
            <kbd className="help-kbd">H</kbd>.
          </span>
        </div>

        <dl className="help-shortcuts">
          {LIGHTBOX_SHORTCUTS.map((shortcut) => (
            <div key={shortcut.labelKey} className="help-shortcuts-row">
              <dt className="help-shortcuts-keys">
                {shortcut.keys.map((key) => (
                  <kbd key={key} className="help-kbd">
                    {shortcutKeyLabel(key)}
                  </kbd>
                ))}
              </dt>
              <dd className="help-shortcuts-label">
                {en.lightbox[shortcut.labelKey]}
                {shortcut.note && <span className="help-shortcuts-note">{shortcut.note}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="settings-group">
        <div className="settings-group-head">
          <span className="settings-group-title">
            <Icons.IconShieldCheck size={13} />
            Diagnostics
          </span>
          <span className="settings-group-desc">
            Checks the things that fail silently — a wrong proxy hop count, a deleted album ID, a
            plaintext password, an album Immich does not consider shared. It also sits behind the
            status badge in the top bar, which is where it belongs when the question is whether
            anything needs attention right now.
          </span>
        </div>

        <div className="help-action">
          <button type="button" className="admin-btn" onClick={() => setShowDoctor(true)}>
            <Icons.IconShieldCheck size={14} /> Run diagnostics
          </button>
        </div>
      </div>

      <DoctorModal isOpen={showDoctor} onClose={() => setShowDoctor(false)} />
    </div>
  );
}
