/**
 * The site-wide password gate.
 *
 * Nothing links here. `proxy.ts` rewrites every request to this route while
 * the site is locked, which is what keeps the requested page from rendering
 * at all — a gate in the layout would still let the page produce its RSC
 * payload, album names and asset tokens included.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getConfig } from '@/lib/config';
import { isSiteLocked, SITE_AUTH_KEY } from '@/lib/auth';
import PasswordGate from '@/components/PasswordGate';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function GatePage() {
  // Reachable on its own URL, so it has to answer for itself: with no site
  // password configured there is no gate to show.
  if (!isSiteLocked()) notFound();

  return <PasswordGate slug={SITE_AUTH_KEY} title={getConfig().siteTitle} type="site" />;
}
