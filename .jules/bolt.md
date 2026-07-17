## 2024-07-17 - Deep Cloning Optimization
**Learning:** `JSON.parse(JSON.stringify())` was used for deep cloning settings objects during state updates and saves in `SettingsEditor.tsx`.
**Action:** Replaced with native `structuredClone()` which avoids string serialization overhead and supports a wider range of types, casting it as `any` where needed to allow arbitrary nested assignments required by the generic updates logic.
