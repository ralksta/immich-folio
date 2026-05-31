import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Immich Folio Admin',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-layout">{children}</div>;
}
