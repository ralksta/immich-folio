/**
 * Theme Screenshot Generator
 *
 * Captures homepage and grid view screenshots for each theme preset.
 * Uses Playwright to wait for images to fully load (not just blurhash placeholders).
 *
 * Usage:
 *   npx tsx scripts/screenshots.ts
 *
 * Prerequisites:
 *   - Dev server NOT running (script manages its own server lifecycle)
 *   - Playwright browsers installed: npx playwright install chromium
 *
 * Output:
 *   docs/screenshots/theme-{preset}-{page}.png
 */

import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

const THEMES = ['studio', 'minimal', 'editorial', 'classic', 'noir', 'monograph'];
const BASE_URL = 'http://localhost:3000';
const GRID_PATH = '/deutschland/kloster-chorin'; // public subpage with photos
const OUTPUT_DIR = path.join(process.cwd(), 'docs', 'screenshots');
const SETTINGS_YAML = path.join(process.cwd(), 'content', 'settings.yaml');
const VIEWPORT = { width: 1440, height: 900 };
const IMAGE_LOAD_TIMEOUT = 8000; // ms to wait for images after networkidle

async function main() {
  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Read original settings.yaml to restore later
  const originalYaml = fs.readFileSync(SETTINGS_YAML, 'utf8');

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
      await page.goto(`${BASE_URL}${GRID_PATH}`, { waitUntil: 'networkidle' });
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
    console.log('\n✅ Restored original gallery.yaml');
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
  const marker = '# Presets: studio, minimal, editorial, classic, noir, monograph';
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
  // Try to restore gallery.yaml on error
  try {
    const original = fs.readFileSync(SETTINGS_YAML + '.bak', 'utf8');
    fs.writeFileSync(SETTINGS_YAML, original);
  } catch {
    // Backup may not exist
  }
  process.exit(1);
});
