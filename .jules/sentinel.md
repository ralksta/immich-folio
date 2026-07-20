## 2024-07-20 - Missing rate limiting on admin authentication
**Vulnerability:** The admin authentication endpoint (`app/api/admin/auth/route.ts`) lacked rate limiting, leaving it vulnerable to brute force attacks.
**Learning:** Even though admin functions might be "internal" or hidden behind an environment variable, all authentication endpoints require brute force protection.
**Prevention:** Always apply `checkRateLimit` to auth endpoints to prevent attackers from brute forcing passwords.
