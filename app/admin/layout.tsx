import type { Metadata } from 'next';
import AdminShell from './AdminShell';
import { AdminI18nProvider } from './components/AdminI18n';
import { getConfigOrNull } from '@/lib/config';
import { getAdminDictionary, resolveAdminLocale } from '@/lib/i18n/admin';

export const metadata: Metadata = {
  title: 'Immich Folio Admin',
  robots: { index: false, follow: false },
};

/**
 * Required for the CSP nonce. The admin page is a pure client component, so
 * Next.js would statically prerender it at build time — and a prerendered HTML
 * file cannot carry the per-request nonce that proxy.ts issues. Since the
 * CSP uses 'strict-dynamic' (which makes 'self' inert), unnonced script tags
 * are blocked and the panel never hydrates. Rendering per request lets Next.js
 * stamp the nonce onto the script tags it emits.
 */
export const dynamic = 'force-dynamic';

/**
 * The panel has a language of its own (#604): `settings.yaml: adminLang`, else
 * the site's `lang`. `lang` on the wrapper follows it, so a screen reader reads
 * an English panel over a German site with an English voice and the other way
 * round. The Listbox popup is portalled to <body> and still inherits the root
 * value.
 *
 * Read per request (the layout is force-dynamic), so a save in Settings that
 * changes the language takes effect on the `router.refresh()` that follows it.
 * Without a usable config the panel is English.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const config = getConfigOrNull();
  const locale = resolveAdminLocale(config?.adminLang, config?.lang);
  const { common } = getAdminDictionary(locale);
  // Toggle switches draw their On/Off word in CSS (`::after`), out of reach of
  // the dictionary hook, so the words arrive as custom properties.
  const switchWords = {
    '--admin-switch-on': JSON.stringify(common.switchOn),
    '--admin-switch-off': JSON.stringify(common.switchOff),
  } as React.CSSProperties;
  return (
    <div className="admin-layout" lang={locale} style={switchWords}>
      <AdminI18nProvider locale={locale}>
        <AdminShell>{children}</AdminShell>
      </AdminI18nProvider>
    </div>
  );
}
