## YYYY-MM-DD - [Memoize grid item re-rendering]

**Learning:** `useMemo` can significantly boost the performance of long list or grid components (like `PhotoGrid` component) that otherwise gets re-rendered on simple interactions like navigating the image lightbox. Running standard formatting `pnpm format` applies huge changes across entire directories, so it's generally best to format and clean up ONLY modified files to avoid huge diff pollution in code review.
**Action:** Be extremely cautious of running format/lint commands at the root codebase; specify only modified directories or files, or avoid formatting if it cascades globally. Focus on targeted memoization where state changes dictate expensive array mapping operations.

## 2024-03-14 - Faster Base64 decoding in Node.js
**Learning:** `atob()` combined with `Uint8Array.from()` in Node.js is significantly slower (~9x in this codebase) than natively using `Buffer.from(base64, 'base64')`. The thumbhash decoding map cache limits operations, but optimizing the base decoding function speeds up operations on initial grid load.
**Action:** Always favor `Buffer.from(..., 'base64')` for decoding base64 strings in Next.js Server Components and backend Node environments, rather than the browser-native `atob()` approach. Ensure this code won't run on the Edge runtime or browser.
