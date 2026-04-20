## 2024-05-18 - Unprotected Dynamic Image Generation Endpoints

**Vulnerability:** The `/api/og` route generates an `ImageResponse` dynamically using `next/og`. Because this operation is computationally expensive and memory-intensive, unauthenticated endpoints lacking rate limiting act as prominent Denial of Service (DoS) vectors. Attackers can flood the endpoint with varying parameters, forcing the server to continually spawn compute-heavy tasks until resources are exhausted and the instance crashes or latency spikes to unacceptable levels.

**Learning:** Next.js dynamic endpoints that do not hit external upstream APIs or databases (like image generation with `next/og`) are often overlooked for rate limiting. Rate limiting is just as critical for protecting local compute resources as it is for protecting downstream API quotas or databases. Any route performing on-the-fly heavy processing must implement throttling.

**Prevention:** Apply the shared `checkRateLimit` utility (from `@/lib/rate-limit`) to all computationally expensive endpoints (such as `next/og` usage), even if they do not explicitly query external services. Ensure `getConfig().rateLimitRpm` is passed as the threshold to maintain configurable global protection.
## 2024-05-18 - [Preventing Timing Attacks on Variable-Length Secrets]
**Vulnerability:** Comparing variable-length plaintext passwords using strict equality (`===`) or `crypto.timingSafeEqual` with unequal lengths, which leaks length information and enables timing attacks.
**Learning:** When comparing variable-length secrets (like plaintext fallback passwords), both values must be hashed to a fixed-length algorithm (like SHA-256) first to ensure identical input lengths for the secure comparison, preventing side-channel leaks.
**Prevention:** Always hash variable-length secrets to a fixed length before passing them to `crypto.timingSafeEqual`.
## 2024-05-25 - Rate Limit IP Spoofing
**Vulnerability:** The rate limiter and Map API used `x-real-ip` and `x-forwarded-for` HTTP headers to determine the client IP without checking `request.ip`.
**Learning:** This allows an attacker to easily spoof their IP address by injecting a custom `x-forwarded-for` header, bypassing rate limiting mechanisms, including the critical 10 RPM brute-force protection on the auth endpoint. `request.ip` represents the actual TCP connection IP or the IP populated by a trusted edge proxy (like Vercel/Next.js).
**Prevention:** Always prioritize `request.ip` over HTTP headers for rate limiting and IP-based security controls. Centralize IP retrieval into a single, verified function (`getClientIp`) rather than inline header reading.
