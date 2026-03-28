## 2024-03-28 - Initial focus management for modals
**Learning:** For modal dialogues and full-screen overlays (like lightboxes), it's crucial for accessibility to actively manage initial keyboard focus when the modal opens, so that screen readers and keyboard users do not have to tab through the underlying page.
**Action:** Always add a `useRef` to an appropriate interactive element inside the modal (like the Close button or the modal container itself) and call `.focus()` in a `useEffect` on mount.
