import AdminOverview from './components/AdminOverview';

/**
 * `/admin` is the overview: what needs attention, and the site at a glance
 * (docs/admin-ux-concept.md). It used to redirect to the page builder, which
 * left unread messages and doctor warnings to be found by visiting the right
 * tab. The page builder keeps its own address at `/admin/pages`.
 */
export default function AdminHomePage() {
  return <AdminOverview />;
}
