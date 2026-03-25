## 2024-03-12 - [Missing Rate Limiting on EXIF Endpoint]

**Vulnerability:** The `/api/exif/[id]` endpoint lacked rate limiting, making it vulnerable to DoS attacks. An attacker could rapidly request EXIF metadata, exhausting server resources and the Immich API rate limits.
**Learning:** Even simple GET endpoints that fetch metadata from an upstream server (like Immich) must be protected with rate limiting to prevent downstream DoS and resource exhaustion, especially when they perform backend API requests per hit.
**Prevention:** Always implement rate limiting on endpoints that proxy requests or query a backend API, utilizing the shared `checkRateLimit` utility.

## 2024-03-20 - [DoS via Upstream Healthcheck Abuse]
**Vulnerability:** The `/api/health` endpoint lacked downstream protection and made a live upstream request to the Immich server (`immich.ping()`) on every hit. An attacker could exhaust backend resources by spamming the health check endpoint.
**Learning:** Returning HTTP 429 (rate limiting) on a health check endpoint is an architectural anti-pattern that breaks load balancers and container orchestrators (causing self-inflicted downtime).
**Prevention:** To secure health checks that rely on upstream resources without breaking infrastructure polling, implement a short-lived in-memory cache (e.g., 10 seconds) for the upstream response rather than blocking the request entirely.

## 2024-03-25 - [Missing Rate Limiting on Dynamic OG Image Generation]
**Vulnerability:** The `/api/og` endpoint lacked rate limiting, making it vulnerable to DoS attacks. An attacker could rapidly request computationally expensive image generation, exhausting server CPU and memory resources.
**Learning:** Endpoints that dynamically generate images (like Next.js `next/og` ImageResponse) are computationally intensive and must be protected with rate limiting to prevent resource exhaustion, even if they don't query a backend API.
**Prevention:** Always implement rate limiting on dynamic resource generation endpoints, utilizing the shared `checkRateLimit` utility.
