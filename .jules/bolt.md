## 2024-05-10 - Singleton IntersectionObserver Pattern
**Learning:** Creating O(n) IntersectionObserver instances (one per element) in large lists or masonry photo grids causes significant memory and initialization overhead.
**Action:** Implement a singleton shared IntersectionObserver pattern with a WeakMap to register per-element callbacks, rather than instantiating a new observer for every component.
