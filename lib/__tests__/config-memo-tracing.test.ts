import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * configInputs() stats a list of paths it builds at runtime. Turbopack cannot
 * resolve a path that arrives through a variable, so it traces the whole
 * project into `.next/standalone` — app/, docs/, e2e/, the real content files —
 * and the Docker image copies all of it (#753 did this, ~70 MB). The ignore
 * comment is the documented opt-out; the stat only reads an mtime, and the
 * files themselves are loaded (and traced) by loadYaml() and readInstallFile().
 *
 * The build prints a warning when this regresses, but nothing fails, so the
 * check lives here.
 */

const source = fs.readFileSync(path.join(__dirname, '..', 'config', 'index.ts'), 'utf8');

/** The body of configInputs(), up to the next top-level declaration. */
const body = source.match(/function configInputs\(\)[\s\S]*?\n}\n/)?.[0] ?? '';

describe('config memo key and output file tracing', () => {
  it('finds configInputs()', () => {
    expect(body).toContain('statSync');
  });

  it('marks every filesystem call in configInputs() as ignored by Turbopack', () => {
    const calls = body.match(/fs\.\w+\([^)]*/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    const unmarked = calls.filter(
      (call) => !/^fs\.\w+\(\s*\/\*\s*turbopackIgnore: true\s*\*\//.test(call),
    );
    expect(unmarked).toEqual([]);
  });
});
