## 2024-05-24 - Lightbox ARIA Attributes
**Learning:** Adding `role="dialog"`, `aria-modal="true"`, and `aria-label` to custom modal/lightbox overlays ensures screen readers announce them properly instead of just falling back to reading inner content without context. Additionally, toggles that show/hide panels (like the EXIF info button) must use `aria-expanded` and link to the panel via `aria-controls` for proper screen reader communication.
**Action:** When building or modifying custom overlays or toggle buttons in the future, always verify that ARIA attributes are set correctly to match the visual behavior.

## 2024-05-25 - SVG Icon Accessibility
**Learning:** Adding `aria-hidden="true"` to decorative `<svg>` icons within interactive elements (like `<button>` or `<a>`) that already have an `aria-label` is crucial. Otherwise, screen readers may read the raw vector nodes or fall back to confusing announcements in addition to the label. Similarly, when adding text to visual spinners, use `role="alert"` and `aria-live="polite"` on the container while hiding the SVG graphic.
**Action:** When adding or modifying interactive elements with icon graphics, always ensure the graphic is explicitly hidden from screen readers using `aria-hidden="true"` if a text alternative (`aria-label`) is provided.

## 2024-05-26 - Interactive Card ARIA Labels
**Learning:** When building interactive card components that contain multiple pieces of text or badges (like titles and photo counts), screen readers may announce them in a fragmented or confusing way.
**Action:** Always apply a comprehensive `aria-label` to the parent link/container that encompasses all meaningful visual data (e.g., titles and item counts). Use `aria-hidden="true"` on redundant text or visual child elements, and set `alt=""` on decorative images to consolidate screen reader announcements into a single, accurate interaction point.

## 2024-05-27 - Screen Reader Navigation Counters
**Learning:** Numeric counters (like '1 / 5') in navigation components such as lightboxes are often not announced correctly or lack context for screen readers. Using `aria-live="polite"` and `aria-atomic="true"` on the counter wrapper, along with a visually hidden context-rich text (e.g., 'Photo 1 of 5'), ensures correct and meaningful announcements when navigating.
**Action:** When building pagination or slider counters, always wrap them in an `aria-live` region, hide the visual numeric layout using `aria-hidden="true"`, and provide a visually hidden span with a descriptive text format.
