## YYYY-MM-DD - [Memoize grid item re-rendering]

**Learning:** `useMemo` can significantly boost the performance of long list or grid components (like `PhotoGrid` component) that otherwise gets re-rendered on simple interactions like navigating the image lightbox. Running standard formatting `pnpm format` applies huge changes across entire directories, so it's generally best to format and clean up ONLY modified files to avoid huge diff pollution in code review.
**Action:** Be extremely cautious of running format/lint commands at the root codebase; specify only modified directories or files, or avoid formatting if it cascades globally. Focus on targeted memoization where state changes dictate expensive array mapping operations.

## 2024-03-14 - [Next.js Isomorphic Base64 Decoding Performance]
**Learning:** In Next.js isomorphic environments (like server components and API routes), base64 decoding via `atob` combined with character iteration (e.g., `Uint8Array.from(atob(base64), c => c.charCodeAt(0))`) is a significant performance bottleneck. Native Node.js `Buffer.from(..., 'base64')` is much faster.
**Action:** When working in isomorphic code that runs on both the server and client, use a runtime check (`typeof Buffer !== 'undefined'`) to utilize `Buffer.from` on the server while falling back to `atob` for browser/edge environments to optimize performance without breaking compatibility.
