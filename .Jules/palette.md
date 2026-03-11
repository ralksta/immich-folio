# Palette Journal

## 2024-05-18 - Invisible interactive elements and keyboard focus
**Learning:** Using `opacity: 0` and `pointer-events: none` on interactive elements like buttons visually hides them but DOES NOT remove them from the keyboard tab order. This creates confusing "invisible" focus states for keyboard users.
**Action:** When animating elements in and out of view without conditionally rendering them, always ensure to update their focusability with `tabIndex={-1}` and screen reader visibility with `aria-hidden="true"` when they are visually hidden.
