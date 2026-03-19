## YYYY-MM-DD - [Memoize grid item re-rendering]

**Learning:** `useMemo` can significantly boost the performance of long list or grid components (like `PhotoGrid` component) that otherwise gets re-rendered on simple interactions like navigating the image lightbox. Running standard formatting `pnpm format` applies huge changes across entire directories, so it's generally best to format and clean up ONLY modified files to avoid huge diff pollution in code review.
**Action:** Be extremely cautious of running format/lint commands at the root codebase; specify only modified directories or files, or avoid formatting if it cascades globally. Focus on targeted memoization where state changes dictate expensive array mapping operations.

## 2024-11-20 - [Optimize Base64 decoding in isomorphic code]
**Learning:** Decoding Base64 strings using `Uint8Array.from(atob(...))` is standard for the browser but is ~10x slower in Node.js environments. Since thumbhash calculations happen primarily on the server (Next.js server components or API routes) rendering galleries, the lack of native `Buffer` usage was a major hidden bottleneck.
**Action:** When working in an isomorphic environment, safely wrap a `typeof Buffer !== 'undefined'` check to use `Buffer.from(base64, 'base64')` where available for significantly faster decoding, while falling back to `atob` for the browser/Edge runtimes.
