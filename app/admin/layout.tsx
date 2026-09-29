import type { Metadata } from 'next';
import AdminShell from './AdminShell';

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
 * `lang="en"`: `<html lang>` follows the site language (settings.yaml `lang`),
 * but the admin is deliberately untranslated. Without this a screen reader
 * read the English interface with a German voice on a `lang: de` site.
 * The Listbox popup is portalled to <body> and still inherits the root value.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-layout" lang="en">
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
