
## 2026-03-24 - Persisting Realtime Notifications
**Vulnerability:** Realtime WebSockets are ephemeral. If a user receives a notification when the app is closed or backgrounded, it is lost forever. This is a severe UX issue for core events (like ride acceptance).
**Learning:** For critical transactional events, Realtime must be paired with a persistent data layer (e.g., a `notifications` table).
**Prevention:** Implement an architectural pattern where the backend (via triggers or explicit inserts) persists the event to a database table. The frontend should fetch unread notifications on mount and subscribe to the table changes via Realtime, ensuring no events are dropped.
## 2023-10-27 - Auth Guard Bypass via user_metadata
**Vulnerability:** The application relied on `supabase.auth.getSession()` and the client-editable `user_metadata.tipo_perfil` for role-based access control (RBAC) in `ProtectedRoute.jsx`. This allowed users to artificially escalate privileges or impersonate roles by modifying their own session/metadata.
**Learning:** `user_metadata` is insecure for RBAC because it's editable by the user using `supabase.auth.updateUser()`. Also, `getSession()` trusts the local storage session, which can be manipulated.
**Prevention:** Always use `supabase.auth.getUser()` to securely fetch and validate the user from the server in critical auth guards. For RBAC, fetch the user's role from a secure database table (e.g., `perfis`) or use secure `app_metadata` managed exclusively by the backend/triggers.
