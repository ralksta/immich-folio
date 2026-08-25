import { test, expect } from '@playwright/test';

/**
 * Smoke test for every admin route.
 *
 * This exists because of #542: a module-evaluation TDZ error in SettingsEditor
 * took the entire admin panel down in production while all four gates stayed
 * green. tsc could not see it (the read went through a hoisted function),
 * `next build` could not (the module is only evaluated in the browser), the
 * unit tests could not (nothing imports it), and an HTTP smoke check could not
 * (the server renders the shell; the throw happens after hydration).
 *
 * A real browser is the only thing that catches that class of bug, so this
 * spec loads each route and asserts three things: no error boundary, the
 * route's own content actually rendered, and nothing threw during hydration.
 */

/** Matches the fallback playwright.config.ts hands the dev/start server. */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'e2e-admin-password';

/**
 * Each route plus a selector that only exists once that route's own component
 * has rendered. Asserting the admin chrome would not be enough — a page that
 * throws is replaced wholesale by app/error.tsx, but a route that renders an
 * empty shell would still pass.
 */
const ROUTES: { path: string; content: string; name: string }[] = [
  { path: '/admin', content: '.page-builder', name: 'dashboard' },
  { path: '/admin/pages', content: '.page-builder', name: 'pages' },
  { path: '/admin/journal', content: '.journal-studio', name: 'journal' },
  // AnalyticsView falls back to .admin-panel when the analytics API is
  // unreachable, which is the normal case without a live Immich behind it.
  { path: '/admin/analytics', content: '.analytics-view, .admin-panel', name: 'analytics' },
  { path: '/admin/help', content: '.settings-panel', name: 'help' },
  { path: '/admin/settings', content: '.settings-editor', name: 'settings' },
  ...['general', 'theme', 'grid', 'footer', 'legal', 'seo', 'security', 'about'].map((id) => ({
    path: `/admin/settings/${id}`,
    content: '.settings-panel',
    name: `settings/${id}`,
  })),
];

/**
 * Console noise that says nothing about the page's own health. Without a live
 * Immich the status probe and the analytics fetch both fail, and their failures
 * are reported as console errors. Uncaught exceptions are never filtered —
 * those are the signal this test was written for.
 */
const IGNORED_CONSOLE = [
  /Failed to load resource/i,
  /net::ERR_/i,
  /ECONNREFUSED/i,
  /the server responded with a status of 5\d\d/i,
];

function isRealConsoleError(text: string): boolean {
  return !IGNORED_CONSOLE.some((pattern) => pattern.test(text));
}

test('every admin route renders without throwing', async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && isRealConsoleError(message.text())) {
      consoleErrors.push(message.text());
    }
  });

  await page.goto('/admin');

  // A reused local dev server may have been started without ADMIN_PASSWORD.
  // Skipping beats failing on a configuration difference — CI starts its own
  // server with the password set, so it never takes this branch.
  const disabled = await page
    .locator('.admin-disabled')
    .isVisible()
    .catch(() => false);
  test.skip(disabled, 'Admin panel disabled — start the server with ADMIN_PASSWORD set.');

  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page.locator('.page-builder')).toBeVisible({ timeout: 15_000 });

  // One test walking every route rather than one test each: the routes share a
  // login, and expect.soft keeps a broken route from hiding the ones after it.
  // When the panel goes down it usually goes down everywhere, and the useful
  // report is the full list — a run that stops at the first failure was what
  // made #542 look like a Settings problem instead of a panel-wide one.
  for (const route of ROUTES) {
    await test.step(route.name, async () => {
      pageErrors.length = 0;
      consoleErrors.length = 0;

      await page.goto(route.path);

      // app/error.tsx replaces the whole page when a route throws. Assert it
      // first: its absence is what "the panel still works" actually means.
      await expect
        .soft(page.locator('.empty-state__title'), `error boundary on ${route.path}`)
        .toHaveCount(0);
      await expect
        .soft(page.locator(route.content).first(), `no content on ${route.path}`)
        .toBeVisible({ timeout: 15_000 });

      expect.soft(pageErrors, `uncaught exception on ${route.path}`).toEqual([]);
      expect.soft(consoleErrors, `console errors on ${route.path}`).toEqual([]);
    });
  }
});
