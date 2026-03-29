## 2024-05-24 - Lightbox ARIA Attributes
**Learning:** Adding `role="dialog"`, `aria-modal="true"`, and `aria-label` to custom modal/lightbox overlays ensures screen readers announce them properly instead of just falling back to reading inner content without context. Additionally, toggles that show/hide panels (like the EXIF info button) must use `aria-expanded` and link to the panel via `aria-controls` for proper screen reader communication.
**Action:** When building or modifying custom overlays or toggle buttons in the future, always verify that ARIA attributes are set correctly to match the visual behavior.

## 2024-05-25 - SVG decorative accessibility
**Learning:** Screen readers may read the raw SVG DOM nodes in some interactive components (like `<button>`s with icon content), even if an `aria-label` is present.
**Action:** Always add `aria-hidden="true"` to `<svg>` icons used for visual decoration inside interactive elements to force screen readers to ignore the vector nodes and rely strictly on the semantic labels.
