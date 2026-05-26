## YYYY-MM-DD - [Memoize grid item re-rendering]

**Learning:** `useMemo` can significantly boost the performance of long list or grid components (like `PhotoGrid` component) that otherwise gets re-rendered on simple interactions like navigating the image lightbox. Running standard formatting `pnpm format` applies huge changes across entire directories, so it's generally best to format and clean up ONLY modified files to avoid huge diff pollution in code review.
**Action:** Be extremely cautious of running format/lint commands at the root codebase; specify only modified directories or files, or avoid formatting if it cascades globally. Focus on targeted memoization where state changes dictate expensive array mapping operations.

## 2024-05-28 - [Deduplicate concurrent API requests via Promise caching]

**Learning:** When using `Promise.all` to fetch dependent data in parallel (e.g., getting multiple subpages and standalone albums that internally call a shared `getAlbums` function), the internal cache might not be populated in time. This leads to redundant concurrent network requests to the upstream server.
**Action:** Implement Promise deduplication (request coalescing) by caching the pending Promise itself (e.g., in a `this.pendingPromise` class field) rather than just the final result. Return the pending Promise to subsequent callers until it resolves, ensuring only one network request is made.
## 2024-05-29 - [Buffer inheritance optimization]

**Learning:** `Buffer` inherits from `Uint8Array` in Node.js. Passing a `Buffer` into `new Uint8Array(...)` creates a completely new `ArrayBuffer` and copies all elements, which is an O(N) memory allocation and copy.
**Action:** When decoding base64 strings or similar byte streams in Node.js where a `Uint8Array` is expected, return `Buffer.from(data, 'base64')` directly instead of wrapping it.
## 2026-04-24 - [OOM prevention through promise chunking]
**Learning:** When fetching unbounded large collections (like photo albums and their assets), using concurrent `Promise.all` over the entire array can cause Node.js Out of Memory (OOM) crashes.
**Action:** Instead of `Promise.all(array.map(...))`, use a chunked data fetching approach (e.g., `Promise.all` within a `for` loop processing chunks of e.g. 10 items) to balance memory constraints with concurrent network speed.

## 2024-05-30 - [O(1) Memory Bucketing for Coordinate Aggregation]
**Learning:** When bucketing or grouping large datasets (e.g., thousands of map coordinates into geographical clusters), array allocations (`[].push()`) followed by `reduce` operations create an O(N) memory overhead per bucket and expensive post-processing loops.
**Action:** Replace memory-heavy array collections with running statistical accumulators (e.g., `latSum`, `lngSum`, `count`) directly on the bucket. This reduces bucket memory from O(N) to O(1).

## 2024-05-26 - Memoize Authentication Checks in Data Processing Loops
**Learning:** The `isAuthenticated` function involves computing an HMAC-SHA256 token and performing a `timingSafeEqual` comparison. Calling this repeatedly inside `.map()` or `.filter()` loops on large collections with duplicate contexts (like `subpageSlug`) creates a significant CPU bottleneck.
**Action:** Use request-scoped memoization (e.g., a `Map`) when iterating over collections that require authorization checks on repeated parent scopes to avoid redundant expensive cryptography and config lookups.
