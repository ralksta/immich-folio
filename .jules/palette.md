## 2024-05-13 - Lightbox Image Counter Announcements
**Learning:** Screen readers do not announce numeric text changes like "1 / 5" by default when users navigate images in a custom modal or lightbox.
**Action:** Add `aria-live="polite"` and `aria-atomic="true"` with visually hidden, context-rich text (e.g., "Photo 1 of 5") to image counters to ensure seamless accessibility for keyboard/swipe navigation.
