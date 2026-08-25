/**
 * Config doctor for the terminal — `npm run doctor` (#521).
 *
 * The panel version of this (`/admin` → status badge → Diagnostics) needs a
 * running app and a working admin password. This one answers when neither is
 * true, which is the situation people actually write support threads about.
 *
 * ── Why this file is a `.mts` run by plain `node` ────────────────────────
 *
 * The project has no TypeScript runner among its dependencies, and the issue
 * offered two ways out: add `tsx` as a dev dependency, or compile a `.mjs`
 * entry point during the build. Both fail the case this CLI exists for.
 *
 * The shipped image (`node:22-alpine`, `output: 'standalone'`) carries only
 * production dependencies — `tsx` is not among them, and `npx tsx` in a
 * container whose app is already broken means a network round trip to the
 * registry before the diagnosis can start. A compiled `.mjs` would work, but
 * only by adding a build step whose output has to be kept in the image and in
 * sync with the source.
 *
 * Node 22.18 unflagged native type stripping, so `node scripts/doctor.mts`
 * runs the TypeScript directly with no runner at all. It has one constraint:
 * no path aliases, and every relative import needs its file extension. That
 * rules out importing `lib/config` — but `lib/admin/doctor.ts` has no imports
 * whatsoever (it is pure functions over gathered inputs, written that way in
 * #491 precisely so a CLI could reuse it), so the entire TypeScript module
 * graph of this script is two files. Nothing is duplicated that judges: the
 * checks all come from `lib/admin/doctor.ts`.
 *
 * What *is* repeated here is the gathering — reading the filesystem and the
 * environment instead of a request, exactly as the issue described. It is
 * deliberately tolerant rather than a second `getConfig()`: it walks the parsed
 * YAML for anything that looks like an album ID or a password rather than
 * knowing the schema, so a config shape it has never seen still gets checked,
 * and a config `getConfig()` would throw on still gets a report.
 *
 * ── Exit codes ───────────────────────────────────────────────────────────
 *
 *   0  every check passed
 *   1  at least one warning, no errors
 *   2  at least one error
 *   3  the doctor itself could not run
 *
 * Nothing here ever prints a secret: `lib/admin/doctor.ts` reports only whether
 * something is set and where to look, and the gathering below never puts a
 * password, an API key or `AUTH_SECRET` into a finding.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkAlbumIds,
  checkAlbumsShared,
  checkAuthSecret,
  checkImmichCalls,
  checkPasswords,
  checkWritable,
  worstLevel,
  type AlbumRef,
  type DoctorFinding,
  type DoctorLevel,
  type PasswordRef,
} from '../lib/admin/doctor.ts';

/**
 * `process.env`, minus the `NODE_ENV`-is-required augmentation Next adds to
 * `NodeJS.ProcessEnv` — which would force every test to hand over a NODE_ENV
 * it does not care about.
 */
export type EnvLike = Record<string, string | undefined>;

// ── Exit codes ────────────────────────────────────────────────────────────

/** Worst finding level → process exit code. */
export const EXIT_CODES: Record<DoctorLevel, number> = { ok: 0, warn: 1, error: 2 };

/** The doctor itself failed — distinct from any finding it could have made. */
export const EXIT_INTERNAL = 3;

export function exitCodeFor(level: DoctorLevel): number {
  return EXIT_CODES[level] ?? EXIT_INTERNAL;
}

// ── Environment ───────────────────────────────────────────────────────────

/**
 * `.env.local` then `.env`, without overwriting anything already set.
 *
 * Next loads these for `npm run dev`; a bare `node` process does not, and a
 * checkout that keeps its credentials there would otherwise be told it has no
 * Immich configured. Real environment variables still win, which matches both
 * Next's precedence and `getInstallCredentials()`.
 */
export function loadDotEnv(cwd: string, env: EnvLike = process.env): void {
  for (const file of ['.env.local', '.env']) {
    let raw: string;
    try {
      raw = fs.readFileSync(path.join(cwd, file), 'utf8');
    } catch {
      continue;
    }
    for (const line of raw.split('\n')) {
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, rest] = match;
      if (key in env) continue;
      let value = rest.trim();
      if (
        (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
        (value.startsWith("'") && value.endsWith("'") && value.length > 1)
      ) {
        value = value.slice(1, -1);
      } else {
        value = value.replace(/\s+#.*$/, '').trim();
      }
      env[key] = value;
    }
  }
}

export interface Credentials {
  apiUrl: string;
  apiKey: string;
  authSecret: string;
}

/**
 * Mirrors `getInstallCredentials()`: environment first, `content/install.json`
 * underneath. A malformed or unreadable install file is treated as absent —
 * the checks below then report what is missing.
 */
export function resolveCredentials(contentDir: string, env: EnvLike): Credentials {
  let file: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(
      fs.readFileSync(path.join(contentDir, 'install.json'), 'utf8'),
    );
    if (parsed && typeof parsed === 'object') file = parsed as Record<string, unknown>;
  } catch {
    // No install.json, or one that cannot be parsed. Env may still carry everything.
  }

  const str = (value: unknown) => (typeof value === 'string' ? value : '');

  // env.ts normalises IMMICH_API_URL through `new URL()` and strips trailing
  // slashes; an invalid value there becomes empty rather than throwing.
  let apiUrl = env.IMMICH_API_URL || str(file.apiUrl);
  if (apiUrl) {
    try {
      apiUrl = new URL(apiUrl).toString().replace(/\/+$/, '');
    } catch {
      apiUrl = '';
    }
  }

  return {
    apiUrl,
    apiKey: env.IMMICH_API_KEY || str(file.apiKey),
    authSecret: env.AUTH_SECRET || str(file.authSecret),
  };
}

// ── Gathering from the YAML ───────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type YamlNode = unknown;

function isRecord(node: YamlNode): node is Record<string, unknown> {
  return !!node && typeof node === 'object' && !Array.isArray(node);
}

/**
 * Every album ID reachable in the tree, deduplicated and in document order.
 *
 * Anything under an `albums:` list counts, whatever nests it — standalone
 * albums, subpages in either the list or the map form, sections. An entry is
 * either the ID itself or a single-key object whose key is the ID (the form
 * that carries a title, a password or a sort mode). Only well-formed UUIDs are
 * kept, matching `validateUuid()`, which drops the rest rather than passing a
 * typo on to Immich.
 */
export function collectAlbumIds(node: YamlNode): string[] {
  const found: string[] = [];

  const takeEntry = (entry: unknown) => {
    if (typeof entry === 'string') {
      if (UUID_REGEX.test(entry.trim())) found.push(entry.trim());
      return;
    }
    if (isRecord(entry)) {
      const key = Object.keys(entry)[0];
      if (key && UUID_REGEX.test(key.trim())) found.push(key.trim());
      // The value may itself hold nested config, but never further album IDs.
      walk(entry);
    }
  };

  const walk = (current: YamlNode) => {
    if (Array.isArray(current)) {
      current.forEach(walk);
      return;
    }
    if (!isRecord(current)) return;
    for (const [key, value] of Object.entries(current)) {
      if (key === 'albums' && Array.isArray(value)) {
        value.forEach(takeEntry);
        continue;
      }
      // assetOrder and hero hold asset IDs, not albums — skipped by name.
      if (key === 'assetOrder' || key === 'hero') continue;
      walk(value);
    }
  };

  walk(node);
  return [...new Set(found)];
}

/**
 * Every `password:` in the tree, labelled by where it sits.
 *
 * The label is a YAML path rather than a slug: it is what the reader has to
 * open the file and find the value, and unlike a slug it cannot go stale when
 * the schema grows a new place to put a password. The value travels only as far
 * as `checkPasswords()`, which reports the storage format and never the secret.
 */
export function collectPasswords(node: YamlNode, source: string): PasswordRef[] {
  const found: PasswordRef[] = [];

  const walk = (current: YamlNode, trail: string) => {
    if (Array.isArray(current)) {
      current.forEach((item, i) => walk(item, `${trail}[${i}]`));
      return;
    }
    if (!isRecord(current)) return;
    for (const [key, value] of Object.entries(current)) {
      const here = trail ? `${trail}.${key}` : key;
      if ((key === 'password' || key === 'sitePassword') && typeof value === 'string' && value) {
        // Name the subpage or album rather than the index where one is at hand.
        const name = typeof current.name === 'string' ? ` (${current.name})` : '';
        found.push({ label: `${source} ${here}${name}`, value });
        continue;
      }
      walk(value, here);
    }
  };

  walk(node, '');
  return found;
}

/** The `password:` of a journal entry's frontmatter, if it has one. */
export function frontmatterPassword(markdown: string): string | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!match) return null;
  for (const line of match[1].split('\n')) {
    const found = /^\s*password\s*:\s*(.+?)\s*$/.exec(line);
    if (!found) continue;
    const value = found[1].replace(/^["']|["']$/g, '');
    return value || null;
  }
  return null;
}

/** Content paths that exist but refuse writes. Absent is fine — see the route. */
export function findUnwritable(contentDir: string): string[] {
  const unwritable: string[] = [];
  for (const dir of ['', '.backups', 'journal']) {
    const target = path.join(contentDir, dir);
    try {
      fs.accessSync(target, fs.constants.W_OK);
    } catch {
      try {
        fs.statSync(target);
        unwritable.push(`content/${dir}`.replace(/\/$/, ''));
      } catch {
        // Not created yet: the app makes it on first write.
      }
    }
  }
  return unwritable;
}

// ── Report formatting ─────────────────────────────────────────────────────

const LEVEL_ORDER: DoctorLevel[] = ['error', 'warn', 'ok'];

const LEVEL_LABEL: Record<DoctorLevel, string> = {
  error: 'ERRORS',
  warn: 'WARNINGS',
  ok: 'PASSED',
};

/**
 * Findings the CLI reports without having checked anything.
 *
 * They carry level `ok` so they cannot skew `worstLevel()` or the exit code,
 * but listing them under PASSED would claim a check that never ran. They get
 * their own group instead. Membership is by `id` rather than by a field on
 * `DoctorFinding`, because the type is shared with the panel — where these
 * findings are real checks — and this is a fact about the terminal, not about
 * the finding.
 */
const NOTE_IDS = new Set(['proxy-hops']);

const NOTE_LABEL = 'NOTES';
const NOTE_MARK = 'i';
const NOTE_COLOR = '\x1b[36m';

const LEVEL_MARK: Record<DoctorLevel, string> = { error: 'x', warn: '!', ok: 'v' };

/** Hand-written, so the CLI needs no colour dependency. */
const LEVEL_COLOR: Record<DoctorLevel, string> = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  ok: '\x1b[32m',
};
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

/** Soft-wraps at a word boundary; a single long token is left intact. */
export function wrap(text: string, width: number, indent: string): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + ' ' + word).length > width) {
      lines.push(indent + line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(indent + line);
  return lines;
}

export interface FormatOptions {
  color?: boolean;
  width?: number;
}

/** The whole report as one string, so it can be asserted on in a test. */
export function formatReport(findings: DoctorFinding[], options: FormatOptions = {}): string {
  const color = options.color ?? false;
  const width = Math.max(40, Math.min(options.width ?? 80, 120));
  const paint = (code: string, text: string) => (color ? `${code}${text}${RESET}` : text);

  const out: string[] = ['', paint(BOLD, 'Immich Folio — config doctor'), ''];

  const notes = findings.filter((f) => NOTE_IDS.has(f.id));
  const checks = findings.filter((f) => !NOTE_IDS.has(f.id));

  const group = (label: string, color: string, mark: string, group: DoctorFinding[]) => {
    if (!group.length) return;
    out.push(paint(color + BOLD, `${label} (${group.length})`));
    for (const finding of group) {
      out.push(`  ${paint(color, mark)} ${finding.title}`);
      for (const line of wrap(finding.detail, width - 6, '    ')) {
        out.push(paint(DIM, line));
      }
      out.push('');
    }
  };

  for (const level of LEVEL_ORDER) {
    // Notes sit between the warnings and the passes: they are not a problem,
    // but they are the part of the report a reader still has to act on.
    if (level === 'ok') group(NOTE_LABEL, NOTE_COLOR, NOTE_MARK, notes);
    group(
      LEVEL_LABEL[level],
      LEVEL_COLOR[level],
      LEVEL_MARK[level],
      checks.filter((f) => f.level === level),
    );
  }

  const counts = LEVEL_ORDER.map((level) => checks.filter((f) => f.level === level).length);
  const [errors, warns, oks] = counts;
  out.push(
    paint(
      BOLD,
      `${errors} error${errors === 1 ? '' : 's'}, ` +
        `${warns} warning${warns === 1 ? '' : 's'}, ` +
        `${oks} check${oks === 1 ? '' : 's'} passed` +
        (notes.length ? `, ${notes.length} note${notes.length === 1 ? '' : 's'}` : '') +
        `.`,
    ),
  );
  out.push('');

  return out.join('\n');
}

/** Colour unless the output is piped, or NO_COLOR / FORCE_COLOR says otherwise. */
export function shouldUseColor(
  env: EnvLike = process.env,
  isTty: boolean = process.stdout.isTTY === true,
): boolean {
  if (env.NO_COLOR) return false;
  if (env.FORCE_COLOR && env.FORCE_COLOR !== '0') return true;
  return isTty;
}

// ── The run ───────────────────────────────────────────────────────────────

/**
 * `TRUSTED_PROXY_HOPS` cannot be checked from a terminal.
 *
 * `checkProxyHops()` compares the configured value against the
 * `X-Forwarded-For` chain of a live request, and there is none here. Rather
 * than guess — a wrong guess in either direction points at a rate-limiting bug
 * that is not there — the CLI reports the configured value and says where the
 * real check lives.
 */
function reportProxyHops(env: EnvLike): DoctorFinding {
  const raw = env.TRUSTED_PROXY_HOPS;
  const hops = raw && !isNaN(parseInt(raw, 10)) ? Math.max(0, parseInt(raw, 10)) : 0;
  return {
    id: 'proxy-hops',
    level: 'ok',
    title: `TRUSTED_PROXY_HOPS is ${hops}${raw ? '' : ' (unset)'} — not verifiable from the terminal`,
    detail:
      'Whether this is right can only be judged against a real request: the value says how far ' +
      'from the right of X-Forwarded-For the client IP sits, and no request reaches a CLI. Open ' +
      'the Diagnostics panel in /admin over your public URL to have it measured. One reverse ' +
      'proxy (nginx, Traefik or Caddy) alone is 1; no proxy at all is 0.',
  };
}

async function gatherFindings(cwd: string, env: EnvLike): Promise<DoctorFinding[]> {
  const contentDir = env.INSTALL_CONTENT_DIR || path.join(cwd, 'content');
  const findings: DoctorFinding[] = [];
  const credentials = resolveCredentials(contentDir, env);

  findings.push(checkAuthSecret(credentials.authSecret || undefined));
  findings.push(reportProxyHops(env));

  // ── The YAML, read tolerantly ───────────────────────────────────────
  let yamlLoad: ((input: string) => unknown) | null = null;
  try {
    yamlLoad = (await import('js-yaml')).load as (input: string) => unknown;
  } catch {
    // Reported once below, against whichever file needed it.
  }

  const readYaml = (filename: string): { node: YamlNode; error: string | null } => {
    let raw: string;
    try {
      raw = fs.readFileSync(path.join(contentDir, filename), 'utf8');
    } catch {
      return { node: null, error: null }; // Absent, which each caller judges itself.
    }
    if (!yamlLoad) return { node: null, error: 'js-yaml is not installed' };
    try {
      return { node: yamlLoad(raw) ?? {}, error: null };
    } catch (error) {
      // js-yaml appends a snippet of the offending lines; the first line
      // already names the fault and the position, and the rest turns into
      // noise once it is wrapped.
      const message = error instanceof Error ? error.message : String(error);
      return { node: null, error: message.split('\n')[0] };
    }
  };

  const gallery = readYaml('gallery.yaml');
  const settings = readYaml('settings.yaml');

  const galleryExists = fs.existsSync(path.join(contentDir, 'gallery.yaml'));
  if (!galleryExists) {
    findings.push({
      id: 'gallery-yaml',
      level: 'error',
      title: 'content/gallery.yaml does not exist',
      detail:
        `Nothing is published yet. Run the setup wizard at /install, or copy ` +
        `content/gallery.yaml.example to content/gallery.yaml and put your album IDs in it.`,
    });
  } else if (gallery.error) {
    findings.push({
      id: 'gallery-yaml',
      level: 'error',
      title: 'content/gallery.yaml could not be parsed',
      detail: `The site falls back to the setup screen until this is fixed. ${gallery.error}. A working copy may be waiting in content/.backups/.`,
    });
  } else {
    findings.push({
      id: 'gallery-yaml',
      level: 'ok',
      title: 'content/gallery.yaml parses',
      detail: 'The gallery structure could be read.',
    });
  }

  if (settings.error) {
    findings.push({
      id: 'settings-yaml',
      level: 'error',
      title: 'content/settings.yaml could not be parsed',
      detail: `Site title, theme and grid defaults fall back to their built-in values. ${settings.error}`,
    });
  }

  const configuredAlbums = collectAlbumIds(gallery.node);

  // ── Immich: the three calls Folio depends on ────────────────────────
  const calls: Array<{ endpoint: string; ok: boolean }> = [];
  let albums: AlbumRef[] = [];

  if (!credentials.apiUrl || !credentials.apiKey) {
    findings.push({
      id: 'immich-api',
      level: 'error',
      title: 'No Immich URL or API key configured',
      detail:
        'Set IMMICH_API_URL and IMMICH_API_KEY, or run the setup wizard at /install. ' +
        (credentials.apiUrl ? 'The API key is missing.' : 'The URL is missing or not a valid URL.'),
    });
  } else {
    // getConfig() appends /api unless it is already there.
    const base = credentials.apiUrl.endsWith('/api')
      ? credentials.apiUrl
      : `${credentials.apiUrl}/api`;
    const timeout = Math.max(1000, parseInt(env.IMMICH_TIMEOUT_MS || '', 10) || 15000);
    const headers = { 'x-api-key': credentials.apiKey, Accept: 'application/json' };

    const call = async (endpoint: string, init?: RequestInit) => {
      try {
        const res = await fetch(`${base}${endpoint}`, {
          headers,
          signal: AbortSignal.timeout(timeout),
          ...init,
        });
        calls.push({ endpoint, ok: res.ok });
        return res.ok ? res : null;
      } catch {
        calls.push({ endpoint, ok: false });
        return null;
      }
    };

    await call('/server/ping');
    const albumRes = await call('/albums');
    await call('/search/metadata', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ size: 1, page: 1 }),
    });

    if (albumRes) {
      try {
        const parsed: unknown = await albumRes.json();
        if (Array.isArray(parsed)) albums = parsed as AlbumRef[];
      } catch {
        // A malformed body is already reflected by the call above.
      }
    }

    findings.push(checkImmichCalls(calls));
  }

  if (albums.length) {
    findings.push(checkAlbumIds(configuredAlbums, albums));
    findings.push(checkAlbumsShared(configuredAlbums, albums));
  } else if (galleryExists && !gallery.error && !configuredAlbums.length) {
    findings.push({
      id: 'album-ids',
      level: 'warn',
      title: 'No albums configured',
      detail: 'gallery.yaml lists no album IDs, so the gallery has nothing to show.',
    });
  }

  // ── Passwords, from every file one can live in ──────────────────────
  const passwords: PasswordRef[] = [
    ...(env.SITE_PASSWORD ? [{ label: 'SITE_PASSWORD', value: env.SITE_PASSWORD }] : []),
    ...collectPasswords(settings.node, 'settings.yaml'),
    ...collectPasswords(gallery.node, 'gallery.yaml'),
  ];

  for (const dir of ['journal', 'essays']) {
    let entries: string[];
    try {
      entries = fs.readdirSync(path.join(contentDir, dir));
    } catch {
      continue; // Optional directories.
    }
    for (const name of entries.filter((n) => n.endsWith('.md'))) {
      try {
        const password = frontmatterPassword(
          fs.readFileSync(path.join(contentDir, dir, name), 'utf8'),
        );
        if (password) passwords.push({ label: `${dir}/${name}`, value: password });
      } catch {
        // An unreadable entry is covered by the writability check below.
      }
    }
  }

  findings.push(checkPasswords(passwords));

  // ── Writability of the content volume ───────────────────────────────
  if (!fs.existsSync(contentDir)) {
    findings.push({
      id: 'content-writable',
      level: 'error',
      title: 'content/ does not exist',
      detail:
        `Nothing can be saved and nothing can be published. Expected it at ${contentDir} — ` +
        'run the doctor from the project root, or check that the volume is mounted.',
    });
  } else {
    findings.push(checkWritable(findUnwritable(contentDir)));
  }

  return findings;
}

export async function main(
  cwd: string = process.cwd(),
  env: EnvLike = process.env,
): Promise<number> {
  loadDotEnv(cwd, env);

  let findings: DoctorFinding[];
  try {
    findings = await gatherFindings(cwd, env);
  } catch (error) {
    // A raw stack trace is never the right answer here: the person running this
    // is already looking at something broken.
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `\nThe config doctor could not finish: ${message}\n` +
        `Run it from the project root, and please report this at ` +
        `https://github.com/ralksta/immich-folio/issues\n\n`,
    );
    return EXIT_INTERNAL;
  }

  process.stdout.write(
    formatReport(findings, {
      color: shouldUseColor(env),
      width: process.stdout.columns || 80,
    }),
  );

  return exitCodeFor(worstLevel(findings));
}

// Only when run directly. `npm run doctor` goes through scripts/doctor.mjs,
// which checks the Node version first; the tests import the helpers above.
const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invoked && invoked === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
