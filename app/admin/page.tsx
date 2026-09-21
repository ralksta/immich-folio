import { redirect } from 'next/navigation';

/**
 * `/admin` and `/admin/pages` both rendered the page builder, so the same
 * screen had two addresses: two routes to keep in step, two things to find
 * when something about the builder changes, and no way to tell which one a
 * bookmark or a bug report meant.
 *
 * `/admin/pages` wins because that is what the Pages tab links to. `/admin`
 * stays as the entry point people type and bookmark — and it is what the
 * public diagnostic banner links to — so it redirects rather than disappearing.
 */
export default function AdminHomePage() {
  redirect('/admin/pages');
}
