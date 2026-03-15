## 2024-03-15 - [Faster Base64 Decoding in Node.js]
**Learning:** `Buffer.from(..., 'base64')` is dramatically faster (often 10x+) than `Uint8Array.from(atob(...))` for base64 decoding in Node.js environments.
**Action:** When performing base64 decoding in server-side Next.js code or utilities that might run in both client and server, use a fallback like `typeof Buffer !== 'undefined' ? Buffer.from(...) : Uint8Array.from(atob(...))` to get maximum performance in Node without breaking browser/Edge compatibility.
