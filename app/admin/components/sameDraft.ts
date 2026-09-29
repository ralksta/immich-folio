/**
 * Whether an editor's state is still what was last loaded or saved (QA A-19).
 *
 * The editors set a dirty flag on every edit, so typing a value back to what
 * it was left "Unsaved changes" up, the leave guard armed and the draft
 * stored. Comparing against the saved state fixes that, but not by plain
 * JSON: an edit that is undone does not always undo its shape. The settings
 * form creates the parent object of a path it writes (`contact: {}`), and a
 * key that is deleted and typed again moves to the end of its object. So the
 * comparison ignores key order, `undefined` and empty objects — none of which
 * reaches the YAML that is written.
 */

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const c = canonical((value as Record<string, unknown>)[key]);
      if (c === undefined) continue;
      if (c && typeof c === 'object' && !Array.isArray(c) && Object.keys(c).length === 0) continue;
      out[key] = c;
    }
    return out;
  }
  return value;
}

export function sameDraft(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
