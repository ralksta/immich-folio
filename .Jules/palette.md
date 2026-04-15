## 2024-05-24 - Lightbox ARIA Attributes
**Learning:** Adding `role="dialog"`, `aria-modal="true"`, and `aria-label` to custom modal/lightbox overlays ensures screen readers announce them properly instead of just falling back to reading inner content without context. Additionally, toggles that show/hide panels (like the EXIF info button) must use `aria-expanded` and link to the panel via `aria-controls` for proper screen reader communication.
**Action:** When building or modifying custom overlays or toggle buttons in the future, always verify that ARIA attributes are set correctly to match the visual behavior.

## 2024-05-25 - SVG Icon Accessibility
**Learning:** Adding `aria-hidden="true"` to decorative `<svg>` icons within interactive elements (like `<button>` or `<a>`) that already have an `aria-label` is crucial. Otherwise, screen readers may read the raw vector nodes or fall back to confusing announcements in addition to the label. Similarly, when adding text to visual spinners, use `role="alert"` and `aria-live="polite"` on the container while hiding the SVG graphic.
**Action:** When adding or modifying interactive elements with icon graphics, always ensure the graphic is explicitly hidden from screen readers using `aria-hidden="true"` if a text alternative (`aria-label`) is provided.

## 2024-05-26 - Interactive Card Accessibility Consolidation
**Learning:** For interactive card components containing rich visual data (e.g., an album thumbnail, title, and item count), allowing screen readers to independently read the inner text nodes and image `alt` attributes results in redundant, disjointed, and confusing announcements.
**Action:** Consolidate the entire card's screen reader announcement by providing a comprehensive `aria-label` on the parent interactive element (e.g., the wrapper `<Link>`), using `aria-hidden="true"` on the redundant inner text elements, and setting `alt=""` on any decorative or contextual images inside the card to establish a single, coherent interaction point.
