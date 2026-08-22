/**
 * Runs once per server start, before the first request is handled.
 *
 * Its only job today: print the one-time setup token of an unconfigured
 * deployment. The token used to be minted lazily by /install and the setup
 * screen, so an operator who went straight to /admin — which is reachable as
 * soon as ADMIN_PASSWORD is set — found nothing in `docker logs` and no way to
 * reach the wizard (#507).
 */
export async function register() {
  // `register` also runs on the edge runtime, where `node:fs` does not exist.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Imported dynamically: a static import would pull `node:fs` into the edge
  // bundle regardless of the guard above.
  const { isInstalled, getSetupToken } = await import('./lib/install');

  try {
    if (!isInstalled()) getSetupToken();
  } catch (error) {
    // A read-only or missing content/ must not stop the server from booting —
    // the setup screen reports that problem far better than a crash loop.
    console.warn('[Folio] Could not prepare the first-run setup token:', error);
  }
}
