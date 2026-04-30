## 2024-05-24 - Lightbox ARIA Attributes
**Learning:** Adding `role="dialog"`, `aria-modal="true"`, and `aria-label` to custom modal/lightbox overlays ensures screen readers announce them properly instead of just falling back to reading inner content without context. Additionally, toggles that show/hide panels (like the EXIF info button) must use `aria-expanded` and link to the panel via `aria-controls` for proper screen reader communication.
**Action:** When building or modifying custom overlays or toggle buttons in the future, always verify that ARIA attributes are set correctly to match the visual behavior.

## 2024-05-25 - SVG Icon Accessibility
**Learning:** Adding `aria-hidden="true"` to decorative `<svg>` icons within interactive elements (like `<button>` or `<a>`) that already have an `aria-label` is crucial. Otherwise, screen readers may read the raw vector nodes or fall back to confusing announcements in addition to the label. Similarly, when adding text to visual spinners, use `role="alert"` and `aria-live="polite"` on the container while hiding the SVG graphic.
**Action:** When adding or modifying interactive elements with icon graphics, always ensure the graphic is explicitly hidden from screen readers using `aria-hidden="true"` if a text alternative (`aria-label`) is provided.

## 2024-05-26 - Interactive Card ARIA Labels
**Learning:** When building interactive card components that contain multiple pieces of text or badges (like titles and photo counts), screen readers may announce them in a fragmented or confusing way.
**Action:** Always apply a comprehensive `aria-label` to the parent link/container that encompasses all meaningful visual data (e.g., titles and item counts). Use `aria-hidden="true"` on redundant text or visual child elements, and set `alt=""` on decorative images to consolidate screen reader announcements into a single, accurate interaction point.

## 2024-06-12 - PhotoGrid ARIA Labels
**Learning:** Interactive grid elements (acting as buttons) that trigger a modal lightbox must use `aria-haspopup="dialog"` to properly communicate to screen readers that clicking them will open a dialog. In addition, when these grid items have supplementary text containers (like EXIF data) and a comprehensive aria-label on the parent container, the child elements should be marked with `aria-hidden="true"` to prevent redundant/fragmented reading by screen readers.
**Action:** When creating or updating interactive elements that open modals, always include `aria-haspopup="dialog"`. Ensure any internal supplementary text overlays are hidden from screen readers (`aria-hidden="true"`) if the parent element already provides an accurate `aria-label`.
