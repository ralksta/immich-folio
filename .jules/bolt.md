## YYYY-MM-DD - [Memoize grid item re-rendering]

**Learning:** `useMemo` can significantly boost the performance of long list or grid components (like `PhotoGrid` component) that otherwise gets re-rendered on simple interactions like navigating the image lightbox. Running standard formatting `pnpm format` applies huge changes across entire directories, so it's generally best to format and clean up ONLY modified files to avoid huge diff pollution in code review.
**Action:** Be extremely cautious of running format/lint commands at the root codebase; specify only modified directories or files, or avoid formatting if it cascades globally. Focus on targeted memoization where state changes dictate expensive array mapping operations.

## 2024-03-16 - [Optimize base64 decoding for ThumbHash]
**Learning:** Decoding base64 to Uint8Array via `Buffer.from(base64, 'base64')` in Node.js environments is significantly faster (~5-6x) than the `Uint8Array.from(atob(base64), ...)` approach. This is particularly relevant for server components (like Next.js) generating data URIs or decoding data in large quantities, such as iterating over many thumbnails.
**Action:** When performing base64 to Uint8Array decoding in an isomorphic codebase, check for `typeof Buffer !== 'undefined'` and utilize native `Buffer` when available to dramatically speed up server-side operations, falling back to the generic `atob` implementation on the client side.
