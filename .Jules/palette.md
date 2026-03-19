## 2024-03-XX - Lightbox Accessibility

**Learning:** Found that Lightbox overlay has good keyboard navigation (esc/left/right) but lacked tooltip hints for those controls and lacked a shortcut for EXIF data toggle.
**Action:** Added `i` shortcut and `title` attributes on interactive elements in Lightbox.

## 2024-05-15 - PasswordGate form accessibility

**Learning:** Form inputs lacking explicit labels and relying solely on placeholders fail accessibility standards, as screen readers may ignore them. Utilizing a visually hidden (`.srOnly`) `<label>` tied to the `<input>` via `id` resolves this issue while maintaining the intended visual design.
**Action:** Always include associated labels for form inputs. When visual labels are omitted by design, apply a `.srOnly` class to a `<label>` element connected to the input via `htmlFor` and `id`.
