## 2024-05-17 - Promise Deduplication
**Learning:** For parameterized dynamic endpoints like getting individual asset infos (`getAssetInfo`), identical requests generated rapidly (e.g. displaying multiple thumbnails or grid views) can result in redundant downstream API calls before the cache has a chance to populate.
**Action:** Use a `Map` to track pending Promises based on the input key (like `assetId`), so identical concurrent requests will coalesce into a single downstream request. Always clear the `Map` in a `finally` block to prevent stale or hanging Promises.
