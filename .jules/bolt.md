## YYYY-MM-DD - [Memoize grid item re-rendering]

**Learning:** `useMemo` can significantly boost the performance of long list or grid components (like `PhotoGrid` component) that otherwise gets re-rendered on simple interactions like navigating the image lightbox. Running standard formatting `pnpm format` applies huge changes across entire directories, so it's generally best to format and clean up ONLY modified files to avoid huge diff pollution in code review.
**Action:** Be extremely cautious of running format/lint commands at the root codebase; specify only modified directories or files, or avoid formatting if it cascades globally. Focus on targeted memoization where state changes dictate expensive array mapping operations.

## 2024-05-28 - [Deduplicate concurrent API requests via Promise caching]

**Learning:** When using `Promise.all` to fetch dependent data in parallel (e.g., getting multiple subpages and standalone albums that internally call a shared `getAlbums` function), the internal cache might not be populated in time. This leads to redundant concurrent network requests to the upstream server.
**Action:** Implement Promise deduplication (request coalescing) by caching the pending Promise itself (e.g., in a `this.pendingPromise` class field) rather than just the final result. Return the pending Promise to subsequent callers until it resolves, ensuring only one network request is made.

## 2024-05-29 - [Avoid unnecessary Uint8Array wrapping around Buffer]

**Learning:** For optimal performance in Node.js server environments, use `Buffer.from(..., 'base64')` rather than `Uint8Array.from(atob(...))` to decode base64 strings. Because `Buffer` inherits from `Uint8Array`, returning the `Buffer` instance directly instead of wrapping it in `new Uint8Array(...)` prevents unnecessary memory allocation and copying.
**Action:** Avoid wrapping `Buffer` instances in `new Uint8Array(...)` when returning binary data in isomorphic codebases.
