## 2024-05-24 - Accessible Text-Based Icon Buttons
**Learning:** Using raw text characters like '×' or '✕' for icon buttons without `aria-label` or `aria-hidden` attributes causes screen readers to read the literal character (e.g., "multiplication sign"), leading to a confusing user experience.
**Action:** Always wrap visual text characters used as icons in `<span aria-hidden="true">` and provide a descriptive `aria-label` on the parent `<button>` to ensure correct screen reader announcements.
