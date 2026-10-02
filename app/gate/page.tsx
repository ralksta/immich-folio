/**
 * The site-wide password gate.
 *
 * Nothing links here. `proxy.ts` rewrites every request to this route while
 * the site is locked, which is what keeps the requested page from rendering
 * at all — a gate in the layout would still let the page produce its RSC
 * payload, album names and asset tokens included.
 *
 * The legal notice and the privacy policy are the exception: the proxy serves
 * them to a locked site, and this page links them, so a visitor who cannot get
 * in can still see who runs the site.
 *
 * /contact is served to a locked site as well, but not linked from here: it is
 * open because the Impressum names it as a contact channel, and the Impressum
 * links it. A form under the password field would read as "ask for access".
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getConfig } from '@/lib/config';
import { isSiteLocked, SITE_AUTH_KEY } from '@/lib/auth';
import { privacyAvailable } from '@/lib/privacy';
import { getServerDictionary } from '@/lib/i18n/server';
import PasswordGate from '@/components/PasswordGate';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function GatePage() {
  // Reachable on its own URL, so it has to answer for itself: with no site
  // password configured there is no gate to show.
  if (!isSiteLocked()) notFound();

  const config = getConfig();
  const t = getServerDictionary();
  // Only the pages that exist: a link to a switched-off one would be a 404.
  const legalLinks = [
    ...(config.legal.enabled ? [{ href: '/impressum', label: t.legal.navLabel }] : []),
    ...(privacyAvailable(config) ? [{ href: '/privacy', label: t.privacy.navLabel }] : []),
  ];

  return (
    <PasswordGate
      slug={SITE_AUTH_KEY}
      title={config.siteTitle}
      type="site"
      legalLinks={legalLinks}
    />
  );
}
