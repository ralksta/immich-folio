## 2024-05-24 - Lightbox ARIA Attributes
**Learning:** Adding `role="dialog"`, `aria-modal="true"`, and `aria-label` to custom modal/lightbox overlays ensures screen readers announce them properly instead of just falling back to reading inner content without context. Additionally, toggles that show/hide panels (like the EXIF info button) must use `aria-expanded` and link to the panel via `aria-controls` for proper screen reader communication.
**Action:** When building or modifying custom overlays or toggle buttons in the future, always verify that ARIA attributes are set correctly to match the visual behavior.

## 2024-05-25 - Hidden SVG Icons inside Interactive Elements
**Learning:** For accessibility, when using decorative `<svg>` icons within interactive elements like `<button>` or `<a>` that already have `aria-label`s or text, it is crucial to apply `aria-hidden="true"` to the SVG. Otherwise, screen readers may read out the raw vector node attributes or the SVG tag itself, causing noise and a confusing user experience.
**Action:** When adding or updating SVG icons within semantic buttons or links, consistently apply `aria-hidden="true"` to the SVG element to ensure screen readers ignore it.
