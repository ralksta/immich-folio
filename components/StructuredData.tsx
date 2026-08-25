/**
 * A JSON-LD block (#472).
 *
 * `proxy.ts` sets a CSP with a per-request nonce and no `unsafe-inline`
 * fallback, so an inline script without the nonce is blocked — silently, which
 * is the failure mode worth guarding against: the markup looks right in the
 * source and the crawler never sees it.
 */

import { headers } from 'next/headers';

/**
 * Serialise for embedding in a <script> element.
 *
 * `</script>` inside a string value would end the element early and let the
 * rest be parsed as markup, so the angle brackets are escaped. JSON parsers
 * read `\u003c` as `<`, which leaves the data unchanged.
 */
function serialise(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

export async function StructuredData({ data }: { data: unknown }) {
  if (!data) return null;
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: serialise(data) }}
    />
  );
}
