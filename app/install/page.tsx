import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isInstalled, getInstallCredentials } from '@/lib/install';
import { InstallWizard } from './InstallWizard';

export const metadata: Metadata = {
  title: 'Install Immich Folio',
  robots: { index: false, follow: false },
};

/**
 * Rendered per request so the CSP nonce issued by proxy.ts lands on the script
 * tags — same reason /admin is force-dynamic. Also what lets the redirect once
 * setup is complete take effect on the next navigation, not a future build.
 */
export const dynamic = 'force-dynamic';

export default function InstallPage() {
  // Setup complete → the wizard is no longer reachable. Redirect so the route
  // does not even render; the API routes carry their own guard.
  if (isInstalled()) {
    redirect('/');
  }

  const creds = getInstallCredentials();

  return <InstallWizard initialApiUrl={creds.apiUrl} initialApiKey={creds.apiKey} />;
}
