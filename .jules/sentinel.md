## 2025-05-18 - crypto.timingSafeEqual DoS
**Vulnerability:** crypto.timingSafeEqual can crash the app (DoS) if provided unequal length buffers and variable unconstrained length inputs can cause memory exhaustion.
**Learning:** Node.js crypto.timingSafeEqual throws when lengths differ, and creating buffers sized to input can blow memory.
**Prevention:** Enforce input length limits first and hash strings to fixed lengths before comparing.
