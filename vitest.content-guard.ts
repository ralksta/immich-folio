/**
 * Refuses every filesystem write into the checkout's own content/ directory
 * while the unit suite runs.
 *
 * In a self-hosted deployment that directory is the live content — the
 * container mounts it — so a test that writes a journal entry there publishes
 * it for as long as the test runs and leaves a `.deleted.bak` behind in
 * content/journal/.backups. Tests point `process.cwd()` at a temp directory
 * instead (see journal-backup.test.ts); this guard makes forgetting that fail
 * loudly rather than quietly touching the site.
 *
 * Why patch fs rather than snapshot the directory before and after: the live
 * site writes analytics.json and contact messages into the same directory at
 * any moment, which a snapshot cannot tell apart from a test. Patching sees
 * only this process's writes, blocks them before they happen, and catches a
 * file that is written and deleted again within one test.
 *
 * A blocked write throws, and is also recorded, because service code often
 * swallows errors (`catch {}` in cleanup hooks, `.catch(() => {})` after a
 * failed rename); the afterEach below turns any record into a test failure.
 */
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

interface GuardState {
  contentDir: string;
  violations: string[];
}

const STATE_KEY = Symbol.for('folio.contentWriteGuard');

// Tests spy on process.cwd(); the bound original keeps resolving relative
// paths the way the OS does, against the real working directory.
const realCwd = process.cwd.bind(process);

function toPath(p: unknown): string | null {
  if (typeof p === 'string') return p;
  if (Buffer.isBuffer(p)) return p.toString();
  if (p instanceof URL) return p.protocol === 'file:' ? fileURLToPath(p) : null;
  return null; // a file descriptor or FileHandle: nothing to resolve
}

/** Flags that can create, truncate or change a file. */
function isWriteFlag(flags: unknown): boolean {
  if (flags === undefined || flags === null) return false;
  if (typeof flags === 'number') {
    const { O_WRONLY, O_RDWR, O_CREAT, O_TRUNC, O_APPEND } = fs.constants;
    return (flags & (O_WRONLY | O_RDWR | O_CREAT | O_TRUNC | O_APPEND)) !== 0;
  }
  return typeof flags === 'string' && /[wa+]/.test(flags);
}

function install(): GuardState {
  const existing = (fs as unknown as Record<symbol, GuardState | undefined>)[STATE_KEY];
  if (existing) return existing;

  const state: GuardState = {
    contentDir: path.join(path.dirname(fileURLToPath(import.meta.url)), 'content'),
    violations: [],
  };

  const check = (op: string, p: unknown) => {
    const raw = toPath(p);
    if (raw === null) return;
    const resolved = path.resolve(realCwd(), raw);
    if (resolved !== state.contentDir && !resolved.startsWith(state.contentDir + path.sep)) {
      return;
    }
    const message =
      `Test tried to ${op} ${resolved} — the real content/ directory. ` +
      `Point process.cwd() at a temp directory first (see journal-backup.test.ts).`;
    state.violations.push(message);
    throw new Error(message);
  };

  // Which arguments are destination paths. rename moves the source too, so
  // both of its paths count; copies and links only create their second.
  const targets: Record<string, number[]> = {
    writeFile: [0],
    appendFile: [0],
    mkdir: [0],
    mkdtemp: [0],
    rm: [0],
    rmdir: [0],
    unlink: [0],
    truncate: [0],
    chmod: [0],
    chown: [0],
    lchown: [0],
    utimes: [0],
    lutimes: [0],
    rename: [0, 1],
    copyFile: [1],
    cp: [1],
    link: [1],
    symlink: [1],
  };

  // A promise-returning fs function never throws synchronously, so the
  // fs.promises wrappers reject instead — a `.catch()` on the call must see it.
  const wrap = (
    owner: Record<string, unknown>,
    name: string,
    guard: (args: unknown[]) => void,
    rejects = false,
  ) => {
    const original = owner[name];
    if (typeof original !== 'function') return;
    owner[name] = function guarded(this: unknown, ...args: unknown[]) {
      try {
        guard(args);
      } catch (err) {
        if (rejects) return Promise.reject(err);
        throw err;
      }
      return (original as AnyFn).apply(this, args);
    };
  };

  const fsObj = fs as unknown as Record<string, unknown>;
  const promises = fs.promises as unknown as Record<string, unknown>;
  for (const [name, indices] of Object.entries(targets)) {
    const guard = (args: unknown[]) => indices.forEach((i) => check(name, args[i]));
    wrap(fsObj, name, guard);
    wrap(fsObj, `${name}Sync`, guard);
    wrap(promises, name, guard, true);
  }
  const openGuard = (args: unknown[]) => {
    if (isWriteFlag(args[1])) check('open for writing', args[0]);
  };
  wrap(fsObj, 'open', openGuard);
  wrap(fsObj, 'openSync', openGuard);
  wrap(promises, 'open', openGuard, true);
  wrap(fsObj, 'createWriteStream', (args) => check('stream into', args[0]));

  // `import { writeFile } from 'fs/promises'` binds the export once; this
  // pushes the wrapped functions into those bindings too.
  syncBuiltinESMExports();

  Object.defineProperty(fs, STATE_KEY, { value: state });
  return state;
}

const state = install();

/** Returns and clears the recorded violations. For the guard's own test. */
export function takeContentWriteViolations(): string[] {
  return state.violations.splice(0);
}

/** The directory the guard protects. For the guard's own test. */
export const guardedContentDir = state.contentDir;

function failOnViolations() {
  const found = takeContentWriteViolations();
  if (found.length > 0) throw new Error(found.join('\n'));
}

afterEach(failOnViolations);
afterAll(failOnViolations);
