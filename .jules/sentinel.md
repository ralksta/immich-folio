## 2024-05-18 - Unprotected Dynamic Image Generation Endpoints

**Vulnerability:** The `/api/og` route generates an `ImageResponse` dynamically using `next/og`. Because this operation is computationally expensive and memory-intensive, unauthenticated endpoints lacking rate limiting act as prominent Denial of Service (DoS) vectors. Attackers can flood the endpoint with varying parameters, forcing the server to continually spawn compute-heavy tasks until resources are exhausted and the instance crashes or latency spikes to unacceptable levels.

**Learning:** Next.js dynamic endpoints that do not hit external upstream APIs or databases (like image generation with `next/og`) are often overlooked for rate limiting. Rate limiting is just as critical for protecting local compute resources as it is for protecting downstream API quotas or databases. Any route performing on-the-fly heavy processing must implement throttling.

**Prevention:** Apply the shared `checkRateLimit` utility (from `@/lib/rate-limit`) to all computationally expensive endpoints (such as `next/og` usage), even if they do not explicitly query external services. Ensure `getConfig().rateLimitRpm` is passed as the threshold to maintain configurable global protection.
## 2024-05-18 - [Preventing Timing Attacks on Variable-Length Secrets]
**Vulnerability:** Comparing variable-length plaintext passwords using strict equality (`===`) or `crypto.timingSafeEqual` with unequal lengths, which leaks length information and enables timing attacks.
**Learning:** When comparing variable-length secrets (like plaintext fallback passwords), both values must be hashed to a fixed-length algorithm (like SHA-256) first to ensure identical input lengths for the secure comparison, preventing side-channel leaks.
**Prevention:** Always hash variable-length secrets to a fixed length before passing them to `crypto.timingSafeEqual`.
## 2024-05-18 - Rate Limit Store Flooding and Cache Eviction Vulnerability
**Vulnerability:** The rate limiter implemented an LRU/FIFO map to track API request limits, evicting the oldest tracked IP when maximum capacity was reached. An attacker could flood the store with randomly spoofed IP headers, continuously evicting legitimate users' IP addresses. This allowed the attacker to effectively bypass their own rate limit and subject the upstream server to DoS.
**Learning:** Evicting entries from a security control store (like a rate limit map) under pressure turns the limit into a revolving door if an attacker controls the keys (e.g., via IP spoofing headers).
**Prevention:** Rather than evicting old entries when an in-memory rate limit store is full, the correct security posture is to fail closed (or block new keys) until entries naturally expire, preserving tracking on existing keys.
