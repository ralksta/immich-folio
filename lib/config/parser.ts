import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export function loadYaml<T>(filename: string): T | null {
  const yamlPath = path.join(process.cwd(), 'content', filename);

  if (!fs.existsSync(yamlPath)) {
    return null;
  }

  const raw = fs.readFileSync(yamlPath, 'utf8');
  return (yaml.load(raw) || {}) as T;
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
