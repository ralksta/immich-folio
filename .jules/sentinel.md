## 2024-05-18 - Fix DoS vulnerabilities in timingSafeEqual comparisons
**Vulnerability:** \`crypto.timingSafeEqual\` throws an exception (crashing the process) if the buffer lengths are different, and unrestricted password input length allowed excessive buffer allocations (\`Buffer.alloc(hugeLength)\`).
**Learning:** Always verify that lengths match before using \`crypto.timingSafeEqual\`, and always set reasonable length limits on inputs before processing them. Also hash string inputs of arbitrary length to a fixed length before constant-time comparison to avoid leaking the true length.
**Prevention:** Enforce input length limits immediately and compare lengths before invoking \`crypto.timingSafeEqual\`, or hash inputs to a fixed length before comparison.
