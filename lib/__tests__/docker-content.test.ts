import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * A Docker build from a checkout used to bake the checkout's content/ into the
 * image: `COPY . .` took it into the build stage, the standalone trace copied
 * it along, and the runner copied the whole directory. At runtime the mounted
 * volume hides it, but the layers still hold gallery.yaml, install.json (the
 * Immich API key), contact messages, proofing links and every backup — and
 * `docker save` or a push hands them out.
 *
 * Three places keep it out now: .dockerignore, the builder dropping the traced
 * copy, and the runner copying the templates by name. These tests pin all
 * three; the matcher below follows Docker's .dockerignore rules (last match
 * wins, `!` re-includes, a pattern that matches a directory covers everything
 * below it).
 */

const ROOT = path.join(__dirname, '..', '..');
const dockerignore = fs.readFileSync(path.join(ROOT, '.dockerignore'), 'utf8');
const dockerfile = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8');

type Rule = { negate: boolean; re: RegExp };

function toRegExp(pattern: string): RegExp {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      out += '.*';
      i++;
      if (pattern[i + 1] === '/') i++;
    } else if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}

const rules: Rule[] = dockerignore
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const negate = line.startsWith('!');
    const pattern = path.posix.normalize((negate ? line.slice(1) : line).replace(/^\/+/, ''));
    return { negate, re: toRegExp(pattern.replace(/\/$/, '')) };
  });

/** Whether Docker leaves `file` out of the build context. */
function ignored(file: string): boolean {
  const parts = file.split('/');
  const candidates = parts.map((_, i) => parts.slice(0, i + 1).join('/'));
  let result = false;
  for (const rule of rules) {
    if (candidates.some((candidate) => rule.re.test(candidate))) result = !rule.negate;
  }
  return result;
}

/** The part of the Dockerfile after `FROM … AS <stage>`, up to the next FROM. */
function stage(name: string): string {
  const match = dockerfile.match(
    new RegExp(`^FROM .* AS ${name}\\n([\\s\\S]*?)(?=^FROM |(?![\\s\\S]))`, 'm'),
  );
  return match?.[1] ?? '';
}

describe('content/ stays out of the Docker image', () => {
  it.each([
    'content/gallery.yaml',
    'content/settings.yaml',
    'content/about.md',
    'content/privacy.md',
    'content/install.json',
    'content/.setup-token',
    'content/proofing.json',
    'content/analytics.json',
    'content/favicon.svg',
    'content/messages/1727640000000-abc.json',
    'content/pages/prices.md',
    'content/journal/iceland.md',
    'content/essays/old.md',
    'content/.backups/gallery.yaml.2026-09-29T10-00-00.bak',
    'content/journal/.backups/iceland.md.bak',
    'content/.fonts/inter.woff2',
    'content/gallery.yaml.screenshot-bak',
  ])('leaves %s out of the build context', (file) => {
    expect(ignored(file)).toBe(true);
  });

  it('keeps every tracked template in the build context', () => {
    const templates = [
      ...fs.readdirSync(path.join(ROOT, 'content')).map((f) => `content/${f}`),
      ...fs.readdirSync(path.join(ROOT, 'content', 'journal')).map((f) => `content/journal/${f}`),
    ].filter((f) => f.endsWith('.example'));
    expect(templates).toContain('content/gallery.yaml.example');
    expect(templates.filter(ignored)).toEqual([]);
  });

  it('still sends the source the build needs', () => {
    expect(ignored('app/layout.tsx')).toBe(false);
    expect(ignored('lib/config/index.ts')).toBe(false);
    expect(ignored('package.json')).toBe(false);
  });

  it('drops the traced copy of content/ from the standalone output', () => {
    expect(stage('builder')).toMatch(/^RUN rm -rf \.next\/standalone\/content$/m);
  });

  it('copies only the templates into the runtime content/', () => {
    const runner = stage('runner');
    expect(runner).not.toBe('');
    const contentCopies = runner.split('\n').filter((line) => /^COPY .*content/.test(line));
    expect(contentCopies.length).toBeGreaterThan(0);
    for (const line of contentCopies) {
      expect(line).toMatch(/\/app\/content\/(journal\/)?\*\.example /);
    }
  });
});
