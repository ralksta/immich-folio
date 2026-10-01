import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * `npm run doctor` inside the shipped image runs the TypeScript sources with
 * Node's own type stripping (#521). That holds two constraints no other test
 * sees, because Vitest and the Next build resolve imports for themselves:
 *
 *  - every runtime relative import needs its file extension, or Node refuses
 *    to load it (ERR_MODULE_NOT_FOUND);
 *  - every file the script reaches has to be COPY'd into the runner stage of
 *    the Dockerfile — the standalone bundle carries none of them, so a new
 *    import in the doctor's graph is a module-not-found in production.
 *
 * Both are checked here by walking the import graph from the entry point, so
 * a module that joins the graph later (a theme.ts that starts importing a
 * neighbour, say) fails this test until the Dockerfile follows.
 */

const ROOT = path.resolve(__dirname, '../..');
const ENTRY = 'scripts/doctor.mjs';
const EXTENSIONS = ['.ts', '.mts', '.js', '.mjs'];

/** Block comments and whole-line `//` comments — prose mentioning `from './x'`
 *  must not count as an import. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Runtime import specifiers of one module. `import type` / `export type`
 *  are erased by type stripping and skipped; an `import { type X }` is not —
 *  Node still loads that module, so it counts. */
function runtimeImports(source: string): string[] {
  const code = stripComments(source);
  const specs: string[] = [];
  const staticRe = /(?:^|[\n;])\s*(import|export)\s+(type\s+)?[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g;
  for (const m of code.matchAll(staticRe)) {
    if (!m[2]) specs.push(m[3]);
  }
  for (const m of code.matchAll(/(?:^|[\n;])\s*import\s*['"]([^'"]+)['"]/g)) specs.push(m[1]);
  for (const m of code.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.push(m[1]);
  return specs;
}

interface Closure {
  files: string[];
  packages: string[];
  problems: string[];
}

function walkClosure(entry: string): Closure {
  const files = new Set<string>();
  const packages = new Set<string>();
  const problems: string[] = [];
  const queue = [entry];

  while (queue.length) {
    const rel = queue.shift() as string;
    if (files.has(rel)) continue;
    files.add(rel);
    const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');

    for (const spec of runtimeImports(source)) {
      if (spec.startsWith('node:')) continue;
      if (!spec.startsWith('.')) {
        packages.add(
          spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0],
        );
        continue;
      }
      let target = path.posix.join(path.posix.dirname(rel), spec);
      if (!EXTENSIONS.includes(path.posix.extname(target))) {
        problems.push(`${rel}: '${spec}' has no file extension`);
        // Keep walking so one report lists every gap.
        target = `${target}.ts`;
      }
      if (!fs.existsSync(path.join(ROOT, target))) {
        problems.push(`${rel}: '${spec}' resolves to ${target}, which does not exist`);
        continue;
      }
      queue.push(target);
    }
  }
  return { files: [...files].sort(), packages: [...packages].sort(), problems };
}

interface CopyLine {
  from: string | null;
  sources: string[];
  dest: string;
}

/** COPY instructions of the Dockerfile's `runner` stage, sources relative to
 *  /app and destinations relative to its WORKDIR (/app). */
function runnerCopies(): CopyLine[] {
  const dockerfile = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8').replace(/\\\n/g, ' ');
  const stages = dockerfile.split(/^FROM\s+/m);
  const runner = stages.find((stage) => /^\S+\s+AS\s+runner\b/i.test(stage));
  if (!runner) throw new Error('Dockerfile has no runner stage');

  const strip = (p: string) =>
    p
      .replace(/^\/app\//, '')
      .replace(/^\.\//, '')
      .replace(/\/$/, '');
  return runner
    .split('\n')
    .filter((line) => /^COPY\s/i.test(line.trim()))
    .map((line) => {
      const tokens = line.trim().split(/\s+/).slice(1);
      const from = tokens.find((t) => t.startsWith('--from='))?.slice('--from='.length) ?? null;
      const paths = tokens.filter((t) => !t.startsWith('--'));
      return { from, sources: paths.slice(0, -1).map(strip), dest: strip(paths[paths.length - 1]) };
    });
}

/** Whether `file` lands at the same relative path in the image, either as
 *  itself or inside a copied directory. */
function isCopied(file: string, copies: CopyLine[], stage: string): boolean {
  return copies.some(
    (copy) =>
      copy.from === stage &&
      copy.sources.some(
        (src) =>
          (src === file && copy.dest === file) || (file.startsWith(`${src}/`) && copy.dest === src),
      ),
  );
}

describe('the doctor in the runtime image', () => {
  const closure = walkClosure(ENTRY);

  it('reaches the modules it is known to need', () => {
    // A guard on the walker itself: if this shrinks, the parser broke rather
    // than the graph.
    expect(closure.files).toEqual(
      expect.arrayContaining([
        'scripts/doctor.mjs',
        'scripts/doctor.mts',
        'lib/admin/doctor.ts',
        'lib/config/settingValues.ts',
      ]),
    );
    expect(closure.packages).toContain('js-yaml');
  });

  it('writes every runtime relative import with its file extension', () => {
    expect(closure.problems).toEqual([]);
  });

  it('copies every module of the graph into the runner stage', () => {
    const copies = runnerCopies();
    const missing = closure.files.filter((file) => !isCopied(file, copies, 'builder'));
    expect(missing).toEqual([]);
  });

  it('copies every package the graph imports into the runner stage', () => {
    const copies = runnerCopies();
    const missing = closure.packages.filter(
      (pkg) => !isCopied(`node_modules/${pkg}/package.json`, copies, 'deps'),
    );
    expect(missing).toEqual([]);
  });
});

describe('runtimeImports', () => {
  it('skips type-only imports and keeps inline type specifiers', () => {
    const source = [
      "import type { A } from './a';",
      "export type { B } from './b';",
      "import { type C, d } from './c.ts';",
      "import { type E } from './e.ts';",
      "export { f } from './f.ts';",
      "import './g.ts';",
      "const h = await import('js-yaml');",
      "// import { x } from './commented';",
      "/* import { y } from './block'; */",
    ].join('\n');
    expect(runtimeImports(source)).toEqual(['./c.ts', './e.ts', './f.ts', './g.ts', 'js-yaml']);
  });

  it('reads an import spread over several lines', () => {
    expect(runtimeImports("import {\n  a,\n  type B,\n} from '../x.ts';")).toEqual(['../x.ts']);
  });
});
