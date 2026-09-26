/**
 * Email addresses kept out of the served HTML.
 *
 * Address harvesters read raw HTML and do not run scripts. The server writes
 * the address reversed and base64-encoded; components/EmailLink.tsx decodes
 * it in the browser, so visitors and screen readers get a normal, clickable
 * address. The plain address appears neither in the HTML nor in the RSC
 * payload, because only the encoded form is ever passed to the client.
 *
 * This is not encryption: anyone running a browser gets the address. It only
 * has to defeat bulk harvesting. Client-safe, no Node APIs.
 */

function toBase64(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(encoded: string): string {
  const binary = atob(encoded);
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function encodeEmail(email: string): string {
  return toBase64([...email].reverse().join(''));
}

export function decodeEmail(encoded: string): string {
  try {
    return [...fromBase64(encoded)].reverse().join('');
  } catch {
    return '';
  }
}

/**
 * The no-script fallback, "name [at] example [dot] com". Weaker than the
 * encoded form, but it keeps the address reachable for a visitor without
 * JavaScript, which § 5 DDG asks of the Impressum.
 */
export function spelledOutEmail(email: string): string {
  return email.replace('@', ' [at] ').replace(/\./g, ' [dot] ');
}
