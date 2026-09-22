/**
 * How Folio talks to Immich over HTTP — and nothing about what it asks for.
 *
 * Split out of lib/immich.ts (#610), where transport, caching and domain logic
 * shared one 835-line class. Everything here is a plain function over explicit
 * arguments: no config lookup, no cache, no client state. That is what makes
 * the rules below testable without standing up a client.
 */

/**
 * `AbortSignal.timeout()` rejects with a `TimeoutError`; an explicit
 * `controller.abort()` rejects with an `AbortError`. Both mean we gave up
 * waiting, and both arrive as a plain DOMException.
 */
export function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

/**
 * Thrown when Immich could not answer: transport failure, an error status, or
 * a non-JSON body where JSON was requested.
 *
 * This is deliberately distinct from a `null` return, which means Immich *did*
 * answer and said the resource does not exist. Conflating the two made every
 * album URL render a hard 404 while Immich was down — including albums that
 * exist — because the page calls `notFound()` on a null album. Only 404/410
 * are treated as "gone"; everything else is an outage and must surface as one.
 */
export class ImmichUnavailableError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ImmichUnavailableError';
    this.status = status;
  }
}

export interface ImmichRequestOptions {
  apiUrl: string;
  apiKey: string;
  timeoutMs: number;
  /** Path appended to apiUrl, e.g. `/albums`. */
  endpoint: string;
  /** Present for a POST, absent for a GET. */
  body?: unknown;
}

/**
 * One JSON request to Immich.
 *
 * Returns `null` only when the resource is genuinely gone (404 or 410) and
 * throws ImmichUnavailableError for everything else. That distinction is the
 * point of this function: a 5xx, a rate limit or a rejected API key all mean
 * Immich cannot serve us *right now*, and rendering those as a missing album
 * would tell visitors and crawlers the content no longer exists.
 */
export async function requestJson<T>({
  apiUrl,
  apiKey,
  timeoutMs,
  endpoint,
  body,
}: ImmichRequestOptions): Promise<T | null> {
  const url = `${apiUrl}${endpoint}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'x-api-key': apiKey,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      // JSON payloads are small, so one budget can cover the whole exchange.
      // Without it the only ceiling is undici's default, measured in minutes.
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    console.error(`[Immich] Failed to reach ${url}:`, error);
    throw new ImmichUnavailableError(
      isTimeout(error)
        ? `Immich did not respond within ${timeoutMs}ms for ${endpoint}`
        : `Cannot reach Immich for ${endpoint}`,
    );
  }

  if (!res.ok) {
    console.error(`[Immich] ${res.status} ${res.statusText} for ${endpoint}`);
    // Neither branch below reads the body. Under undici an unconsumed body
    // keeps its socket out of the pool until GC finalises it, so a proxy
    // answering every request with an error accumulates orphaned sockets for
    // as long as the fault lasts (#635).
    await res.body?.cancel();
    if (res.status !== 404 && res.status !== 410) {
      throw new ImmichUnavailableError(
        `Immich returned ${res.status} ${res.statusText} for ${endpoint}`,
        res.status,
      );
    }
    return null;
  }

  const contentType = res.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) {
    // We always send Accept: application/json. Anything else is a gateway or
    // proxy error page, not a valid answer about the resource — and, same as
    // above, a body neither read here (#635).
    await res.body?.cancel();
    throw new ImmichUnavailableError(
      `Immich returned non-JSON (${contentType || 'no Content-Type'}) for ${endpoint}`,
    );
  }

  try {
    return (await res.json()) as T;
  } catch (error) {
    // The timeout also covers the body read, so an abort can surface here.
    if (isTimeout(error)) {
      console.error(`[Immich] Timed out reading ${url}`);
      throw new ImmichUnavailableError(
        `Immich did not respond within ${timeoutMs}ms for ${endpoint}`,
      );
    }
    console.error(`[Immich] Malformed JSON from ${url}:`, error);
    throw new ImmichUnavailableError(`Immich returned malformed JSON for ${endpoint}`);
  }
}
