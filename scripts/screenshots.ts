/**
 * Theme Screenshot Generator
 *
 * Captures homepage and grid view screenshots for each theme preset.
 * Uses Playwright to wait for images to fully load (not just blurhash placeholders).
 *
 * Usage:
 *   npx tsx scripts/screenshots.ts
 *   SCREENSHOT_GRID_PATH=/japan/tokyo npx tsx scripts/screenshots.ts
 *
 * The album used for the grid shots is discovered by walking the running site,
 * since album slugs come from Immich album names. SCREENSHOT_GRID_PATH picks a
 * specific one instead.
 *
 * Prerequisites:
 *   - Dev server NOT running (script manages its own server lifecycle, and a
 *     foreign server on :3000 would be screenshot instead of this one)
 *   - Playwright browsers installed: npx playwright install chromium
 *
 * Note: this rewrites content/settings.yaml for each theme and restores it
 * afterwards — including on Ctrl+C. On a host serving live traffic from the same
 * file, the public site changes theme for the duration of the run.
 *
 * Output:
 *   docs/screenshots/theme-{preset}-{page}.png
 */

import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

const THEMES = ['studio', 'studio-modern', 'minimal', 'editorial', 'classic', 'noir', 'monograph'];
const BASE_URL = 'http://localhost:3000';
/**
 * Album detail page used for the grid screenshots. Discovered by walking the
 * running site, because album slugs come from Immich album names and differ per
 * installation. Set SCREENSHOT_GRID_PATH to pick a specific album instead.
 */
const GRID_PATH_OVERRIDE = process.env.SCREENSHOT_GRID_PATH;
const OUTPUT_DIR = path.join(process.cwd(), 'docs', 'screenshots');
const SETTINGS_YAML = path.join(process.cwd(), 'content', 'settings.yaml');
const SETTINGS_YAML_BACKUP = `${SETTINGS_YAML}.screenshot-bak`;
/** Pages that never carry a photo grid — skipped while looking for an album. */
const EXCLUDED_PATHS = new Set(['/', '/about', '/map', '/impressum', '/admin']);
const VIEWPORT = { width: 1440, height: 900 };
const IMAGE_LOAD_TIMEOUT = 8000; // ms to wait for images after networkidle

async function main() {
  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Read original settings.yaml to restore later. The on-disk copy is what the
  // signal handlers and the top-level catch restore from — an in-memory copy is
  // gone the moment the process is killed, and this script rewrites the live
  // settings.yaml on every iteration.
  const originalYaml = fs.readFileSync(SETTINGS_YAML, 'utf8');
  fs.writeFileSync(SETTINGS_YAML_BACKUP, originalYaml);
  installRestoreHandlers();

  // Resolved once against the running site, then reused for every theme.
  let gridPath: string | null = GRID_PATH_OVERRIDE ?? null;

  // Dynamic import for Playwright (may not be installed globally)
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();

  try {
    for (const theme of THEMES) {
      console.log(`\n🎨 Theme: ${theme}`);
      console.log('─'.repeat(50));

      // Update settings.yaml with the theme
      const yamlWithTheme = setThemeInSettingsYaml(originalYaml, theme);
      fs.writeFileSync(SETTINGS_YAML, yamlWithTheme);

      // Start dev server
      console.log('  ⏳ Starting dev server...');
      const server = startDevServer();
      await waitForServer(BASE_URL, 15000);
      console.log('  ✅ Server ready');

      const context = await browser.newContext({ viewport: VIEWPORT });
      const page = await context.newPage();

      // ── Homepage screenshot ──
      console.log('  📸 Capturing homepage...');
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await waitForImages(page);
      await page.screenshot({
        path: path.join(OUTPUT_DIR, `theme-${theme}-home.png`),
        fullPage: false,
      });
      console.log(`  ✅ theme-${theme}-home.png`);

      // ── Grid view screenshot ──
      console.log('  📸 Capturing grid view...');
      if (!gridPath) {
        gridPath = await discoverGridPath(page);
        console.log(`  🔎 Grid page: ${gridPath}`);
      }
      await page.goto(`${BASE_URL}${gridPath}`, { waitUntil: 'networkidle' });
      // Force all fade-in elements visible (don't scroll — keep album title in view)
      await page.evaluate(() => {
        document.querySelectorAll('.fade-in').forEach((el) => el.classList.add('fade-in--visible'));
        // Trigger lazy images by switching to eager loading
        document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
          (img as HTMLImageElement).loading = 'eager';
        });
      });
      await waitForImages(page);
      // Extra settle time for late-loading images in lower columns
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: path.join(OUTPUT_DIR, `theme-${theme}-grid.png`),
        fullPage: false,
      });
      console.log(`  ✅ theme-${theme}-grid.png`);

      await context.close();

      // Stop dev server
      if (server.pid) {
        process.kill(-server.pid, 'SIGTERM');
      }
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 3000);
        server.on('close', () => {
          clearTimeout(timeout);
          resolve(null);
        });
      });
      console.log('  🛑 Server stopped');
    }

    const HERO_STYLES = ['split', 'fullbleed', 'minimal', 'stacked', 'typographic', 'mosaic'];
    for (const hero of HERO_STYLES) {
      console.log(`\n🖼 Hero Style: ${hero} (Theme: studio)`);
      console.log('─'.repeat(50));

      const yamlWithTheme = setThemeInSettingsYaml(originalYaml, 'studio');
      const yamlWithHero = setHeroStyleInSettingsYaml(yamlWithTheme, hero);
      fs.writeFileSync(SETTINGS_YAML, yamlWithHero);

      console.log('  ⏳ Starting dev server...');
      const server = startDevServer();
      await waitForServer(BASE_URL, 15000);
      console.log('  ✅ Server ready');

      const context = await browser.newContext({ viewport: VIEWPORT });
      const page = await context.newPage();

      console.log('  📸 Capturing homepage hero...');
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await waitForImages(page);
      await page.screenshot({
        path: path.join(OUTPUT_DIR, `hero-${hero}-home.png`),
        fullPage: false,
      });
      console.log(`  ✅ hero-${hero}-home.png`);

      await context.close();

      if (server.pid) {
        process.kill(-server.pid, 'SIGTERM');
      }
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 3000);
        server.on('close', () => {
          clearTimeout(timeout);
          resolve(null);
        });
      });
      console.log('  🛑 Server stopped');
    }
  } finally {
    // Always restore original settings.yaml
    fs.writeFileSync(SETTINGS_YAML, originalYaml);
    fs.rmSync(SETTINGS_YAML_BACKUP, { force: true });
    console.log('\n✅ Restored original settings.yaml');
    await browser.close();
  }

  console.log(`\n🎉 Done! Screenshots saved to ${OUTPUT_DIR}/`);
  console.log(
    `   ${fs
      .readdirSync(OUTPUT_DIR)
      .filter((f) => f.endsWith('.png'))
      .join(', ')}`,
  );
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Find an album detail page by walking the running site.
 *
 * Album slugs are derived from Immich album names, so no path can be hardcoded
 * without tying the script to one installation. Start at the homepage, follow
 * internal links, and take the first page that renders a photo grid — either a
 * standalone album, or an album reached through a subpage's cover grid.
 * Password-gated pages are skipped.
 */
async function discoverGridPath(page: import('@playwright/test').Page): Promise<string> {
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
 * Restore settings.yaml when the process is killed. Without this, Ctrl+C in the
 * middle of a run leaves the site on whatever theme was being captured — which
 * matters because the file this script rewrites is the live configuration.
 */
function installRestoreHandlers(): void {
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    try {
      fs.writeFileSync(SETTINGS_YAML, fs.readFileSync(SETTINGS_YAML_BACKUP, 'utf8'));
      fs.rmSync(SETTINGS_YAML_BACKUP, { force: true });
      console.log('\n✅ Restored original settings.yaml');
    } catch {
      console.error(
        `\n⚠️  Could not restore settings.yaml automatically. ` +
          `Copy it back from ${SETTINGS_YAML_BACKUP}`,
      );
    }
  };

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => {
      restore();
      process.exit(130);
    });
  }
}

/**
 * Replace the theme preset in settings.yaml.
 * Handles both `theme: preset` shorthand and `theme:\n  preset: "x"` block.
 */
function setThemeInSettingsYaml(yaml: string, theme: string): string {
  // Handle `  preset: "studio"` or `  preset: studio` (block format)
  if (/^  preset:\s*/m.test(yaml)) {
    return yaml.replace(/^  preset:\s*.+$/m, `  preset: "${theme}"`);
  }
  // Handle `theme: studio` shorthand
  if (/^theme:\s*\w+\s*$/m.test(yaml)) {
    return yaml.replace(/^theme:\s*\w+\s*$/m, `theme: ${theme}`);
  }
  // Fallback: insert block after the theme comment
  const marker = '# Presets: studio, studio-modern, minimal, editorial, classic, noir, monograph';
  if (yaml.includes(marker)) {
    return yaml.replace(marker, `${marker}\ntheme: ${theme}`);
  }
  return yaml + `\ntheme: ${theme}\n`;
}

/**
 * Replace the heroStyle in settings.yaml.
 */
function setHeroStyleInSettingsYaml(yaml: string, style: string): string {
  if (/^  heroStyle:\s*/m.test(yaml)) {
    return yaml.replace(/^  heroStyle:\s*.+$/m, `  heroStyle: "${style}"`);
  }
  return yaml;
}

function startDevServer(): ChildProcess {
  const server = spawn('npm', ['run', 'dev'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: { ...process.env },
    detached: true,
  });

  // Suppress server output unless DEBUG is set
  if (process.env.DEBUG) {
    server.stdout?.pipe(process.stdout);
    server.stderr?.pipe(process.stderr);
  }

  return server;
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
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
async function waitForImages(page: import('@playwright/test').Page): Promise<void> {
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

      const done = () => {
        pending--;
        if (pending <= 0) setTimeout(resolve, 500);
      };

      images.forEach((img) => {
        if (!img.complete) {
          img.addEventListener('load', done);
          img.addEventListener('error', done);
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
  try {
    if (fs.existsSync(SETTINGS_YAML_BACKUP)) {
      fs.writeFileSync(SETTINGS_YAML, fs.readFileSync(SETTINGS_YAML_BACKUP, 'utf8'));
      fs.rmSync(SETTINGS_YAML_BACKUP, { force: true });
      console.log('✅ Restored original settings.yaml');
    }
  } catch {
    console.error(`⚠️  Restore failed — copy settings.yaml back from ${SETTINGS_YAML_BACKUP}`);
  }
  process.exit(1);
});
