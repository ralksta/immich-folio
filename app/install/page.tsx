import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isInstalled, getInstallCredentials, getSetupToken, validateSetupToken } from '@/lib/install';
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

export default async function InstallPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (isInstalled()) {
    redirect('/');
  }

  const { token } = await searchParams;
  if (!validateSetupToken(token ?? null)) {
    // Force evaluation of the token so it is logged.
    getSetupToken();
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60dvh',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: '600px', width: '100%', textAlign: 'center' }}>
          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 500,
              marginBottom: '0.5rem',
              letterSpacing: '-0.02em',
            }}
          >
            Setup Token Required
          </h1>
          <p style={{ fontSize: '1.125rem', opacity: 0.7, lineHeight: 1.5 }}>
            Check your server logs for the one-time setup token and append{' '}
            <code>?token=</code> to this URL.
          </p>
        </div>
      </div>
    );
  }

  const creds = getInstallCredentials();

  return <InstallWizard initialApiUrl={creds.apiUrl} setupToken={token!} />;
}
