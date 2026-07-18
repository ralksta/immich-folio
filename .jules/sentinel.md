## 2024-07-18 - Missing Rate Limiting on Admin Auth
**Vulnerability:** Admin authentication endpoint lacked rate limiting, allowing brute-force and dictionary attacks on the admin password.
**Learning:** Administrative endpoints are high-value targets and require identical or stricter brute-force protections compared to standard user endpoints.
**Prevention:** Always implement rate limiting (`checkRateLimit`) on any route that processes authentication, especially `/api/admin/auth`.
