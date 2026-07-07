## 2024-07-07 - Deep cloning large settings states
**Learning:** `JSON.parse(JSON.stringify())` performs string serialization that consumes CPU cycles and increases memory overhead, particularly noticeable on frequently updated or deeply nested settings states in React.
**Action:** Use native `structuredClone()` to perform deep copies natively in JavaScript for better performance, but ensure it is correctly cast if dynamic property assignment is required since it preserves strict typing.
