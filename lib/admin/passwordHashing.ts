/**
 * Passwords typed into the admin panel are stored as scrypt hashes (#690).
 *
 * The save routes run every password field through here before writing, so
 * gallery.yaml, settings.yaml and journal frontmatter never receive the
 * password as typed. Reading plaintext keeps working for hand-written files
 * (lib/auth.ts, with its deprecation warning); the doctor still reports it.
 *
 * ── Why the previous file is consulted ─────────────────────────────
 *
 * A visitor's unlock cookie is an HMAC over the *stored* value (lib/auth.ts),
 * so replacing a hash with a fresh one, same password but a new salt, signs
 * out everyone who had unlocked the page. The admin form keeps the plaintext
 * in memory after a save and sends it again with the next one. Hashing it
 * again each time would log visitors out on every unrelated edit. So a
 * plaintext value that an existing hash already verifies keeps that hash.
 */

import { generateScryptHash, isScryptHash, verifyScrypt } from '../password';

const BCRYPT_RE = /^\$2[aby]\$/;

/** Every scrypt hash stored under one of `keys`, anywhere in the document. */
export function collectHashes(node: unknown, keys: ReadonlySet<string>): string[] {
  const found: string[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (keys.has(k) && typeof v === 'string' && isScryptHash(v)) found.push(v);
        else walk(v);
      }
    }
  };
  walk(node);
  return found;
}

/**
 * The value to store for one password field. Empty stays empty (no password),
 * a hash stays as it is, and bcrypt is left alone for the doctor to report,
 * since it cannot be verified any more and re-hashing it would lock the page
 * with the hash string as its password.
 */
export async function hashPassword(value: string, previousHashes: string[]): Promise<string> {
  if (!value || isScryptHash(value) || BCRYPT_RE.test(value)) return value;
  for (const hash of previousHashes) {
    if (await verifyScrypt(value, hash)) return hash;
  }
  return generateScryptHash(value);
}

/**
 * A copy of `node` with every string under one of `keys` hashed. `previous` is
 * the document currently on disk, whose hashes are reused where they match.
 */
export async function hashPasswordKeys<T>(
  node: T,
  keys: ReadonlySet<string>,
  previous: unknown,
): Promise<T> {
  const previousHashes = collectHashes(previous, keys);
  const walk = async (value: unknown): Promise<unknown> => {
    if (Array.isArray(value)) return Promise.all(value.map(walk));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] =
          keys.has(k) && typeof v === 'string'
            ? await hashPassword(v, previousHashes)
            : await walk(v);
      }
      return out;
    }
    return value;
  };
  return (await walk(node)) as T;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
const PASSWORD_LINE_RE = /^(\s*password\s*:\s*)(.*?)\s*$/m;

function unquote(raw: string): string {
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1).replace(/\\([\\"])/g, '$1');
  }
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1);
  return raw;
}

function frontmatterPassword(markdown: string | null): string | null {
  const block = markdown?.match(FRONTMATTER_RE)?.[1];
  const line = block?.match(PASSWORD_LINE_RE);
  return line ? unquote(line[2]) : null;
}

/**
 * The journal entry with its `password:` frontmatter line hashed. Only that
 * line changes: running the whole entry through parse and serialize would
 * also rewrite everything else the author wrote.
 */
export async function hashFrontmatterPassword(
  markdown: string,
  previousMarkdown: string | null,
): Promise<string> {
  const block = markdown.match(FRONTMATTER_RE);
  if (!block) return markdown;
  const line = block[1].match(PASSWORD_LINE_RE);
  if (!line) return markdown;

  const value = unquote(line[2]);
  const previous = frontmatterPassword(previousMarkdown);
  const hashed = await hashPassword(value, previous && isScryptHash(previous) ? [previous] : []);
  if (hashed === value) return markdown;

  // Replacer functions, not strings: a `$` in the author's title would
  // otherwise be read as a replacement pattern.
  const newBlock = block[1].replace(PASSWORD_LINE_RE, () => `${line[1]}"${hashed}"`);
  return markdown.replace(block[1], () => newBlock);
}
