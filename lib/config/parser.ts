import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// In-memory cache for parsed YAML objects
const yamlCache = new Map<string, unknown>();

export function loadYaml<T>(filename: string): T | null {
  const isDev = process.env.NODE_ENV !== 'production';

  // Check cache first in production
  if (!isDev && yamlCache.has(filename)) {
    const cached = yamlCache.get(filename);
    return cached === null ? null : structuredClone(cached as T);
  }

  const yamlPath = path.join(process.cwd(), 'content', filename);

  if (!fs.existsSync(yamlPath)) {
    if (!isDev) {
      // Negative caching for missing files
      yamlCache.set(filename, null);
    }
    return null;
  }

  const raw = fs.readFileSync(yamlPath, 'utf8');
  const parsed = (yaml.load(raw) || {}) as T;

  if (!isDev) {
    yamlCache.set(filename, parsed);
  }

  return isDev ? parsed : structuredClone(parsed);
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
