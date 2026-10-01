## 2024-05-18 - Missing focus states on inner components
**Learning:** Secondary or list-item icon buttons (like the delete notification button) often lack the correct focus rings compared to primary UI actions. Even if they exist within interactive lists, they must maintain independent, standard focus states for keyboard accessibility.
**Action:** Always check deeply nested interactive elements within lists/menus to ensure they implement the standard Tailwind focus ring classes (`focus-visible:ring-2 focus-visible:ring-primary`).
## 2024-05-24 - Missing keyboard focus states in navigation headers
**Learning:** Header navigation elements (like back and action buttons) often lack explicit focus states because they are plain icons or text links, making keyboard navigation difficult to track.
**Action:** Apply the standard focus state (`focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900`) and ensure a border radius (`rounded-md` or `rounded-full`) is present so the ring shapes correctly.
