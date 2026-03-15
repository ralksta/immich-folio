## 2024-03-12 - [Missing Rate Limiting on EXIF Endpoint]

**Vulnerability:** The `/api/exif/[id]` endpoint lacked rate limiting, making it vulnerable to DoS attacks. An attacker could rapidly request EXIF metadata, exhausting server resources and the Immich API rate limits.
**Learning:** Even simple GET endpoints that fetch metadata from an upstream server (like Immich) must be protected with rate limiting to prevent downstream DoS and resource exhaustion, especially when they perform backend API requests per hit.
**Prevention:** Always implement rate limiting on endpoints that proxy requests or query a backend API, utilizing the shared `checkRateLimit` utility.

## 2024-03-15 - [Missing Rate Limiting on Health Endpoint]

**Vulnerability:** The `/api/health` endpoint lacked rate limiting, making it vulnerable to DoS attacks. An attacker could rapidly request the endpoint, which would subsequently rapidly ping the backend Immich server (`await immich.ping()`), potentially causing resource exhaustion.
**Learning:** Health endpoints that ping upstream services (like Immich) must be protected with rate limiting to prevent downstream DoS and resource exhaustion.
**Prevention:** Always implement rate limiting on endpoints that proxy requests or query a backend API, utilizing the shared `checkRateLimit` utility.
