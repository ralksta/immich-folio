## 2024-03-12 - [Missing Rate Limiting on EXIF Endpoint]

**Vulnerability:** The `/api/exif/[id]` endpoint lacked rate limiting, making it vulnerable to DoS attacks. An attacker could rapidly request EXIF metadata, exhausting server resources and the Immich API rate limits.
**Learning:** Even simple GET endpoints that fetch metadata from an upstream server (like Immich) must be protected with rate limiting to prevent downstream DoS and resource exhaustion, especially when they perform backend API requests per hit.
**Prevention:** Always implement rate limiting on endpoints that proxy requests or query a backend API, utilizing the shared `checkRateLimit` utility.

## 2026-03-21 - [Missing Rate Limiting on Resource-Intensive OG Image Generation]
**Vulnerability:** The `/api/og` endpoint lacked rate limiting, making it vulnerable to Denial of Service (DoS) attacks. An attacker could rapidly request dynamic Open Graph images, exhausting server CPU and memory resources.
**Learning:** Any endpoint that performs resource-intensive tasks on the fly, such as dynamic image generation (even without querying upstream APIs), must be rate-limited to protect server stability.
**Prevention:** Always implement rate limiting on endpoints that generate files or images dynamically, utilizing the shared `checkRateLimit` utility.
