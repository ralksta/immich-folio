## 2024-05-24 - DoS and Timing attacks via timingSafeEqual
**Vulnerability:** Variable-length strings used directly in `crypto.timingSafeEqual` or `Buffer.alloc` without max-length limits could lead to memory exhaustion (DoS) or timing attacks leaking length information.
**Learning:** `crypto.timingSafeEqual` will throw if buffers are not identical lengths, requiring length normalization or hashing. Without max length bounds, allocating buffers based on user input length is extremely dangerous.
**Prevention:** Enforce a strict max length check on inputs before processing. Hash variable-length secrets to a fixed length before comparison using `timingSafeEqual`.
