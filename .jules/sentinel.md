## 2025-02-23 - Prevent DoS from Unconstrained Cryptographic Input
**Vulnerability:** `crypto.timingSafeEqual` throws an exception if buffers have different lengths, and variable length comparisons leak length information. Unconstrained input strings can cause memory exhaustion (DoS).
**Learning:** Checking lengths prior to using timingSafeEqual avoids application crashes. Hashing secrets to a fixed length prior to comparison prevents side-channel timing attacks. Maximum string length checks prevent memory exhaustion DoS when buffering or performing crypto operations.
**Prevention:** Always enforce max input lengths, hash secrets to fixed lengths, and verify equal buffer lengths before using `crypto.timingSafeEqual`.
