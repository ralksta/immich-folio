## 2024-03-12 - [Missing Rate Limiting on EXIF Endpoint]

**Vulnerability:** The `/api/exif/[id]` endpoint lacked rate limiting, making it vulnerable to DoS attacks. An attacker could rapidly request EXIF metadata, exhausting server resources and the Immich API rate limits.
**Learning:** Even simple GET endpoints that fetch metadata from an upstream server (like Immich) must be protected with rate limiting to prevent downstream DoS and resource exhaustion, especially when they perform backend API requests per hit.
**Prevention:** Always implement rate limiting on endpoints that proxy requests or query a backend API, utilizing the shared `checkRateLimit` utility.
## 2024-03-19 - Missing Rate Limit on Upstream Dependency Endpoint
**Vulnerability:** The `/api/health` endpoint checked upstream dependency (Immich API) status without rate limiting, exposing both the frontend proxy and backend service to downstream DoS attacks.
**Learning:** Even seemingly harmless internal endpoints like health checks can be weaponized to cause resource exhaustion or Denial of Service on downstream services if they trigger heavy or synchronous operations (like network requests to upstream APIs) unconditionally on every hit.
**Prevention:** Apply strict rate limiting to any public endpoint that queries an upstream API, especially health checks that are unauthenticated and cheap to call.
