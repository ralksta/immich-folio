## 2024-08-11 - Unconstrained Base64URL Decoding DoS
**Vulnerability:** The decodeAssetId function in lib/tokens.ts accepted arbitrary length tokens and passed them directly to Buffer.from(..., 'base64url'), creating a risk of massive memory allocation (memory exhaustion/CPU DoS).
**Learning:** Functions that decode tokens from URLs (like GET /api/image/:token) must limit the input string length before passing it to Buffer.from. Otherwise, a maliciously crafted huge token can cause the Node.js process to throw RangeError (Invalid string length) or exhaust memory, despite being wrapped in a try/catch.
**Prevention:** Always enforce a strict maximum length check on opaque URL tokens before decoding them.
