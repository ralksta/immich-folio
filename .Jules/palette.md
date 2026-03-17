## 2024-03-XX - Lightbox Accessibility

**Learning:** Found that Lightbox overlay has good keyboard navigation (esc/left/right) but lacked tooltip hints for those controls and lacked a shortcut for EXIF data toggle.
**Action:** Added `i` shortcut and `title` attributes on interactive elements in Lightbox.

## 2024-05-15 - Form Input Accessibility
**Learning:** Found that password inputs relying solely on placeholders without an explicit `<label>` cause accessibility issues for screen readers.
**Action:** Always associate inputs with a visually hidden `<label>` element using `htmlFor` and an `id` attribute on the input, and use a `.srOnly` CSS class to hide the label visually.
