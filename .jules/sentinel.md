## 2024-09-15 - Prevent memory exhaustion from unbounded Buffer.from
**Vulnerability:** Multiple functions accepted arbitrary length strings from request headers/cookies and passed them directly to Buffer.from(), creating a risk of massive memory allocation (memory exhaustion/CPU DoS).
**Learning:** Functions that parse untrusted strings into buffers for crypto comparisons must limit the input string length before passing it to Buffer.from. Otherwise, a maliciously crafted huge string can cause the Node.js process to throw RangeError or exhaust memory, despite being wrapped in a try/catch.
**Prevention:** Always enforce a maximum string length (e.g., 512 bytes) on user inputs (like tokens, signatures, or cookies) before parsing them with Buffer.from() or using them in timingSafeEqual.
