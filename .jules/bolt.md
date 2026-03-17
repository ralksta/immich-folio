## YYYY-MM-DD - [Memoize grid item re-rendering]

**Learning:** `useMemo` can significantly boost the performance of long list or grid components (like `PhotoGrid` component) that otherwise gets re-rendered on simple interactions like navigating the image lightbox. Running standard formatting `pnpm format` applies huge changes across entire directories, so it's generally best to format and clean up ONLY modified files to avoid huge diff pollution in code review.
**Action:** Be extremely cautious of running format/lint commands at the root codebase; specify only modified directories or files, or avoid formatting if it cascades globally. Focus on targeted memoization where state changes dictate expensive array mapping operations.

## 2024-11-20 - Faster Base64 decoding in Node.js
**Learning:** `Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))` is surprisingly inefficient for Base64 decoding in Node.js environments (Next.js server components/API routes) because of the O(N) mapping operation in JS.
**Action:** Use `Buffer.from(base64, 'base64')` when `typeof Buffer !== 'undefined'` for a ~5-6x performance boost, while preserving the `atob` fallback for browsers and edge runtimes.
