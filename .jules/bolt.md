## 2024-09-10 - Intl.NumberFormat optimization
**Learning:** Instantiating `Intl.NumberFormat` on every invocation (e.g., via `Number.prototype.toLocaleString`) can be a silent performance bottleneck when rendering lists of formatted prices in React.
**Action:** When creating formatting utilities for currency or dates, cache the `Intl` instance globally in the module to avoid the high instantiation cost on every render cycle.

## 2024-09-10 - Audit Tests check Source Code Text
**Learning:** `MarketplaceAuditScenarios.test.jsx` tests for specific hardcoded strings inside source files by reading them as text directly (e.g., `readSrc(...)`).
**Action:** Be extremely cautious when refactoring or renaming variables/text in files that are audited this way, as it can break tests that depend on exact regex matches of the source code text.
