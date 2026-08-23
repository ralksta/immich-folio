import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

interface YamlCacheEntry {
  data: unknown;
  mtimeMs: number;
}

// mtime-based cache: re-reads the file if it has been modified since last parse.
// Works correctly across admin saves without requiring a Docker restart.
const yamlCache = new Map<string, YamlCacheEntry>();

export function clearYamlCache(): void {
  yamlCache.clear();
}

export function loadYaml<T>(filename: string): T | null {
  const yamlPath = path.join(process.cwd(), 'content', filename);

  let mtimeMs = 0;
  try {
    mtimeMs = fs.statSync(yamlPath).mtimeMs;
  } catch {
    // File does not exist
    yamlCache.delete(filename);
    return null;
  }

  const cached = yamlCache.get(filename);
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached.data === null ? null : structuredClone(cached.data as T);
  }

  const raw = fs.readFileSync(yamlPath, 'utf8');
  const parsed = (yaml.load(raw) || {}) as T;

  yamlCache.set(filename, { data: parsed, mtimeMs });
  return structuredClone(parsed);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * An ID from the config, or `null` when it is not a UUID at all.
 *
 * It used to substitute the all-zeros UUID and log "(Ignored for build/setup)",
 * which was untrue twice over: nothing ignored it, and it was not a build-time
 * concern. The sentinel travelled on as a real asset ID — encoded into a token,
 * requested through /api/image, forwarded to Immich, answered with 400 — so a
 * placeholder left in the example file turned the home page into "Something
 * went wrong" (#517).
 *
 * Returning null lets each caller drop the entry instead, which is what
 * "ignored" was supposed to mean: one fewer hero image, one album not
 * published, rather than a request that cannot succeed.
 */
export function validateUuid(id: string, context: string): string | null {
  const trimmed = id.trim();
  if (!UUID_REGEX.test(trimmed)) {
    console.warn(`Invalid UUID in ${context}: "${trimmed}" — entry dropped.`);
    return null;
  }
  return trimmed;
}
