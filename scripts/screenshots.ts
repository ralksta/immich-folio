/**
 * Documentation Screenshot Generator
 *
 * Captures every screenshot referenced by README.md, docs/theming.md and
 * docs/journal.md: theme presets, hero styles, grid layouts, light mode, the
 * standard pages (subpage overview, about, map), the lightbox with its EXIF
 * panel, a mobile viewport and — if ADMIN_PASSWORD is set — the admin panel
 * and the journal.
 *
 * Uses Playwright to wait for images to fully load (not just blurhash placeholders).
 *
 * Usage:
 *   npx tsx scripts/screenshots.ts
 *   SCREENSHOT_GRID_PATH=/japan/koyasan-2023 npx tsx scripts/screenshots.ts
 *   SCREENSHOT_PORT=3100 npx tsx scripts/screenshots.ts
 *   SCREENSHOT_ONLY=admin,lightbox npx tsx scripts/screenshots.ts
 *   SCREENSHOT_ONLY=journal SCREENSHOT_JOURNAL_ALBUM="Yufuin" npx tsx scripts/screenshots.ts
 *
 * The journal section writes a throwaway entry built from a real album's
 * photos, shoots the public index, the entry and the studio, then deletes it.
 * SCREENSHOT_JOURNAL_ALBUM picks the album by name; without it the largest one
 * is used.
 *
 * The album used for the grid shots is discovered by walking the running site,
 * since album slugs come from Immich album names. SCREENSHOT_GRID_PATH picks a
 * specific one instead, SCREENSHOT_SUBPAGE_PATH the collection overview.
 *
 * Prerequisites:
 *   - Nothing else listening on SCREENSHOT_PORT (the script manages its own
 *     server; a foreign server on that port would be screenshot instead)
 *   - Playwright browsers installed: npx playwright install chromium
 *
 * Note: this rewrites content/settings.yaml, content/gallery.yaml and
 * content/about.md while it runs and restores all three afterwards — including
 * on Ctrl+C. On a host serving live traffic from the same files, the public site
 * changes with every capture. Run it against a copy of the repo instead.
 *
 * Because the screenshots end up in a public repository, the run replaces the
 * site identity (title, footer, watermark, legal block, about page) with neutral
 * demo values and blanks out every stored password — see DEMO_SETTINGS.
 *
 * Output:
 *   docs/screenshots/*.png
 */

import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import type { Browser, Page } from '@playwright/test';

// Next reads .env.local itself; this script runs outside Next, so ADMIN_PASSWORD
// and friends have to be pulled in explicitly. Must run before the constants below.
loadEnvLocal();

const THEMES = ['studio', 'studio-modern', 'minimal', 'editorial', 'classic', 'noir', 'monograph'];
const HERO_STYLES = ['split', 'fullbleed', 'minimal', 'stacked', 'typographic', 'mosaic'];
const GRID_LAYOUTS = ['masonry', 'uniform', 'showcase', 'filmstrip', 'editorial-flow'];
/** Preset used for everything that is not itself a theme comparison. */
const SHOWCASE_THEME = 'studio-modern';

const PORT = process.env.SCREENSHOT_PORT ?? '3000';
const BASE_URL = `http://localhost:${PORT}`;
/**
 * Album detail page used for the grid screenshots. Discovered by walking the
 * running site, because album slugs come from Immich album names and differ per
 * installation. Set SCREENSHOT_GRID_PATH to pick a specific album instead.
 */
const GRID_PATH_OVERRIDE = process.env.SCREENSHOT_GRID_PATH;
/** Collection overview page. Derived from the grid path when not set. */
const SUBPAGE_PATH_OVERRIDE = process.env.SCREENSHOT_SUBPAGE_PATH;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
/**
 * Comma-separated section keys to capture, e.g. `SCREENSHOT_ONLY=admin,lightbox`.
 * A full pass takes the better part of an hour, so re-shooting one section after
 * a layout change should not mean redoing all of it. Empty means everything.
 */
const ONLY_SECTIONS = (process.env.SCREENSHOT_ONLY ?? '')
  .split(',')
  .map((key) => key.trim())
  .filter(Boolean);
const wanted = (key: string) => ONLY_SECTIONS.length === 0 || ONLY_SECTIONS.includes(key);

const OUTPUT_DIR = path.join(process.cwd(), 'docs', 'screenshots');
const CONTENT_DIR = path.join(process.cwd(), 'content');
const SETTINGS_YAML = path.join(CONTENT_DIR, 'settings.yaml');
const GALLERY_YAML = path.join(CONTENT_DIR, 'gallery.yaml');
const ABOUT_MD = path.join(CONTENT_DIR, 'about.md');
/** Every file the run rewrites, and therefore has to restore. */
const MANAGED_FILES = [SETTINGS_YAML, GALLERY_YAML, ABOUT_MD];
const backupPath = (file: string) => `${file}.screenshot-bak`;

const JOURNAL_DIR = path.join(CONTENT_DIR, 'journal');
/**
 * Slug of the throwaway entry written for the journal screenshots. It is
 * created before the shots and deleted afterwards, so a run never leaves a
 * demo story published on a real site. Namespaced to make an orphan from a
 * killed run obvious.
 */
const DEMO_JOURNAL_SLUG = 'screenshot-demo-entry';
/**
 * Album to pull demo photos from, matched against the Immich album name.
 * Unset picks the album with the most photos, which gives the entry enough
 * frames to fill a fullbleed, a pair and a contained block.
 */
const JOURNAL_ALBUM = process.env.SCREENSHOT_JOURNAL_ALBUM;

/** Pages that never carry a photo grid — skipped while looking for an album. */
const EXCLUDED_PATHS = new Set(['/', '/about', '/map', '/impressum', '/admin']);
const VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 375, height: 812 };
const IMAGE_LOAD_TIMEOUT = 8000; // ms to wait for images after networkidle
/** Settled once the dev server has re-read the changed YAML (mtime-based cache). */
const CONFIG_RELOAD_DELAY = 400;

/**
 * Neutral stand-ins for everything identifying in settings.yaml. The screenshots
 * are published, so the site must not show the operator's name, handle, postal
 * address or watermark. Dotted keys are merged into the parsed YAML.
 */
const DEMO_SETTINGS: Record<string, unknown> = {
  // A run loads every page dozens of times; without this it would write a few
  // hundred fake page views into content/analytics.json.
  analytics: false,
  title: 'My Portfolio Gallery',
  'seo.title': 'My Portfolio Gallery',
  'footer.name': 'My Portfolio Gallery',
  'footer.instagram': 'myportfolio',
  'watermark.text': 'Folio ',
  'legal.name': 'Jane Doe',
  'legal.address': '1 Example Street',
  'legal.zipCity': '12345 Example City',
  'legal.country': 'Germany',
  'legal.extraInfo': '',
};

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Read the originals to restore later. The on-disk backups are what the signal
  // handlers and the top-level catch restore from — an in-memory copy is gone the
  // moment the process is killed, and this script rewrites live content files.
  const originals = new Map(MANAGED_FILES.map((f) => [f, fs.readFileSync(f, 'utf8')]));
  for (const [file, content] of originals) fs.writeFileSync(backupPath(file), content);
  installRestoreHandlers();

  const originalSettings = originals.get(SETTINGS_YAML)!;
  const originalGallery = originals.get(GALLERY_YAML)!;

  /** Writes settings.yaml with the demo identity plus the given overrides. */
  const applySettings = async (overrides: Record<string, unknown> = {}) => {
    fs.writeFileSync(SETTINGS_YAML, settingsWith(originalSettings, overrides));
    await sleep(CONFIG_RELOAD_DELAY);
  };

  // Passwords live in gallery.yaml in plain text and are rendered by the admin
  // page builder — blank them for the whole run rather than per screenshot.
  fs.writeFileSync(GALLERY_YAML, withRedactedPasswords(originalGallery));
  // The about page carries a real name, location and portrait. Swap in demo text
  // and use a gallery photo as the portrait so no face ends up in the docs.
  fs.writeFileSync(ABOUT_MD, demoAboutMarkdown(originalGallery));

  await applySettings();

  console.log(`\n⏳ Starting dev server on ${BASE_URL} ...`);
  let browser: Browser | undefined;

  try {
    await ensureServerHealthy();

    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch();

    // ── Resolve the pages used throughout the run ──
    const scout = await browser.newContext({ viewport: VIEWPORT });
    const scoutPage = await scout.newPage();
    const gridPath = GRID_PATH_OVERRIDE ?? (await discoverGridPath(scoutPage));
    const subpagePath = SUBPAGE_PATH_OVERRIDE ?? (await resolveSubpagePath(scoutPage, gridPath));
    await scout.close();
    console.log(`🔎 Album page:      ${gridPath}`);
    console.log(`🔎 Collection page: ${subpagePath ?? '(none found — skipping)'}`);

    // ── Theme presets: homepage + grid ──
    if (wanted('themes')) {
      for (const theme of THEMES) {
        section(`Theme: ${theme}`);
        await applySettings({ 'theme.preset': theme });
        await withPage(browser, VIEWPORT, async (page) => {
          await captureHome(page, `theme-${theme}-home`);
          await captureGrid(page, gridPath, `theme-${theme}-grid`);
        });
      }
    }

    // ── Light mode ──
    if (wanted('light')) {
      section('Light mode');
      await applySettings({ 'theme.preset': SHOWCASE_THEME });
      await withPage(
        browser,
        VIEWPORT,
        async (page) => {
          await captureHome(page, `theme-${SHOWCASE_THEME}-home-light`);
          await captureGrid(page, gridPath, `theme-${SHOWCASE_THEME}-grid-light`);
        },
        // ThemeToggle reads this on module load and sets data-theme on <html>.
        () => window.localStorage.setItem('theme', 'light'),
      );
    }

    // ── Hero styles ──
    if (wanted('hero')) {
      for (const hero of HERO_STYLES) {
        section(`Hero style: ${hero} (theme: studio)`);
        await applySettings({ 'theme.preset': 'studio', 'theme.heroStyle': hero });
        await withPage(browser, VIEWPORT, (page) => captureHome(page, `hero-${hero}-home`));
      }
    }

    // ── Grid layouts ──
    if (wanted('grid')) {
      for (const layout of GRID_LAYOUTS) {
        section(`Grid layout: ${layout}`);
        await applySettings({ 'theme.preset': SHOWCASE_THEME, 'grid.layout': layout });
        await withPage(browser, VIEWPORT, (page) => captureGrid(page, gridPath, `grid-${layout}`));
      }
    }

    // ── Standard pages ──
    if (wanted('pages')) {
      section('Pages: collection, about, map');
      await applySettings({ 'theme.preset': SHOWCASE_THEME });
      await withPage(browser, VIEWPORT, async (page) => {
        if (subpagePath) await captureGrid(page, subpagePath, 'page-collection');
        await captureHome(page, 'page-about', '/about');
        await capturePage(page, '/map', 'page-map', 6000);
      });
    }

    // ── Lightbox with EXIF panel ──
    if (wanted('lightbox')) {
      section('Lightbox');
      await applySettings({ 'theme.preset': SHOWCASE_THEME });
      await withPage(browser, VIEWPORT, (page) => captureLightbox(page, gridPath));
    }

    // ── Mobile viewport ──
    if (wanted('mobile')) {
      section('Mobile (375x812)');
      await applySettings({ 'theme.preset': SHOWCASE_THEME });
      await withPage(browser, MOBILE_VIEWPORT, async (page) => {
        await captureHome(page, 'mobile-home');
        await captureGrid(page, gridPath, 'mobile-grid');
      });
    }

    // ── Admin panel ──
    if (wanted('admin')) {
      await applySettings({ 'theme.preset': SHOWCASE_THEME });
      await captureAdmin(browser);
    }

    // ── Journal (public views + studio) ──
    if (wanted('journal')) {
      await applySettings({ 'theme.preset': SHOWCASE_THEME });
      await captureJournal(browser);
    }
  } finally {
    await browser?.close();
    await stopDevServer();
    restoreManagedFiles(originals);
  }

  await optimizePngs();

  if (failedSections.length > 0) {
    console.log(`\n⚠️  Incomplete sections: ${failedSections.join(', ')}`);
  }

  console.log(`\n🎉 Done! Screenshots saved to ${OUTPUT_DIR}/`);
  for (const file of fs
    .readdirSync(OUTPUT_DIR)
    .filter((f) => f.endsWith('.png'))
    .sort()) {
    const kb = Math.round(fs.statSync(path.join(OUTPUT_DIR, file)).size / 1024);
    console.log(`   ${file} (${kb} KB)`);
  }
}

/**
 * Re-encode the PNGs losslessly. Playwright optimises for capture speed, not
 * file size — a plain re-encode takes a full-page photo grid from ~2 MB to
 * ~700 KB with identical pixels. sharp ships with Next.js but is not a declared
 * dependency here, so a missing install just skips this step.
 */
async function optimizePngs(): Promise<void> {
  // sharp 0.35 switched from `export =` to ESM: the module namespace stopped
  // being callable and the factory moved to `.default`. Resolve whichever
  // shape the installed version has, so this type-checks and runs on both.
  type SharpFactory = typeof import('sharp') extends { default: infer Factory }
    ? Factory
    : typeof import('sharp');
  let sharp: SharpFactory;
  try {
    const mod = (await import('sharp')) as unknown as { default?: SharpFactory };
    sharp = mod.default ?? (mod as unknown as SharpFactory);
  } catch {
    console.log('\n⏭  sharp not available — screenshots left as captured.');
    return;
  }

  console.log('\n🗜  Optimising PNGs...');
  let before = 0;
  let after = 0;
  for (const file of fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith('.png'))) {
    const filePath = path.join(OUTPUT_DIR, file);
    before += fs.statSync(filePath).size;
    const optimised = await sharp(filePath).png({ compressionLevel: 9, effort: 10 }).toBuffer();
    // Never grow a file — some captures are already minimal.
    if (optimised.length < fs.statSync(filePath).size) fs.writeFileSync(filePath, optimised);
    after += fs.statSync(filePath).size;
  }
  console.log(`   ${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB`);
}

// ── Capture helpers ──────────────────────────────────────────────

let currentSection = '';
/** Sections that threw, reported again at the end of the run. */
const failedSections: string[] = [];

function section(title: string): void {
  currentSection = title;
  console.log(`\n📷 ${title}`);
  console.log('─'.repeat(50));
}

/**
 * Run a capture block in a fresh browser context, so localStorage (light mode)
 * and cookies (admin session) never leak into the next block.
 *
 * A block is retried once — a wedged dev server is replaced in between — and
 * then reported and skipped rather than aborting the run: a full pass takes many
 * minutes, and losing the remaining thirty screenshots because one page
 * misbehaved is worse than a gap in the output. Re-running a block simply
 * overwrites the screenshots it had already taken.
 */
async function withPage(
  browser: Browser,
  viewport: { width: number; height: number },
  fn: (page: Page) => Promise<void>,
  initScript?: () => void,
): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await ensureServerHealthy();
    const context = await browser.newContext({ viewport });
    // The dev server compiles routes on first hit, which can exceed Playwright's
    // 30s default right after a settings change.
    context.setDefaultNavigationTimeout(90000);
    context.setDefaultTimeout(30000);
    if (initScript) await context.addInitScript(initScript);
    const page = await context.newPage();
    try {
      await fn(page);
      return;
    } catch (err) {
      const reason = String(err).split('\n')[0];
      if (attempt === 1) {
        console.error(`  ↻ ${currentSection} failed (${reason}) — retrying`);
      } else {
        failedSections.push(currentSection);
        console.error(`  ⚠️  ${currentSection} failed: ${reason}`);
      }
    } finally {
      await context.close();
    }
  }
}

async function captureHome(page: Page, name: string, urlPath = '/'): Promise<void> {
  await page.goto(`${BASE_URL}${urlPath}`, { waitUntil: 'networkidle' });
  await revealDeferredContent(page);
  await waitForImages(page);
  await capture(page, name);
}

async function captureGrid(page: Page, urlPath: string, name: string): Promise<void> {
  await capturePage(page, urlPath, name, 3000);
}

/** Load a page, reveal everything that fades or lazy-loads in, then shoot it. */
async function capturePage(
  page: Page,
  urlPath: string,
  name: string,
  settleMs: number,
): Promise<void> {
  await page.goto(`${BASE_URL}${urlPath}`, { waitUntil: 'networkidle' });
  await revealDeferredContent(page);
  await waitForImages(page);
  // Extra settle time for late-loading images in lower columns
  await page.waitForTimeout(settleMs);
  await capture(page, name);
}

/**
 * Open the first still image of an album in the lightbox and expand the EXIF
 * panel. Videos are skipped — their tile opens a player, not a photo.
 */
async function captureLightbox(page: Page, gridPath: string): Promise<void> {
  await page.goto(`${BASE_URL}${gridPath}`, { waitUntil: 'networkidle' });
  await revealDeferredContent(page);
  await waitForImages(page);

  const tiles = page.locator('.photo-grid__item');
  const count = await tiles.count();
  for (let i = 0; i < count; i++) {
    const tile = tiles.nth(i);
    if ((await tile.locator('.photo-grid__item-play').count()) > 0) continue;
    await tile.click();
    break;
  }

  await page.keyboard.press('i');
  await page.locator('#exif-panel').waitFor({ state: 'visible', timeout: 5000 });
  await waitForImages(page);
  await page.waitForTimeout(1500);
  await capture(page, 'lightbox-exif');
}

/**
 * Admin panel: login screen, page builder, album picker and settings editor.
 * Skipped with a warning when ADMIN_PASSWORD is unset — the panel is optional
 * and a missing password should not fail the whole run.
 */
async function captureAdmin(browser: Browser): Promise<void> {
  section('Admin panel');
  if (!ADMIN_PASSWORD) {
    console.log('  ⏭  ADMIN_PASSWORD not set — skipping the admin screenshots.');
    return;
  }

  await withPage(browser, VIEWPORT, async (page) => {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
    await page.locator('.admin-login-card').waitFor({ timeout: 15000 });
    await capture(page, 'admin-login');

    await adminLogin(page);
    await page.waitForTimeout(2500);
    await waitForImages(page);
    await capture(page, 'admin-page-builder');

    await captureAlbumPicker(page);

    // Reload rather than trusting Escape to have closed the picker — a modal
    // still on screen swallows the click on the settings tab.
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.admin-tabs').waitFor({ timeout: 20000 });
    await page.locator('.admin-tab', { hasText: 'Settings' }).first().click();
    await page.waitForTimeout(1500);
    await capture(page, 'admin-settings');
  });
}

/**
 * Journal: the public index and entry, plus the studio behind them.
 *
 * Needs an admin session for two separate reasons — the studio shots are
 * behind the login, and the demo entry can only be written with *raw* Immich
 * asset UUIDs, which the public site never exposes (it hands out encrypted
 * tokens). The admin API is the only place those UUIDs are reachable, so the
 * entry is generated from a real album after logging in.
 *
 * The entry is deleted again in the `finally`, including when a capture throws.
 */
async function captureJournal(browser: Browser): Promise<void> {
  section('Journal: index, entry, studio');
  if (!ADMIN_PASSWORD) {
    console.log('  ⏭  ADMIN_PASSWORD not set — skipping the journal screenshots.');
    return;
  }

  const entryPath = path.join(JOURNAL_DIR, `${DEMO_JOURNAL_SLUG}.md`);
  if (fs.existsSync(entryPath)) {
    console.log(`  ⏭  ${DEMO_JOURNAL_SLUG}.md already exists — leaving it alone.`);
    return;
  }

  let written = false;
  try {
    await withPage(browser, VIEWPORT, async (page) => {
      await adminLogin(page);

      const assetIds = await demoAssetIds(page);
      if (assetIds.length < 4) {
        console.log('  ⏭  Not enough photos found for a demo entry — skipping.');
        return;
      }

      fs.mkdirSync(JOURNAL_DIR, { recursive: true });
      fs.writeFileSync(entryPath, demoJournalMarkdown(assetIds));
      written = true;
      await sleep(CONFIG_RELOAD_DELAY);

      // Studio first: the session is already open on this page.
      await capturePage(page, '/admin/journal', 'admin-journal-list', 1500);
      await capturePage(page, `/admin/journal/${DEMO_JOURNAL_SLUG}`, 'admin-journal-studio', 3000);
    });

    // Public views in a fresh context, so the admin cookie cannot leak in and
    // reveal draft-only chrome in a shot meant to show what a visitor sees.
    await withPage(browser, VIEWPORT, async (page) => {
      await capturePage(page, '/journal', 'journal-index', 2500);
      await capturePage(page, `/journal/${DEMO_JOURNAL_SLUG}`, 'journal-entry', 3000);
    });
  } finally {
    if (written && fs.existsSync(entryPath)) {
      fs.rmSync(entryPath, { force: true });
      console.log(`  🧹 Removed the demo entry (${DEMO_JOURNAL_SLUG}.md)`);
    }
  }
}

/** Log in and wait for the panel chrome. Shared by the admin and journal runs. */
async function adminLogin(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
  await page.locator('.admin-login-card input[type="password"]').fill(ADMIN_PASSWORD!);
  await page.locator('.admin-login-card button[type="submit"]').click();
  await page.locator('.admin-tabs').waitFor({ timeout: 20000 });
}

/**
 * Raw asset UUIDs for the demo entry, via the admin API. `page.request` shares
 * the context's cookies, so the session from adminLogin() carries over.
 */
async function demoAssetIds(page: Page): Promise<string[]> {
  const albumsRes = await page.request.get(`${BASE_URL}/api/admin/albums`);
  if (!albumsRes.ok()) return [];
  const albums = (await albumsRes.json()) as
    | { albums?: { id: string; albumName: string; assetCount: number }[] }
    | { id: string; albumName: string; assetCount: number }[];
  const list = Array.isArray(albums) ? albums : (albums.albums ?? []);
  if (list.length === 0) return [];

  const wantedName = JOURNAL_ALBUM?.toLowerCase();
  const album = wantedName
    ? list.find((a) => a.albumName.toLowerCase().includes(wantedName))
    : [...list].sort((a, b) => (b.assetCount ?? 0) - (a.assetCount ?? 0))[0];
  if (!album) {
    console.log(`  ⏭  No album matching "${JOURNAL_ALBUM}" — skipping the journal shots.`);
    return [];
  }
  console.log(`  🔎 Demo entry photos from: ${album.albumName}`);

  const assetsRes = await page.request.get(`${BASE_URL}/api/admin/albums/${album.id}/assets`);
  if (!assetsRes.ok()) return [];
  const payload = (await assetsRes.json()) as
    { assets?: { id: string; type?: string }[] } | { id: string; type?: string }[];
  const assets = Array.isArray(payload) ? payload : (payload.assets ?? []);
  // Videos render a player, not a photo block.
  return assets.filter((a) => (a.type ?? 'IMAGE').toUpperCase() === 'IMAGE').map((a) => a.id);
}

/**
 * A demo entry exercising every block type the parser knows, so the studio and
 * the rendered page both show something representative rather than one
 * paragraph. Deliberately generic prose — these screenshots ship in the docs.
 */
function demoJournalMarkdown(ids: string[]): string {
  const [cover, fullbleed, pairA, pairB, ...rest] = ids;
  const contained = rest[0];
  return `---
title: "A Week in the Highlands"
subtitle: "Notes and photographs from seven days on the road"
author: "Jane Doe"
date: "2026-03-14"
coverAssetId: "${cover}"
---

# Setting Out

The road climbed through the last of the farmland and then simply stopped
pretending. What followed was gravel, meltwater, and a silence that felt less
like the absence of sound than like something with weight to it.

![${fullbleed}:fullbleed](The first pass, an hour after sunrise)

## Finding the Light

Mornings were the only reliable hours. By noon the valley had filled with haze
and every frame came back flatter than it looked through the viewfinder.

> The camera does not record what you saw. It records what was there, which is
> a slower and more honest thing. -- A note from the second evening

![${pairA}, ${pairB}](Two mornings, the same bend in the river)

### What Stayed

Not the landscapes, in the end, but the small repetitions — the same tin mug,
the same twenty minutes of light, the same walk back to the car.
${contained ? `\n![${contained}](The last morning)\n` : ''}`;
}

/** Best effort: the picker is a modal behind a button whose label may change. */
async function captureAlbumPicker(page: Page): Promise<void> {
  const trigger = page.getByRole('button', { name: /add album/i }).first();
  if ((await trigger.count()) === 0) {
    console.log('  ⏭  No "Add album" button found — skipping the album picker shot.');
    return;
  }
  try {
    await trigger.click();
    await page.locator('input[placeholder*="Search" i]').first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(2000);
    await waitForImages(page);
    await capture(page, 'admin-album-picker');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } catch {
    console.log('  ⏭  Album picker did not open in time — skipping that shot.');
  }
}

async function capture(page: Page, name: string): Promise<void> {
  await hideDevOverlays(page);
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}.png`), fullPage: false });
  console.log(`  ✅ ${name}.png`);
}

/**
 * Reveal content that only appears on scroll or interaction: fade-in wrappers
 * stay transparent until their observer fires, and lazy images never load
 * below the fold. Both would otherwise be captured empty.
 */
async function revealDeferredContent(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('.fade-in').forEach((el) => el.classList.add('fade-in--visible'));
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
      (img as HTMLImageElement).loading = 'eager';
    });
  });
}

/** Next.js' dev indicator and the in-app dev toolbar are not part of the product. */
async function hideDevOverlays(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('nextjs-portal').forEach((el) => el.remove());
    document.querySelectorAll('[aria-label="Dev Toolbar"]').forEach((el) => el.remove());
  });
}

// ── Environment ──────────────────────────────────────────────────

/**
 * Minimal .env.local reader. Next loads the file for the dev server it spawns,
 * but this process needs ADMIN_PASSWORD too, and real environment variables
 * must keep winning over the file.
 */
function loadEnvLocal(): void {
  const envFile = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envFile)) return;

  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || line.trimStart().startsWith('#')) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^(["'])(.*)\1$/, '$2');
  }
}

// ── Content rewriting ────────────────────────────────────────────

/**
 * Parse settings.yaml, merge the demo identity plus `overrides` (dotted keys)
 * and dump it back. Comments are lost in the temporary file, which is fine —
 * the original is restored verbatim from its backup, never re-serialised.
 */
function settingsWith(original: string, overrides: Record<string, unknown>): string {
  const doc = (yaml.load(original) ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries({ ...DEMO_SETTINGS, ...overrides })) {
    setPath(doc, key, value);
  }
  return yaml.dump(doc, { lineWidth: 0 });
}

function setPath(target: Record<string, unknown>, dottedKey: string, value: unknown): void {
  const keys = dottedKey.split('.');
  let node = target;
  for (const key of keys.slice(0, -1)) {
    if (typeof node[key] !== 'object' || node[key] === null) node[key] = {};
    node = node[key] as Record<string, unknown>;
  }
  node[keys[keys.length - 1]] = value;
}

/** Replace every `password:` value in gallery.yaml with a throwaway one. */
function withRedactedPasswords(original: string): string {
  const doc = yaml.load(original);
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== 'object' || node === null) return;
    const record = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (key === 'password' && typeof value === 'string') record[key] = 'demo';
      else walk(value);
    }
  };
  walk(doc);
  return yaml.dump(doc, { lineWidth: 0 });
}

/**
 * A demo about page. The portrait is taken from the gallery's hero images so the
 * layout is shown with a real photo without publishing the operator's face, and
 * without hardcoding an asset UUID into the repository.
 */
function demoAboutMarkdown(galleryYaml: string): string {
  const gallery = (yaml.load(galleryYaml) ?? {}) as { hero?: unknown };
  const hero = Array.isArray(gallery.hero) ? gallery.hero : [];
  const portrait = typeof hero[0] === 'string' ? hero[0] : '';

  const frontmatter = [
    portrait ? `portrait: ${portrait}` : null,
    'name: Alex Rivera',
    'location: Kyoto, Japan',
    'gear:',
    '  - Leica Q3',
    '  - Summilux 35mm f/1.4',
    '  - Summicron 50mm f/2',
  ].filter((line): line is string => line !== null);

  return [
    '---',
    ...frontmatter,
    '---',
    '',
    'Photographer and traveller.',
    'Obsessed with light, geometry, and the quiet in-between.',
    '',
  ].join('\n');
}

// ── Page discovery ───────────────────────────────────────────────

/**
 * Find an album detail page by walking the running site.
 *
 * Album slugs are derived from Immich album names, so no path can be hardcoded
 * without tying the script to one installation. Start at the homepage, follow
 * internal links, and take the first page that renders a photo grid — either a
 * standalone album, or an album reached through a subpage's cover grid.
 * Password-gated pages are skipped.
 */
async function discoverGridPath(page: Page): Promise<string> {
  const seen = new Set<string>();

  const internalLinks = async (selector: string): Promise<string[]> =>
    (
      await page.$$eval(selector, (els) =>
        els.map((el) => el.getAttribute('href')).filter((h): h is string => !!h),
      )
    ).filter((href) => href.startsWith('/') && !EXCLUDED_PATHS.has(href) && !seen.has(href));

  /** A photo grid means we arrived at an album; a password field means we cannot. */
  const pageKind = async (): Promise<'grid' | 'gated' | 'other'> => {
    if ((await page.locator('input[type="password"]').count()) > 0) return 'gated';
    if ((await page.locator('.photo-grid, .essay').count()) > 0) return 'grid';
    return 'other';
  };

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const entryPoints = await internalLinks('a[href^="/"]');

  for (const entry of entryPoints) {
    seen.add(entry);
    await page.goto(`${BASE_URL}${entry}`, { waitUntil: 'networkidle' });

    const kind = await pageKind();
    if (kind === 'gated') continue;
    if (kind === 'grid') return entry;

    // A subpage listing — descend into its album covers.
    for (const cover of await internalLinks('.subpage-grid__item, .album-card')) {
      seen.add(cover);
      await page.goto(`${BASE_URL}${cover}`, { waitUntil: 'networkidle' });
      if ((await pageKind()) === 'grid') return cover;
    }
  }

  throw new Error(
    'Could not find a public album page to screenshot. Every reachable page was ' +
      'password-protected or empty. Point the script at a specific album with ' +
      'SCREENSHOT_GRID_PATH=/my-subpage/my-album npx tsx scripts/screenshots.ts',
  );
}

/**
 * The collection overview belonging to the album, i.e. `/japan` for
 * `/japan/koyasan-2023`. Standalone albums have no parent, so fall back to the
 * first navigation entry that renders a subpage grid; null if there is none.
 */
async function resolveSubpagePath(page: Page, gridPath: string): Promise<string | null> {
  const segments = gridPath.split('/').filter(Boolean);
  if (segments.length > 1) return `/${segments[0]}`;

  const links = await page.$$eval('nav a[href^="/"]', (els) =>
    els.map((el) => el.getAttribute('href')).filter((h): h is string => !!h),
  );
  for (const href of links) {
    if (EXCLUDED_PATHS.has(href) || href === gridPath) continue;
    await page.goto(`${BASE_URL}${href}`, { waitUntil: 'networkidle' });
    if ((await page.locator('.subpage-grid').count()) > 0) return href;
  }
  return null;
}

// ── Content restore ──────────────────────────────────────────────

function restoreManagedFiles(originals: Map<string, string>): void {
  for (const [file, content] of originals) {
    fs.writeFileSync(file, content);
    fs.rmSync(backupPath(file), { force: true });
  }
  console.log('\n✅ Restored original content files');
}

/**
 * Restore the content files when the process is killed. Without this, Ctrl+C in
 * the middle of a run leaves the site on whatever theme was being captured —
 * which matters because these files are the live configuration.
 */
function installRestoreHandlers(): void {
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    for (const file of MANAGED_FILES) {
      try {
        if (!fs.existsSync(backupPath(file))) continue;
        fs.writeFileSync(file, fs.readFileSync(backupPath(file), 'utf8'));
        fs.rmSync(backupPath(file), { force: true });
      } catch {
        console.error(
          `\n⚠️  Could not restore ${file} automatically. Copy it back from ${backupPath(file)}`,
        );
      }
    }
    console.log('\n✅ Restored original content files');
  };

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => {
      restore();
      process.exit(130);
    });
  }
}

// ── Server lifecycle ─────────────────────────────────────────────

/**
 * One dev server for the whole run. The YAML loader caches by mtime and the
 * pages are force-dynamic, so a rewritten settings.yaml is picked up by the next
 * request — restarting the server per theme would only cost startup time.
 *
 * It does not always survive a full pass though: after a few dozen recompiles
 * the dev server occasionally stops answering, which used to turn into a run of
 * navigation timeouts. ensureServerHealthy() replaces it when that happens.
 */
let devServer: ChildProcess | undefined;

async function ensureServerHealthy(): Promise<void> {
  if (devServer && (await serverResponds())) return;
  if (devServer) {
    console.log('  ♻️  Dev server stopped responding — restarting it');
    await stopDevServer();
  }
  devServer = startDevServer();
  await waitForServer(BASE_URL, 90000);
  console.log('  ✅ Server ready');
}

async function serverResponds(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(20000) });
    return res.ok;
  } catch {
    return false;
  }
}

function startDevServer(): ChildProcess {
  const server = spawn('npm', ['run', 'dev'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: { ...process.env, PORT },
    detached: true,
  });

  // Suppress server output unless DEBUG is set
  if (process.env.DEBUG) {
    server.stdout?.pipe(process.stdout);
    server.stderr?.pipe(process.stderr);
  }

  return server;
}

async function stopDevServer(): Promise<void> {
  const server = devServer;
  devServer = undefined;
  if (!server) return;
  if (server.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      // Already gone
    }
  }
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 3000);
    server.on('close', () => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
  console.log('🛑 Server stopped');
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      // /api/health does not touch Immich, so it answers as soon as the server
      // is up rather than waiting on the first album fetch.
      const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(10000) });
      if (res.ok) return;
    } catch {
      // Server not ready yet
    }
    await sleep(500);
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

/**
 * Wait for all <img> elements to finish loading their full-resolution images.
 * This prevents capturing blurhash placeholders instead of real photos.
 */
async function waitForImages(page: Page): Promise<void> {
  await page.waitForTimeout(1000); // Initial settle

  await page.evaluate((timeout) => {
    return new Promise<void>((resolve) => {
      const images = Array.from(document.querySelectorAll('img'));
      let pending = images.filter((img) => !img.complete).length;

      if (pending === 0) {
        // All images already loaded, wait a bit for any CSS transitions
        setTimeout(resolve, 500);
        return;
      }

      // Every callback below is inline and anonymous on purpose: tsx compiles
      // this file with esbuild's keepNames, which rewrites *named* functions
      // into `__name(fn, '…')` — and that helper does not exist in the page.
      images.forEach((img) => {
        if (!img.complete) {
          img.addEventListener('load', () => {
            if (--pending <= 0) setTimeout(resolve, 500);
          });
          img.addEventListener('error', () => {
            if (--pending <= 0) setTimeout(resolve, 500);
          });
        }
      });

      // Safety timeout
      setTimeout(resolve, timeout);
    });
  }, IMAGE_LOAD_TIMEOUT);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Run ──────────────────────────────────────────────────────────
main().catch((err) => {
  console.error('❌ Screenshot generation failed:', err);
  // The finally block normally restores; this covers a throw before it is reached.
  for (const file of MANAGED_FILES) {
    try {
      if (!fs.existsSync(backupPath(file))) continue;
      fs.writeFileSync(file, fs.readFileSync(backupPath(file), 'utf8'));
      fs.rmSync(backupPath(file), { force: true });
      console.log(`✅ Restored ${path.basename(file)}`);
    } catch {
      console.error(`⚠️  Restore failed — copy ${file} back from ${backupPath(file)}`);
    }
  }
  process.exit(1);
});
