## YYYY-MM-DD - [Memoize grid item re-rendering]

**Learning:** `useMemo` can significantly boost the performance of long list or grid components (like `PhotoGrid` component) that otherwise gets re-rendered on simple interactions like navigating the image lightbox. Running standard formatting `pnpm format` applies huge changes across entire directories, so it's generally best to format and clean up ONLY modified files to avoid huge diff pollution in code review.
**Action:** Be extremely cautious of running format/lint commands at the root codebase; specify only modified directories or files, or avoid formatting if it cascades globally. Focus on targeted memoization where state changes dictate expensive array mapping operations.

## 2024-05-19 - [Fast base64 decoding for Isomorphic environments]

**Learning:** `Uint8Array.from(atob(base64), ...)` is extremely slow in Node.js server environments compared to native implementations. Node.js `Buffer.from(base64, 'base64')` is ~5-6x faster for base64 decoding, but `Buffer` isn't available in standard browser client/Edge environments.
**Action:** When working in Next.js or isomorphic apps where you decode base64 strings frequently (e.g. thumbhash operations), use an isomorphic wrapper that checks `typeof Buffer !== 'undefined'` to conditionally use `Buffer.from()` on the server side, while falling back to `atob` on the client side.
