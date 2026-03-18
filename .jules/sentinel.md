## 2024-03-12 - [Missing Rate Limiting on EXIF Endpoint]

**Vulnerability:** The `/api/exif/[id]` endpoint lacked rate limiting, making it vulnerable to DoS attacks. An attacker could rapidly request EXIF metadata, exhausting server resources and the Immich API rate limits.
**Learning:** Even simple GET endpoints that fetch metadata from an upstream server (like Immich) must be protected with rate limiting to prevent downstream DoS and resource exhaustion, especially when they perform backend API requests per hit.
**Prevention:** Always implement rate limiting on endpoints that proxy requests or query a backend API, utilizing the shared `checkRateLimit` utility.

## 2026-03-18 - [Missing Rate Limiting on Health Endpoint]

**Vulnerability:** The `/api/health` endpoint pinged the backend API (`immich.ping()`) without rate limiting, exposing the backend to a potential downstream Denial of Service (DoS) attack if the health check was flooded.
**Learning:** Health check endpoints that actively poll backend services (rather than returning cached or local state) are critical attack vectors for resource exhaustion if unauthenticated and un-rate-limited.
**Prevention:** Always enforce rate limits on unauthenticated health checks that perform expensive backend operations, or rely on cached connection statuses where possible.
