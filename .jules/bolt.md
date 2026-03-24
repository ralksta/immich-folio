## 2026-03-24 - [Rate limit CPU-intensive endpoints]

**Learning:** Dynamic API endpoints that perform resource-intensive tasks on the fly, such as Next.js `next/og` ImageResponse generation, must implement rate-limiting using the shared `checkRateLimit` utility to protect server stability and prevent CPU exhaustion, even if they do not explicitly query upstream backend APIs.
**Action:** Always identify CPU-heavy dynamic routes (like image generation or PDF rendering) during performance reviews, and wrap them with the application's rate limiter. Ensure rate limit checks happen early in the request lifecycle and return appropriate 429 status codes.

## YYYY-MM-DD - [Memoize grid item re-rendering]

**Learning:** `useMemo` can significantly boost the performance of long list or grid components (like `PhotoGrid` component) that otherwise gets re-rendered on simple interactions like navigating the image lightbox. Running standard formatting `pnpm format` applies huge changes across entire directories, so it's generally best to format and clean up ONLY modified files to avoid huge diff pollution in code review.
**Action:** Be extremely cautious of running format/lint commands at the root codebase; specify only modified directories or files, or avoid formatting if it cascades globally. Focus on targeted memoization where state changes dictate expensive array mapping operations.
