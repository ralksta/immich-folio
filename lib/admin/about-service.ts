/**
 * Server-side About page file service.
 * Reads and atomically writes content/about.md (frontmatter + markdown body)
 * with rolling backups, mirroring the journal and YAML services.
 */

import fs from 'fs/promises';
import nodeFs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const ABOUT_FILENAME = 'about.md';
const MAX_BACKUPS = 10;
let tmpCounter = 0;

export interface AboutContent {
  portrait?: string;
  name?: string;
  location?: string;
  gear?: string[];
  body: string;
  /** When false, /about returns 404 and the nav link is hidden. Defaults to true. */
  enabled: boolean;
}

/** Join a filename onto the content directory, rejecting anything that escapes it. */
function containedPath(dir: string, filename: string): string | null {
  const base = path.resolve(dir);
  const resolved = path.resolve(base, filename);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  return resolved;
}

/**
 * mtime-checked cache for about.md. Mirrors lib/config/parser.ts: each read is
 * a cheap statSync; the file is only re-read and re-parsed when its mtime has
 * changed. Works across admin saves (and across worker processes) without a
 * restart, exactly like the YAML cache.
 */
interface AboutCacheEntry {
  data: AboutContent;
  mtimeMs: number;
}

let aboutCache: AboutCacheEntry | null = null;

/** Drop the cached parse so the next read re-reads about.md from disk. */
export function invalidateAboutCache(): void {
  aboutCache = null;
}

/**
 * Parse about.md into its frontmatter and body. Mirrors the parser in
 * app/about/page.tsx so the admin editor and the public page always agree.
 */
export function parseAboutMarkdown(raw: string): AboutContent {
  let meta: Record<string, unknown> = {};
  let body = raw;

  const match = raw.match(/^(?:---\r?\n)([\s\S]*?)(?:\r?\n---\r?\n)([\s\S]*)$/);
  if (match) {
    try {
      meta = (yaml.load(match[1]) || {}) as Record<string, unknown>;
    } catch (err) {
      console.error('[About] Failed to parse about.md frontmatter', err);
    }
    body = match[2];
  }

  return {
    portrait: typeof meta.portrait === 'string' ? meta.portrait : undefined,
    name: typeof meta.name === 'string' ? meta.name : undefined,
    location: typeof meta.location === 'string' ? meta.location : undefined,
    gear: Array.isArray(meta.gear)
      ? meta.gear.filter((item): item is string => typeof item === 'string')
      : undefined,
    body: body.trim(),
    enabled: meta.enabled === false ? false : true,
  };
}

/** Serialize an AboutContent object back to the about.md format. */
export function serializeAboutMarkdown(about: AboutContent): string {
  const frontmatter: Record<string, unknown> = {};
  if (about.portrait) frontmatter.portrait = about.portrait;
  if (about.name) frontmatter.name = about.name;
  if (about.location) frontmatter.location = about.location;
  if (about.gear && about.gear.length > 0) frontmatter.gear = about.gear;
  if (about.enabled === false) frontmatter.enabled = false;

  const yamlBody = yaml.dump(frontmatter, {
    lineWidth: 120,
    quotingType: '"',
    noRefs: true,
    sortKeys: false,
  });

  const body = (about.body ?? '').trim();
  return `---\n${yamlBody}---\n\n${body}${body ? '\n' : ''}`;
}

/** Read content/about.md, returning an empty default when the file is absent. */
export async function readAboutFile(): Promise<AboutContent> {
  const filePath = containedPath(CONTENT_DIR, ABOUT_FILENAME);
  if (!filePath) return { body: '', enabled: true };

  let mtimeMs = 0;
  try {
    mtimeMs = nodeFs.statSync(filePath).mtimeMs;
  } catch {
    // File does not exist.
    aboutCache = null;
    return { body: '', enabled: true };
  }

  if (aboutCache && aboutCache.mtimeMs === mtimeMs) {
    return structuredClone(aboutCache.data);
  }

  const raw = nodeFs.readFileSync(filePath, 'utf8');
  const parsed = parseAboutMarkdown(raw);
  aboutCache = { data: parsed, mtimeMs };
  return structuredClone(parsed);
}

/** Atomically write content/about.md with backup rotation. */
export async function writeAboutFile(about: AboutContent): Promise<void> {
  const filePath = containedPath(CONTENT_DIR, ABOUT_FILENAME);
  if (!filePath) throw new Error('Invalid about.md path');

  await fs.mkdir(CONTENT_DIR, { recursive: true });

  // Rolling backup if the file already exists.
  try {
    await fs.access(filePath);
    const backupDir = path.join(CONTENT_DIR, '.backups');
    await fs.mkdir(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.copyFile(filePath, path.join(backupDir, `${ABOUT_FILENAME}.${timestamp}.bak`));

    const backups = (await fs.readdir(backupDir))
      .filter((f) => f.startsWith(`${ABOUT_FILENAME}.`) && f.endsWith('.bak'))
      .sort();
    if (backups.length > MAX_BACKUPS) {
      for (const old of backups.slice(0, backups.length - MAX_BACKUPS)) {
        await fs.unlink(path.join(backupDir, old)).catch(() => {});
      }
    }
  } catch {
    // New file, no backup needed.
  }

  const content = serializeAboutMarkdown(about);

  const tmpPath = `${filePath}.${process.pid}.${++tmpCounter}.tmp`;
  try {
    await fs.writeFile(tmpPath, content, 'utf8');
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }

  // mtime granularity can mask a same-tick write; force the next read to re-parse.
  invalidateAboutCache();

  console.log(`[About] ✅ Saved ${ABOUT_FILENAME}`);
}
