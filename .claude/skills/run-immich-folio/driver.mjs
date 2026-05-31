/**
 * Immich Folio smoke driver.
 *
 * Usage (run from repo root):
 *   node .claude/skills/run-immich-folio/driver.mjs [BASE_URL]
 *
 * BASE_URL defaults to http://localhost:3001.
 * Screenshots land in /tmp/shots/.
 *
 * Exits 0 on success, 1 on any failure.
 */

import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';

const BASE = process.argv[2] ?? process.env.BASE_URL ?? 'http://localhost:3001';
const SHOTS = '/tmp/shots';
mkdirSync(SHOTS, { recursive: true });

let browser;
try {
  browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  // ── 1. Homepage ──────────────────────────────────────────────
  console.log('[1/4] Homepage...');
  await page.goto(`${BASE}/`);
  await page.waitForLoadState('networkidle');
  const title = await page.title();
  if (!title) throw new Error('Homepage has no title');
  console.log(`      title: ${title}`);
  await page.screenshot({ path: `${SHOTS}/01-homepage.png` });
  console.log(`      → ${SHOTS}/01-homepage.png`);

  // ── 2. First nav subpage ─────────────────────────────────────
  // Grab the first subpage link from the header nav (skip "Home" and "About")
  const firstSubpageHref = await page.$eval(
    '.header__nav a:not([href="/"]):not([href="/about"]):not([href="/map"])',
    el => el.getAttribute('href'),
  );
  if (!firstSubpageHref) throw new Error('No subpage nav link found');
  console.log(`[2/4] Subpage: ${firstSubpageHref}`);
  await page.goto(`${BASE}${firstSubpageHref}`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SHOTS}/02-subpage.png` });
  console.log(`      → ${SHOTS}/02-subpage.png`);

  // ── 3. Album detail ──────────────────────────────────────────
  // Album cards on a subpage grid use class "subpage-grid__item".
  // Navigate by href (not click) — click + networkidle can race with RSC streaming.
  const albumCard = page.locator('a.subpage-grid__item').first();
  const albumHref = await albumCard.getAttribute('href').catch(() => null);
  if (albumHref) {
    console.log(`[3/4] Album: ${albumHref}`);
    await page.goto(`${BASE}${albumHref}`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SHOTS}/03-album-detail.png` });
    console.log(`      → ${SHOTS}/03-album-detail.png`);
  } else {
    // Subpage had only one album — we're already on the album detail
    console.log('[3/4] Already on album detail (single-album subpage)');
    await page.screenshot({ path: `${SHOTS}/03-album-detail.png` });
    console.log(`      → ${SHOTS}/03-album-detail.png`);
  }

  // ── 4. Health endpoint ───────────────────────────────────────
  console.log('[4/4] API health...');
  const health = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/api/health`);
    return r.json();
  }, BASE);
  console.log(`      ${JSON.stringify(health)}`);
  if (health.status !== 'ok') throw new Error(`Health check failed: ${JSON.stringify(health)}`);

  // ── Summary ───────────────────────────────────────────────────
  const appErrors = consoleErrors.filter(e => !e.includes('eval() is not supported'));
  if (appErrors.length > 0) {
    console.warn(`\n⚠  Console errors (${appErrors.length}):`);
    appErrors.forEach(e => console.warn('  ', e));
  }

  console.log(`\n✓ All checks passed. Screenshots in ${SHOTS}/`);
} finally {
  await browser?.close();
}
