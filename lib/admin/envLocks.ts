/**
 * Settings fields that an environment variable overrides (#605).
 *
 * Only fields where the environment actually *wins* belong here — an edit in
 * the panel would save, report success and then do nothing. `SITE_TITLE`,
 * `SITE_SUBTITLE` and `SITE_URL` are deliberately absent: lib/config/index.ts
 * resolves them as `settings.X ?? env.X`, so the field takes precedence and
 * editing it works (see lib/siteUrl.ts).
 *
 * Client-safe: no `fs`, no `lib/env` import. The route passes the parsed env
 * in, and only the variable *names* ever reach the browser.
 */

/** Dotted settings.yaml path → the environment variable that overrides it. */
export const ENV_LOCKS = {
  sitePassword: 'SITE_PASSWORD',
  'contact.notifyUrl': 'CONTACT_NOTIFY_URL',
} as const;

export type EnvLockedKey = keyof typeof ENV_LOCKS;

/** Locked path → variable name. Never carries the variable's value. */
export type EnvLocks = Partial<Record<EnvLockedKey, string>>;

/** The locks in effect for this environment: paths whose variable is set. */
export function resolveEnvLocks(env: object): EnvLocks {
  const source = env as Record<string, unknown>;
  const locks: EnvLocks = {};
  for (const [path, name] of Object.entries(ENV_LOCKS) as [EnvLockedKey, string][]) {
    const value = source[name];
    if (typeof value === 'string' && value.trim() !== '') locks[path] = name;
  }
  return locks;
}

function getPath(obj: unknown, path: string[]): unknown {
  let cur = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/**
 * The incoming settings with every locked path reset to what settings.yaml
 * already holds. The panel disables those fields, so this only matters for a
 * hand-crafted request or a stale draft — but a locked field must not change
 * through a save whose effect the operator could never see.
 */
export function keepLockedValues<T extends object>(
  incoming: T,
  stored: object | null | undefined,
  locks: EnvLocks,
): T {
  const out = structuredClone(incoming) as Record<string, unknown>;
  for (const dotted of Object.keys(locks)) {
    const path = dotted.split('.');
    const last = path[path.length - 1];
    const previous = getPath(stored, path);
    let parent: Record<string, unknown> | null = out;
    for (const key of path.slice(0, -1)) {
      const next: unknown = parent[key];
      if (!next || typeof next !== 'object') {
        if (previous === undefined) {
          parent = null;
          break;
        }
        parent[key] = {};
      }
      parent = parent[key] as Record<string, unknown>;
    }
    if (!parent) continue;
    if (previous === undefined) delete parent[last];
    else parent[last] = previous;
  }
  return out as T;
}
