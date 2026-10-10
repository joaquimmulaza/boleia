## 2023-10-25 - [Debouncing API Calls in Inputs]
**Learning:** Adding large utility packages like `lodash.debounce` can lead to dependency resolution conflicts in modern build setups with pnpm/vite, and is often overkill for simple debouncing.
**Action:** Use native React primitives (`useRef` + `setTimeout` + `useEffect` cleanup) for simple debounce requirements to avoid unnecessary dependency bloat and installation issues.

## 2026-10-10 - [Intl Caching via .toLocaleDateString() vs .format()]
**Learning:** In JavaScript, calling `Date.prototype.toLocaleDateString()` or `Number.prototype.toLocaleString()` with locale and option arguments inside a frequently called function acts as a hidden performance bottleneck, because it implicitly instantiates a new `Intl.DateTimeFormat` or `Intl.NumberFormat` object every single time.
**Action:** When formatting dates or numbers in render loops or frequent utility calls, globally cache an `Intl.DateTimeFormat` or `Intl.NumberFormat` instance outside the function and use its `.format()` method instead.
