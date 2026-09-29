/**
 * Request bodies read with a hard size cap.
 *
 * `request.json()` parses the whole body before anything can object, which is
 * the one place an unbounded payload could land. These read the stream by
 * hand and stop the moment the cap is passed, so a chunked body is capped too.
 */

import type { NextRequest } from 'next/server';

/**
 * Read a request body as raw bytes, aborting once it exceeds `limit` bytes.
 * Null when the cap is passed. For callers that need the exact bytes on the
 * wire, such as an HMAC over the body.
 */
export async function readBytesCapped(request: NextRequest, limit: number): Promise<Buffer | null> {
  const stream = request.body;
  if (!stream) return Buffer.alloc(0);

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
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
      chunks.push(value);
    }
    return Buffer.concat(chunks, bytes);
  } finally {
    reader.releaseLock();
  }
}

/** Read a request body as text, aborting once it exceeds `limit` bytes. */
export async function readBodyCapped(request: NextRequest, limit: number): Promise<string | null> {
  const bytes = await readBytesCapped(request, limit);
  return bytes === null ? null : new TextDecoder().decode(bytes);
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
