## 2024-05-24 - [Thumbhash base64 Decoding Caching]
**Learning:** Decoding base64 strings to bytes and generating blur data URLs/hex colors via the `thumbhash` library runs repeatedly for the same images and impacts rendering times.
**Action:** Utilize a simple bounded LRU-style Map cache keyed on the base64 string for operations like `thumbHashToBlurDataUrl` and `thumbHashToDominantHex`. Ensure format scripts only target modified files to avoid polluting git history.
