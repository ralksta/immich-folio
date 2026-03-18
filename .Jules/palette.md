## 2024-03-XX - Lightbox Accessibility

**Learning:** Found that Lightbox overlay has good keyboard navigation (esc/left/right) but lacked tooltip hints for those controls and lacked a shortcut for EXIF data toggle.
**Action:** Added `i` shortcut and `title` attributes on interactive elements in Lightbox.
## 2025-03-18 - Missing label for password input in PasswordGate
**Learning:** React component styles implemented using CSS modules (`PasswordGate.module.css`) may require adding accessibility classes like `.srOnly` locally if a global `.srOnly` class is not present in `globals.css`. Relying solely on placeholders for input labels negatively impacts screen reader accessibility.
**Action:** When adding accessible labels (`<label htmlFor="...">`) to forms, verify if `.srOnly` exists globally. If not, add it to the component's CSS module to visually hide the text while remaining accessible to assistive tech.
