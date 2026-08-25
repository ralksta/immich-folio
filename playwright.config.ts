import { defineConfig, devices } from '@playwright/test';

// Overridable so a run can sidestep a dev server or container already holding
// the default port; CI leaves it alone.
const PORT = process.env.E2E_PORT || '3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // The admin smoke test (e2e/admin-smoke.spec.ts) exists to catch bugs that
    // only surface in a real browser against a real build — #542 was invisible
    // to the dev server's on-demand compilation path. E2E_START=1 points the
    // suite at `npm run start` so CI exercises the same output that ships.
    command:
      process.env.E2E_START === '1' ? `npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      // Without this the admin panel reports itself disabled and the smoke
      // test skips. A local run that already exports ADMIN_PASSWORD keeps it.
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'e2e-admin-password',
    },
  },
});
