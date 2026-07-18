## 2024-05-24 - Shared IntersectionObserver
**Learning:** Creating O(n) intersection observers for grid items can lead to memory allocation and initialization overhead, negatively impacting performance on pages with many items.
**Action:** Use a shared global `IntersectionObserver` and a callback registry (e.g., using `WeakMap` or `Map`) to observe multiple elements efficiently.
