## 2024-05-18 - Unprotected Dynamic Image Generation Endpoints

**Vulnerability:** The `/api/og` route generates an `ImageResponse` dynamically using `next/og`. Because this operation is computationally expensive and memory-intensive, unauthenticated endpoints lacking rate limiting act as prominent Denial of Service (DoS) vectors. Attackers can flood the endpoint with varying parameters, forcing the server to continually spawn compute-heavy tasks until resources are exhausted and the instance crashes or latency spikes to unacceptable levels.

**Learning:** Next.js dynamic endpoints that do not hit external upstream APIs or databases (like image generation with `next/og`) are often overlooked for rate limiting. Rate limiting is just as critical for protecting local compute resources as it is for protecting downstream API quotas or databases. Any route performing on-the-fly heavy processing must implement throttling.

**Prevention:** Apply the shared `checkRateLimit` utility (from `@/lib/rate-limit`) to all computationally expensive endpoints (such as `next/og` usage), even if they do not explicitly query external services. Ensure `getConfig().rateLimitRpm` is passed as the threshold to maintain configurable global protection.
## 2024-05-20 - Missing Rate-Limiting Standard Headers
**Vulnerability:** API endpoints (e.g., auth, map, image proxy) returned generic `429 Too Many Requests` status codes but omitted standard retry-after and limit disclosure headers.
**Learning:** Returning 429 without `Retry-After` impairs legitimate clients and orchestration systems from backing off appropriately, which can lead to continued overwhelming of the endpoints during high-load/DoS conditions.
**Prevention:** Always implement standard rate-limiting headers (`Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`) when returning 429s. Calculate `Retry-After` dynamically based on the remaining sliding window (e.g., `Math.ceil((resetAt - Date.now()) / 1000)`).
