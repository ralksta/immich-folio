## 2024-03-12 - [Missing Rate Limiting on EXIF Endpoint]

**Vulnerability:** The `/api/exif/[id]` endpoint lacked rate limiting, making it vulnerable to DoS attacks. An attacker could rapidly request EXIF metadata, exhausting server resources and the Immich API rate limits.
**Learning:** Even simple GET endpoints that fetch metadata from an upstream server (like Immich) must be protected with rate limiting to prevent downstream DoS and resource exhaustion, especially when they perform backend API requests per hit.
**Prevention:** Always implement rate limiting on endpoints that proxy requests or query a backend API, utilizing the shared `checkRateLimit` utility.

## 2024-05-14 - Protect Downstream APIs from Unauthenticated Health Checks
**Vulnerability:** The `/api/health` endpoint was unauthenticated and lacked rate limiting, allowing any user to repeatedly ping it. This endpoint queried the downstream Immich API, creating a Denial of Service (DoS) risk by proxy.
**Learning:** Even seemingly harmless endpoints like health checks can be weaponized if they trigger expensive or downstream operations without protection.
**Prevention:** Always implement rate limiting on endpoints that trigger downstream requests, especially if they are unauthenticated. Use `checkRateLimit` from `lib/rate-limit.ts` to restrict the number of requests per IP.
