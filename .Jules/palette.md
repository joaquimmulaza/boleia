## 2024-05-18 - Missing focus states on inner components
**Learning:** Secondary or list-item icon buttons (like the delete notification button) often lack the correct focus rings compared to primary UI actions. Even if they exist within interactive lists, they must maintain independent, standard focus states for keyboard accessibility.
**Action:** Always check deeply nested interactive elements within lists/menus to ensure they implement the standard Tailwind focus ring classes (`focus-visible:ring-2 focus-visible:ring-primary`).
## 2024-05-20 - Icon Button Focus Rings
**Learning:** Icon buttons with `p-2` or similar padding need a `rounded-full` utility for the focus ring (`focus-visible:ring-2`) to conform to the circular shape. Otherwise, the ring defaults to a square and looks disconnected from the icon's intended shape. Also, prefer `focus-visible` over `focus` to prevent the ring from appearing on mouse click, which can be jarring.
**Action:** Always add `rounded-full` when applying `focus-visible` styles to icon-only toggle buttons in navigation/headers.
