## 2024-08-11 - Unconstrained Base64URL Decoding DoS
**Vulnerability:** The decodeAssetId function in lib/tokens.ts accepted arbitrary length tokens and passed them directly to Buffer.from(..., 'base64url'), creating a risk of massive memory allocation (memory exhaustion/CPU DoS).
**Learning:** Functions that decode tokens from URLs (like GET /api/image/:token) must limit the input string length before passing it to Buffer.from. Otherwise, a maliciously crafted huge token can cause the Node.js process to throw RangeError (Invalid string length) or exhaust memory, despite being wrapped in a try/catch.
**Prevention:** Always enforce a strict maximum length check on opaque URL tokens before decoding them.
## 2024-05-31 - Fix missing string length bounds before Buffer.from
**Vulnerability:** Multiple places accepted unbounded string inputs (like webhook signatures and authentication cookies) and passed them directly to Buffer.from(), enabling memory exhaustion/CPU DoS if large buffers were allocated.
**Learning:** Even when inputs are verified with timingSafeEqual later, simply creating a buffer from an unconstrained string allocates memory proportional to its size and causes memory exhaustion.
**Prevention:** Always enforce a max length check on unconstrained variable-length string inputs before passing them into Buffer.from(), especially for authentication or token inputs originating from headers or cookies.
