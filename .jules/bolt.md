## 2023-10-25 - [Debouncing API Calls in Inputs]
**Learning:** Adding large utility packages like `lodash.debounce` can lead to dependency resolution conflicts in modern build setups with pnpm/vite, and is often overkill for simple debouncing.
**Action:** Use native React primitives (`useRef` + `setTimeout` + `useEffect` cleanup) for simple debounce requirements to avoid unnecessary dependency bloat and installation issues.
