## 2024-05-18 - Unprotected Dynamic Image Generation Endpoints

**Vulnerability:** The `/api/og` route generates an `ImageResponse` dynamically using `next/og`. Because this operation is computationally expensive and memory-intensive, unauthenticated endpoints lacking rate limiting act as prominent Denial of Service (DoS) vectors. Attackers can flood the endpoint with varying parameters, forcing the server to continually spawn compute-heavy tasks until resources are exhausted and the instance crashes or latency spikes to unacceptable levels.

**Learning:** Next.js dynamic endpoints that do not hit external upstream APIs or databases (like image generation with `next/og`) are often overlooked for rate limiting. Rate limiting is just as critical for protecting local compute resources as it is for protecting downstream API quotas or databases. Any route performing on-the-fly heavy processing must implement throttling.

**Prevention:** Apply the shared `checkRateLimit` utility (from `@/lib/rate-limit`) to all computationally expensive endpoints (such as `next/og` usage), even if they do not explicitly query external services. Ensure `getConfig().rateLimitRpm` is passed as the threshold to maintain configurable global protection.
## 2024-05-18 - [Preventing Timing Attacks on Variable-Length Secrets]
**Vulnerability:** Comparing variable-length plaintext passwords using strict equality (`===`) or `crypto.timingSafeEqual` with unequal lengths, which leaks length information and enables timing attacks.
**Learning:** When comparing variable-length secrets (like plaintext fallback passwords), both values must be hashed to a fixed-length algorithm (like SHA-256) first to ensure identical input lengths for the secure comparison, preventing side-channel leaks.
**Prevention:** Always hash variable-length secrets to a fixed length before passing them to `crypto.timingSafeEqual`.

## 2024-05-20 - Upgrade Token Encryption to AES-256-GCM
**Vulnerability:** The `lib/tokens.ts` module was using `aes-256-cbc` to encrypt tokens deterministically. Using AES-CBC without an authentication tag (like HMAC) is vulnerable to chosen-ciphertext and padding oracle attacks, which could allow an attacker to forge or decode tokens without the secret key.
**Learning:** For deterministic tokens meant to be exposed publicly in URLs, authenticated encryption with associated data (AEAD) algorithms like AES-GCM are required to ensure data integrity and prevent tampering.
**Prevention:** Always use authenticated encryption (e.g., AES-GCM or AES-CBC with HMAC) when encrypting data, especially data exposed to the client. When migrating encryption schemas, use version prefixes (e.g., `v2:`) to safely differentiate new formats and preserve backward compatibility for old tokens.
