## 2024-07-17 - Missing Rate Limiting on Admin Auth
**Vulnerability:** Admin authentication endpoint (`/api/admin/auth/route.ts`) lacked rate limiting.
**Learning:** Even with strong passwords (and constant-time comparison), endpoints verifying secrets are susceptible to brute-force and dictionary attacks without explicit rate limiting. The in-memory sliding-window rate limiter in `lib/rate-limit.ts` was available but unused here.
**Prevention:** Always enforce rate limiting (e.g., via `checkRateLimit` and `getClientIp`) on any endpoint handling authentication payloads.
