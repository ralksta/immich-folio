/**
 * Contrast audit — every preset, light and dark, in a real browser.
 *
 * Opens a running instance, switches `data-preset` and `data-theme` on <html>
 * (all preset stylesheets are loaded globally, so no config change is needed)
 * and runs axe-core's `color-contrast` rule on each page. Reading the CSS is
 * not enough: an inline style or an `opacity` on top of a tuned token only
 * shows up in the computed colours.
 *
 * Pages are discovered from the running site: the start page, every header
 * nav link, the first album found on a subpage, and /about, /map, /impressum
 * when they answer 200.
 *
 * Usage:
 *   npm run audit:contrast                           # http://localhost:3000
 *   npm run audit:contrast -- http://localhost:7211  # any running instance
 *   npm run audit:contrast -- --light                # one theme only
 *
 * Analytics requests are blocked, so an audit does not count as visits.
 * Exits 1 when any failure is found.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

// Keep in sync with the presets in lib/config/theme.ts.
const PRESETS = ['studio-modern', 'studio', 'minimal', 'editorial', 'classic', 'noir', 'monograph'];
const FIXED_PAGES = ['/about', '/map', '/impressum'];

const print = (line = '') => process.stdout.write(line + '\n');

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith('--')) ?? 'http://localhost:3000').replace(/\/$/, '');
const themes = args.includes('--light')
  ? ['light']
  : args.includes('--dark')
    ? ['dark']
    : ['light', 'dark'];

async function discoverPages(page) {
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const nav = await page.$$eval('a.header__nav-link', (as) =>
    as.map((a) => a.getAttribute('href')),
  );
  const pages = new Set(['/', ...nav.filter((h) => h && h.startsWith('/'))]);

  // One album is enough: album pages share their markup.
  for (const href of nav) {
    if (!href?.startsWith('/')) continue;
    await page.goto(base + href, { waitUntil: 'networkidle' });
    const album = await page
      .$eval('a.subpage-grid__item', (a) => a.getAttribute('href'))
      .catch(() => null);
    if (album) {
      pages.add(album);
      break;
    }
  }

  for (const path of FIXED_PAGES) {
    const res = await page.goto(base + path).catch(() => null);
    if (res?.status() === 200) pages.add(path);
  }
  return [...pages];
}

async function auditPage(page, path) {
  const res = await page.goto(base + path, { waitUntil: 'networkidle' });
  if (!res || res.status() >= 400)
    return [{ path, error: res ? res.status() : 'navigation failed' }];

  // Load the lazy covers, so axe sees images behind text where they exist.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.addScriptTag({ content: axeSource });

  const found = [];
  for (const theme of themes) {
    for (const preset of PRESETS) {
      await page.evaluate(
        ([p, t]) => {
          document.documentElement.setAttribute('data-preset', p);
          document.documentElement.setAttribute('data-theme', t);
        },
        [preset, theme],
      );
      await page.waitForTimeout(400); // let the theme transition settle
      const nodes = await page.evaluate(async () => {
        const result = await window.axe.run(document, {
          runOnly: { type: 'rule', values: ['color-contrast'] },
          resultTypes: ['violations'],
        });
        return result.violations.flatMap((v) =>
          v.nodes.map((n) => ({
            target: n.target.join(' '),
            text: (document.querySelector(n.target[0])?.textContent ?? '').trim().slice(0, 40),
            ratio: n.any[0]?.data?.contrastRatio,
            fg: n.any[0]?.data?.fgColor,
            bg: n.any[0]?.data?.bgColor,
          })),
        );
      });
      for (const n of nodes) found.push({ path, theme, preset, ...n });
    }
  }
  return found;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.route('**/api/analytics/**', (route) => route.abort());

const pages = await discoverPages(page);
print(
  `Auditing ${pages.length} pages × ${PRESETS.length} presets × ${themes.join('+')} on ${base}\n`,
);

const failures = [];
for (const path of pages) failures.push(...(await auditPage(page, path)));
await browser.close();

for (const f of failures) {
  if (f.error) {
    print(`ERROR    ${f.path}: ${f.error}`);
    continue;
  }
  print(
    `${f.theme.padEnd(6)} ${f.preset.padEnd(14)} ${String(f.ratio).padEnd(5)} ${f.fg} on ${f.bg}  ${f.path}  ${f.target} "${f.text}"`,
  );
}

const summary = themes
  .map((t) => `${t}: ${failures.filter((f) => f.theme === t).length}`)
  .join(', ');
print(`\n${failures.length} contrast failure(s) — ${summary}`);
process.exit(failures.length ? 1 : 0);
