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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-layout">
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
