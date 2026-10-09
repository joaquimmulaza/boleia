## 2024-05-18 - Missing focus states on inner components
**Learning:** Secondary or list-item icon buttons (like the delete notification button) often lack the correct focus rings compared to primary UI actions. Even if they exist within interactive lists, they must maintain independent, standard focus states for keyboard accessibility.
**Action:** Always check deeply nested interactive elements within lists/menus to ensure they implement the standard Tailwind focus ring classes (`focus-visible:ring-2 focus-visible:ring-primary`).
## 2024-05-24 - Missing keyboard focus states in navigation headers
**Learning:** Header navigation elements (like back and action buttons) often lack explicit focus states because they are plain icons or text links, making keyboard navigation difficult to track.
**Action:** Apply the standard focus state (`focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900`) and ensure a border radius (`rounded-md` or `rounded-full`) is present so the ring shapes correctly.
## 2024-05-18 - Missing interactive role for custom interactive elements
**Learning:** Using `tabIndex={0}` and `onKeyDown` allows users to navigate list items via keyboard, but screen readers may not announce them as actionable elements without a proper semantic role (e.g., `role="button"` or `role="link"`).
**Action:** Always complement `tabIndex={0}` with appropriate ARIA roles on non-semantic interactive elements.
## 2024-10-09 - Missing focus states on sheet/modal custom buttons
**Learning:** Interactive components like bottom sheets and modals often use plain `<button>` elements instead of standard `<Button />` components for bespoke layouts. These bespoke buttons frequently miss out on hover and focus-visible styles, negatively impacting accessibility and visual feedback.
**Action:** When working on modals and sheets, verify that all plain `<button>` elements implement standard focus rings (`focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900`) and appropriate hover styles.
