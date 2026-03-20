## YYYY-MM-DD - [Memoize grid item re-rendering]

**Learning:** `useMemo` can significantly boost the performance of long list or grid components (like `PhotoGrid` component) that otherwise gets re-rendered on simple interactions like navigating the image lightbox. Running standard formatting `pnpm format` applies huge changes across entire directories, so it's generally best to format and clean up ONLY modified files to avoid huge diff pollution in code review.
**Action:** Be extremely cautious of running format/lint commands at the root codebase; specify only modified directories or files, or avoid formatting if it cascades globally. Focus on targeted memoization where state changes dictate expensive array mapping operations.

## 2024-03-20 - [Base64 Decoding Optimization]
**Learning:** `Buffer.from(..., 'base64')` is significantly (~15x) faster than `Uint8Array.from(atob(...))` for base64 decoding on the server side.
**Action:** Use `typeof Buffer !== 'undefined' ? Buffer.from(..., 'base64') : Uint8Array.from(atob(...), ...)` in isomorphic code to guarantee optimal speed in Node.js while retaining browser/Edge compatibility.
