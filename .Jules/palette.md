## 2024-05-24 - Lightbox ARIA Attributes
**Learning:** Adding `role="dialog"`, `aria-modal="true"`, and `aria-label` to custom modal/lightbox overlays ensures screen readers announce them properly instead of just falling back to reading inner content without context. Additionally, toggles that show/hide panels (like the EXIF info button) must use `aria-expanded` and link to the panel via `aria-controls` for proper screen reader communication.
**Action:** When building or modifying custom overlays or toggle buttons in the future, always verify that ARIA attributes are set correctly to match the visual behavior.

## 2024-05-25 - SVG Icon Accessibility
**Learning:** Adding `aria-hidden="true"` to decorative `<svg>` icons within interactive elements (like `<button>` or `<a>`) that already have an `aria-label` is crucial. Otherwise, screen readers may read the raw vector nodes or fall back to confusing announcements in addition to the label. Similarly, when adding text to visual spinners, use `role="alert"` and `aria-live="polite"` on the container while hiding the SVG graphic.
**Action:** When adding or modifying interactive elements with icon graphics, always ensure the graphic is explicitly hidden from screen readers using `aria-hidden="true"` if a text alternative (`aria-label`) is provided.

## $(date +%Y-%m-%d) - Custom Button Focus Outline
**Learning:** Custom interactive elements semantically marked as buttons (e.g., `<div role="button" tabIndex={0}>`) do not automatically inherit the native focus-visible styles applied to actual `<button>` elements in global CSS resets. This can lead to custom buttons failing accessibility audits for lack of visible focus indicators.
**Action:** When creating custom buttons using `role="button"` on non-button HTML elements, ensure that global CSS rules target `[role="button"]:focus-visible` in addition to `button:focus-visible` to maintain consistent keyboard accessibility styling.
