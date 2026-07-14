## 2024-07-14 - timingSafeEqual Input Buffer Mismatches and DoS Risks
**Vulnerability:** Uncaught exceptions when input strings to `timingSafeEqual` have differing lengths, and unbounded `Buffer.alloc` sizes based on user input length causing DoS.
**Learning:** `crypto.timingSafeEqual` strictly requires input buffers to have identical byte lengths, throwing an unhandled exception if they differ. Furthermore, comparing variable-length inputs without hashing or length limits leaks length info and allows memory exhaustion.
**Prevention:** Always enforce strict string length bounds early, verify buffer lengths are equal before calling `timingSafeEqual`, and compare fixed-length hashes rather than plaintext inputs when comparing secrets.
