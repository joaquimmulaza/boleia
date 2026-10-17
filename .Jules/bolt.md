## 2026-10-17 - [Intl Performance in React]
**Learning:** Instantiating new `Intl.DateTimeFormat` instances inside React renders (or frequently called utility functions) is a common performance pitfall, as these objects are expensive to create and run on every render/invocation. The automated code reviewer might also flag variables as undefined if they are outside the diff block, which requires reading the full file context to verify.
**Action:** Always extract `Intl.*` instantiations to module-scoped constants outside components or frequently called functions to cache them globally.
