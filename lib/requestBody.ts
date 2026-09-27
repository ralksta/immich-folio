/**
 * Request bodies read with a hard size cap.
 *
 * `request.json()` parses the whole body before anything can object, which is
 * the one place an unbounded payload could land. These read the stream by
 * hand and stop the moment the cap is passed, so a chunked body is capped too.
 */

import type { NextRequest } from 'next/server';

/** Read a request body as text, aborting once it exceeds `limit` bytes. */
export async function readBodyCapped(request: NextRequest, limit: number): Promise<string | null> {
  const stream = request.body;
  if (!stream) return '';

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Read a JSON body of at most `limit` bytes. Null for an oversized, empty or
 * unparseable body — the caller answers 400 either way.
 */
export async function readJsonCapped(request: NextRequest, limit: number): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > limit) return null;
  try {
    const text = await readBodyCapped(request, limit);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}
