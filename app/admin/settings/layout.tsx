import SettingsEditor from '../components/SettingsEditor';

/**
 * The settings editor lives in the layout, not in the section pages.
 *
 * Each section is its own route, and a page remounts when the section changes.
 * With the editor in the page, switching from General to Theme threw away every
 * unsaved edit and re-read settings.yaml, without a word — the save bar simply
 * vanished. A layout stays mounted across its child routes, so the edits, and
 * the one save bar that covers them, survive the switch.
 */
export default function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SettingsEditor />
      {children}
    </>
  );
}
