## YYYY-MM-DD - [Memoize grid item re-rendering]

**Learning:** `useMemo` can significantly boost the performance of long list or grid components (like `PhotoGrid` component) that otherwise gets re-rendered on simple interactions like navigating the image lightbox. Running standard formatting `pnpm format` applies huge changes across entire directories, so it's generally best to format and clean up ONLY modified files to avoid huge diff pollution in code review.
**Action:** Be extremely cautious of running format/lint commands at the root codebase; specify only modified directories or files, or avoid formatting if it cascades globally. Focus on targeted memoization where state changes dictate expensive array mapping operations.

## 2024-05-28 - [Deduplicate concurrent API requests via Promise caching]

**Learning:** When using `Promise.all` to fetch dependent data in parallel (e.g., getting multiple subpages and standalone albums that internally call a shared `getAlbums` function), the internal cache might not be populated in time. This leads to redundant concurrent network requests to the upstream server.
**Action:** Implement Promise deduplication (request coalescing) by caching the pending Promise itself (e.g., in a `this.pendingPromise` class field) rather than just the final result. Return the pending Promise to subsequent callers until it resolves, ensuring only one network request is made.
## 2024-05-29 - [Buffer inheritance optimization]

**Learning:** `Buffer` inherits from `Uint8Array` in Node.js. Passing a `Buffer` into `new Uint8Array(...)` creates a completely new `ArrayBuffer` and copies all elements, which is an O(N) memory allocation and copy.
**Action:** When decoding base64 strings or similar byte streams in Node.js where a `Uint8Array` is expected, return `Buffer.from(data, 'base64')` directly instead of wrapping it.
## 2024-05-30 - [Chunked Promise.all for unbounded network requests]

**Learning:** When fetching an unbounded or potentially large collection of items (like a list of photo albums) using a network API, mapping over the array with a single `Promise.all` can result in hundreds or thousands of simultaneous network requests. This can overwhelm the Node.js event loop, trigger downstream rate limiting or DoS protection, and cause Out of Memory (OOM) crashes as all response payloads are accumulated simultaneously in memory.
**Action:** Replace single unbounded `Promise.all` calls with a `for` loop that slices the input array into chunks (e.g., 10 items per chunk). Call `Promise.all` on each chunk sequentially and push the results into an aggregator array. This balances concurrency (speed) with memory/network constraints.
