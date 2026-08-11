/**
 * Install wizard support.
 *
 * The wizard is the first-run path: /install walks a fresh deployment through
 * connecting to Immich, picking albums (optional), and naming the site, then
 * writes content/gallery.yaml, content/settings.yaml and a small
 * content/install.json carrying the Immich credentials, the generated site
 * secret and an optional admin password.
 *
 * content/install.json exists because a running process cannot pick up new
 * process.env values — the wizard has to write configuration that takes effect
 * without a restart. getInstallCredentials() merges it *under* the real
 * environment, so env vars (Docker, .env.local) always win and rotating a
 * credential is a matter of setting the corresponding env var.
 *
 * Once gallery.yaml exists and the credentials resolve, isInstalled() is true
 * and /install — the page and both API routes — refuses to run again.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import yaml from 'js-yaml';
import { env } from './env';
import type { GalleryYaml, SettingsYaml } from './config/schema';

/** The directory user content is written into. Overridable for tests. */
function installContentDir(): string {
  return env.INSTALL_CONTENT_DIR || path.join(process.cwd(), 'content');
}

const INSTALL_FILENAME = 'install.json';

// ── One-time setup token —─────────────────────────────────────

const SETUP_TOKEN_FILENAME = '.setup-token';

/**
 * A random token that gates the install page and the install API routes. It is
 * printed to the server log on first access; the operator reads it from the
 * container / process logs and supplies it as a query parameter or an
 * `x-setup-token` header.
 *
 * Without this token the install endpoints are reachable by anyone who knows
 * the URL — which is the whole internet if the app is deployed before
 * `gallery.yaml` exists.
 *
 * It lives in a file rather than a module variable because Next.js bundles the
 * page and each route handler separately: a module-level token gives
 * /install one value and /api/install another, inside the same process. The
 * page would render the wizard and the API would then reject the very token it
 * had just printed, leaving the wizard stuck on step 1 with no way forward.
 * The file is the only state both bundles agree on — and it survives a restart,
 * so the operator does not have to hunt through the logs again.
 */
function generateSetupToken(): string {
  const dir = installContentDir();
  const tokenPath = path.join(dir, SETUP_TOKEN_FILENAME);

  try {
    const existing = fs.readFileSync(tokenPath, 'utf8').trim();
    if (existing) return existing;
  } catch {
    // Not created yet — fall through and mint one.
  }

  const token = crypto.randomBytes(24).toString('base64url');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tokenPath, `${token}\n`, { mode: 0o600 });
  return token;
}

let _tokenLogged = false;

export function getSetupToken(): string {
  const token = generateSetupToken();
  if (!_tokenLogged) {
    _tokenLogged = true;
    console.log('\n══════════════════════════════════════════════════════');
    console.log('  Immich Folio — First-run setup token');
    console.log('══════════════════════════════════════════════════════');
    console.log(`  Token:  ${token}`);
    console.log('');
    console.log('  Append ?token= to the /install URL (or include it as');
    console.log('  an X-Setup-Token header on API requests) to access');
    console.log('  the install wizard.');
    console.log('══════════════════════════════════════════════════════\n');
  }
  return token;
}

export function validateSetupToken(token: string | null): boolean {
  if (!token) return false;
  const expected = generateSetupToken();
  try {
    const a = Buffer.from(token, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Credential management —────────────────────────────────━━━━

/** Credentials the running app should use, env vars taking precedence. */
export interface InstallCredentials {
  apiUrl: string;
  apiKey: string;
  authSecret: string;
  adminPassword: string;
}

/** Raw contents of content/install.json. */
interface InstallFileData {
  apiUrl?: string;
  apiKey?: string;
  authSecret?: string;
  adminPassword?: string;
}

let cachedInstallFile: { path: string; mtimeMs: number; data: InstallFileData } | null = null;

function readInstallFile(): InstallFileData {
  const installPath = path.join(installContentDir(), INSTALL_FILENAME);

  let mtimeMs = 0;
  try {
    mtimeMs = fs.statSync(installPath).mtimeMs;
  } catch {
    // File does not exist — no wizard-installed credentials.
    cachedInstallFile = null;
    return {};
  }

  if (
    cachedInstallFile &&
    cachedInstallFile.path === installPath &&
    cachedInstallFile.mtimeMs === mtimeMs
  ) {
    return cachedInstallFile.data;
  }

  let data: InstallFileData = {};
  try {
    data = JSON.parse(fs.readFileSync(installPath, 'utf8')) as InstallFileData;
  } catch (err) {
    console.warn('[Install] content/install.json is not valid JSON — ignoring it.', err);
  }

  cachedInstallFile = { path: installPath, mtimeMs, data };
  return data;
}

/**
 * Merge wizard-installed credentials with the real environment.
 *
 * Env wins: someone who sets IMMICH_API_URL/IMMICH_API_KEY/AUTH_SECRET/
 * ADMIN_PASSWORD after installing keeps the env value, which is how rotation
 * works without touching the wizard files.
 */
export function getInstallCredentials(): InstallCredentials {
  const file = readInstallFile();
  return {
    apiUrl: env.IMMICH_API_URL || file.apiUrl || '',
    apiKey: env.IMMICH_API_KEY || file.apiKey || '',
    authSecret: env.AUTH_SECRET || file.authSecret || '',
    adminPassword: env.ADMIN_PASSWORD || file.adminPassword || '',
  };
}

/**
 * Whether a first-run install is complete.
 *
 * Mirrors the `needsSetup` definition in getConfig(): a gallery.yaml exists AND
 * Immich credentials resolve. The wizard writes all three at once, so this flips
 * to true the moment the install finishes — no restart required.
 */
export function isInstalled(): boolean {
  const creds = getInstallCredentials();
  if (!creds.apiUrl || !creds.apiKey) return false;
  return fs.existsSync(path.join(installContentDir(), 'gallery.yaml'));
}

/** Whether a request pathname belongs to the install wizard. */
export function isInstallPath(pathname: string | null): boolean {
  return pathname === '/install' || pathname?.startsWith('/install/') === true;
}

/**
 * Normalize a user-supplied Immich base URL into the API base the client calls.
 *
 * The app stores the base URL (no /api) — see lib/env.ts — and appends /api at
 * call time. Users sometimes paste a URL that already ends in /api, so accept
 * both rather than double-appending. Returns null when the input is not a
 * valid http(s) URL.
 */
export function normalizeApiBase(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const base = url.toString().replace(/\/+$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
}

/** What the wizard collects on its final step. */
export interface InstallInput {
  apiUrl: string;
  apiKey: string;
  siteTitle?: string;
  siteSubtitle?: string;
  theme?: string;
  albums?: string[];
  adminPassword?: string;
}

/** Write a file atomically: unique temp file, then rename. */
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.promises.writeFile(tmpPath, content, 'utf8');
    await fs.promises.rename(tmpPath, filePath);
  } catch (err) {
    await fs.promises.unlink(tmpPath).catch(() => {});
    throw err;
  }
}

/**
 * Persist everything the install wizard collected.
 *
 * Writes gallery.yaml (albums optional — an empty gallery is a valid portfolio
 * the owner can fill in later via /admin), settings.yaml, and install.json.
 * Runs before caches are invalidated, so the caller owns that step.
 */
export async function completeInstall(input: InstallInput): Promise<void> {
  const dir = installContentDir();
  await fs.promises.mkdir(dir, { recursive: true });

  const gallery: GalleryYaml = {
    hero: [],
    albums: (input.albums ?? []).filter((id) => typeof id === 'string'),
  };

  const settings: SettingsYaml = {
    title: input.siteTitle?.trim() || 'Gallery',
    subtitle: input.siteSubtitle?.trim() || '',
    theme: { preset: input.theme || 'studio' },
  };

  const data: InstallFileData = {
    apiUrl: input.apiUrl.trim(),
    apiKey: input.apiKey.trim(),
    authSecret: crypto.randomBytes(32).toString('hex'),
    ...(input.adminPassword ? { adminPassword: input.adminPassword } : {}),
  };

  const header = (name: string) =>
    `# ── ${name} (created by the Immich Folio install wizard) ──────────\n`;
  const dumpOptions = { lineWidth: 120, quotingType: '"' as const, noRefs: true, sortKeys: false };

  const galleryPath = path.join(dir, 'gallery.yaml');
  const settingsPath = path.join(dir, 'settings.yaml');

  await atomicWrite(
    galleryPath,
    header('Gallery Structure') + yaml.dump(gallery, dumpOptions),
  );

  // Only create settings.yaml if it does not already exist — a deployment that
  // brings its own customised settings.yaml (but is missing gallery.yaml) must
  // not have it silently replaced with the three-key skeleton the wizard writes.
  if (!fs.existsSync(settingsPath)) {
    await atomicWrite(
      settingsPath,
      header('Site Settings') + yaml.dump(settings, dumpOptions),
    );
  }
  await atomicWrite(path.join(dir, INSTALL_FILENAME), `${JSON.stringify(data, null, 2)}\n`);
  try {
    await fs.promises.chmod(path.join(dir, INSTALL_FILENAME), 0o600);
  } catch {
    // chmod is a no-op on Windows; on Linux it prevents world-readable secrets.
  }

  // The token exists to gate a setup that has not happened yet. Leaving it on
  // disk would keep a valid credential lying around for a door that is now
  // closed anyway (isInstalled() makes every install route answer 403).
  try {
    fs.unlinkSync(path.join(dir, SETUP_TOKEN_FILENAME));
  } catch {
    // Never created, or already removed.
  }

  // Drop the in-process cache so the next isInstalled()/getInstallCredentials()
  // call reads the freshly written file.
  cachedInstallFile = null;
}
