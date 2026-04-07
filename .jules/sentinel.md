## 2024-05-18 - Unprotected Dynamic Image Generation Endpoints

**Vulnerability:** The `/api/og` route generates an `ImageResponse` dynamically using `next/og`. Because this operation is computationally expensive and memory-intensive, unauthenticated endpoints lacking rate limiting act as prominent Denial of Service (DoS) vectors. Attackers can flood the endpoint with varying parameters, forcing the server to continually spawn compute-heavy tasks until resources are exhausted and the instance crashes or latency spikes to unacceptable levels.

**Learning:** Next.js dynamic endpoints that do not hit external upstream APIs or databases (like image generation with `next/og`) are often overlooked for rate limiting. Rate limiting is just as critical for protecting local compute resources as it is for protecting downstream API quotas or databases. Any route performing on-the-fly heavy processing must implement throttling.

**Prevention:** Apply the shared `checkRateLimit` utility (from `@/lib/rate-limit`) to all computationally expensive endpoints (such as `next/og` usage), even if they do not explicitly query external services. Ensure `getConfig().rateLimitRpm` is passed as the threshold to maintain configurable global protection.
## 2024-05-18 - [Preventing Timing Attacks on Variable-Length Secrets]
**Vulnerability:** Comparing variable-length plaintext passwords using strict equality (`===`) or `crypto.timingSafeEqual` with unequal lengths, which leaks length information and enables timing attacks.
**Learning:** When comparing variable-length secrets (like plaintext fallback passwords), both values must be hashed to a fixed-length algorithm (like SHA-256) first to ensure identical input lengths for the secure comparison, preventing side-channel leaks.
**Prevention:** Always hash variable-length secrets to a fixed length before passing them to `crypto.timingSafeEqual`.
## 2025-04-07 - [AES Padding Oracle Vulnerability in Token Encryption]
**Vulnerability:** The application used `aes-256-cbc` to encrypt Immich UUIDs into opaque tokens. CBC mode without a cryptographic MAC (like HMAC) is inherently vulnerable to padding oracle attacks. Because the decryption function checks for correct padding (and falls back or fails based on it), an attacker can iteratively manipulate the ciphertext and observe server responses to decrypt the token, revealing the underlying UUID.
**Learning:** Cryptographic operations in web applications must ensure authenticity alongside confidentiality. Encrypting data without authenticating it allows attackers to tamper with ciphertexts. `aes-256-cbc` alone is never safe for public tokens.
**Prevention:** Always use Authenticated Encryption with Associated Data (AEAD) ciphers, such as `aes-256-gcm`, which integrate a Message Authentication Code (MAC/authTag). If decryption fails the MAC check, the algorithm aborts immediately, completely preventing padding oracle and tampering attacks.
