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

export function validateUuid(id: string, context: string): string {
  const trimmed = id.trim();
  if (!UUID_REGEX.test(trimmed)) {
    // If we are in setup mode or using dummy data, don't crash the build.
    // Return a valid dummy UUID so Next.js doesn't panic.
    console.warn(`Invalid UUID in ${context}: "${trimmed}" (Ignored for build/setup)`);
    return '00000000-0000-0000-0000-000000000000';
  }
  return trimmed;
}
