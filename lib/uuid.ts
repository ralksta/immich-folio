/**
 * Shared UUID validation.
 *
 * Immich object IDs are interpolated into upstream API URLs, so anything that
 * reaches `fetch()` must be shape-checked first: the URL constructor resolves
 * `..` segments, which would otherwise turn an album ID into an arbitrary
 * Immich endpoint reached with the server's API key.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}
