1. **Add rate limiting to the OG image generator endpoint.**
   - The `app/api/og/route.tsx` endpoint dynamically generates images using `next/og`, which is resource-intensive and could be exploited for DoS attacks without rate limiting.
   - We will implement the shared `checkRateLimit` utility from `@/lib/rate-limit`.
   - We will extract the client IP using `getClientIp` and enforce the configured rate limit (`config.rateLimitRpm`).
2. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
