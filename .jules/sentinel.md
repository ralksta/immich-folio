## 2025-04-17 - Fix IP Spoofing in Rate Limiter
**Vulnerability:** Rate limiter IP extraction (`getClientIp` in `lib/rate-limit.ts`) relied entirely on user-controllable HTTP headers (`x-real-ip`, `x-forwarded-for`) before checking the framework-provided `request.ip`.
**Learning:** Malicious clients can easily spoof HTTP headers to bypass rate limits, which could lead to Denial of Service (DoS) or brute-force attacks on sensitive endpoints (like `/api/auth`).
**Prevention:** Always prioritize framework-provided or proxy-validated connection properties (like `request.ip` in Next.js) over user-supplied HTTP headers when determining client IP addresses.
