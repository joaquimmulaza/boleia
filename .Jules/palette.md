## 2024-05-18 - Missing focus states on inner components
**Learning:** Secondary or list-item icon buttons (like the delete notification button) often lack the correct focus rings compared to primary UI actions. Even if they exist within interactive lists, they must maintain independent, standard focus states for keyboard accessibility.
**Action:** Always check deeply nested interactive elements within lists/menus to ensure they implement the standard Tailwind focus ring classes (`focus-visible:ring-2 focus-visible:ring-primary`).
