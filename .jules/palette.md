
## 2024-05-15 - Add accessible announcements to dynamic pagination counters
**Learning:** Numeric state changes (like '1 / 5') in dynamic carousels or lightboxes aren't meaningfully announced to screen readers during navigation, leading to a loss of context.
**Action:** Wrap dynamic counters in `aria-live="polite"` and `aria-atomic="true"`, providing a visually hidden, context-rich string (e.g., "Photo 1 of 5") while hiding the raw numbers (`aria-hidden="true"`) to prevent disjointed reading.
