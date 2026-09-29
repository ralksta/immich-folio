## 2024-08-11 - Unconstrained Base64URL Decoding DoS
**Vulnerability:** The decodeAssetId function in lib/tokens.ts accepted arbitrary length tokens and passed them directly to Buffer.from(..., 'base64url'), creating a risk of massive memory allocation (memory exhaustion/CPU DoS).
**Learning:** Functions that decode tokens from URLs (like GET /api/image/:token) must limit the input string length before passing it to Buffer.from. Otherwise, a maliciously crafted huge token can cause the Node.js process to throw RangeError (Invalid string length) or exhaust memory, despite being wrapped in a try/catch.
**Prevention:** Always enforce a strict maximum length check on opaque URL tokens before decoding them.
## 2024-05-30 - Unbounded Buffer.from Vulnerability
**Vulnerability:** Missing input length bounds on variables passed to `Buffer.from` prior to cryptographic operations (`timingSafeEqual`).
**Learning:** Cryptographic functions allocate buffers matching the input length. Passing unbounded request data (like cookies or headers) allows an attacker to cause immediate memory exhaustion (DoS) by sending massively long strings.
**Prevention:** Always enforce a maximum string length check on inputs (like `cookieVal.length > 512` or `signature.length > 256`) before passing them to `Buffer.from` or cryptographic functions.
