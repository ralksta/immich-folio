
## 2024-07-10 - Accessible Text-Based Icon Buttons
**Learning:** Screen readers will attempt to read out pure text characters like '×' or '↑' inside buttons, which can sound confusing ("times" or "upward arrow") instead of the button's actual function. Even with an `aria-label` on the parent `<button>`, screen readers can exhibit inconsistent behavior if the text node isn't explicitly hidden.
**Action:** When using simple text characters as icons in buttons, always wrap the visual text character in `<span aria-hidden="true">` and add a clear `aria-label` to the parent `<button>`.
