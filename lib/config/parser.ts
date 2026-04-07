import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// ⚡ Bolt Optimization: Cache parsed YAML to prevent repetitive synchronous
// file I/O and expensive parsing during production runtime.
const yamlCache = new Map<string, unknown>();

export function loadYaml<T>(filename: string): T | null {
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && yamlCache.has(filename)) {
    const cached = yamlCache.get(filename);
    // ⚡ Bolt Optimization: Use `structuredClone` to prevent caller mutations
    // from corrupting the cached object state, while preserving JS native types.
    return cached === null ? null : structuredClone(cached as T);
  }

  const yamlPath = path.join(process.cwd(), 'content', filename);

  if (!fs.existsSync(yamlPath)) {
    // ⚡ Bolt Optimization: Implement negative caching for missing files.
    if (isProd) {
      yamlCache.set(filename, null);
    }
    return null;
  }

  const raw = fs.readFileSync(yamlPath, 'utf8');
  const parsed = (yaml.load(raw) || {}) as T;

  if (isProd) {
    yamlCache.set(filename, parsed);
    return structuredClone(parsed);
  }

  return parsed;
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
