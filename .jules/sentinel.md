## 2024-05-18 - Unprotected Dynamic Image Generation Endpoints

**Vulnerability:** The `/api/og` route generates an `ImageResponse` dynamically using `next/og`. Because this operation is computationally expensive and memory-intensive, unauthenticated endpoints lacking rate limiting act as prominent Denial of Service (DoS) vectors. Attackers can flood the endpoint with varying parameters, forcing the server to continually spawn compute-heavy tasks until resources are exhausted and the instance crashes or latency spikes to unacceptable levels.

**Learning:** Next.js dynamic endpoints that do not hit external upstream APIs or databases (like image generation with `next/og`) are often overlooked for rate limiting. Rate limiting is just as critical for protecting local compute resources as it is for protecting downstream API quotas or databases. Any route performing on-the-fly heavy processing must implement throttling.

**Prevention:** Apply the shared `checkRateLimit` utility (from `@/lib/rate-limit`) to all computationally expensive endpoints (such as `next/og` usage), even if they do not explicitly query external services. Ensure `getConfig().rateLimitRpm` is passed as the threshold to maintain configurable global protection.
## 2024-05-19 - Timing Attack Vulnerability in Variable-Length Secret Comparisons

**Vulnerability:** A plain string comparison (`password === sp.password`) was being used for legacy plaintext password validation in `lib/auth.ts`. This introduces a side-channel timing attack risk because string comparison algorithms typically return `false` as soon as they find the first mismatching character. An attacker can repeatedly attempt authentication, measuring the time it takes for the server to reject the guess, allowing them to incrementally deduce the password length and character by character.

**Learning:** When comparing variable-length secrets (like plaintext passwords) that have not already been securely hashed, you cannot directly compare them, and you cannot simply use `crypto.timingSafeEqual` because it requires both buffers to be of exactly the same length. Passing differently sized buffers into `crypto.timingSafeEqual` will result in a length-based error, which itself acts as a side-channel leak for the length of the secret.

**Prevention:** To safely prevent timing attacks when comparing variable-length secrets, hash both the user input and the stored secret using a fast, fixed-length algorithm (like SHA-256) first. The resulting hashes will be identical in length (e.g., 32 bytes for SHA-256), making them safe to compare using `crypto.timingSafeEqual()`.
