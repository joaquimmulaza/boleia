
## 2026-03-24 - Persisting Realtime Notifications
**Vulnerability:** Realtime WebSockets are ephemeral. If a user receives a notification when the app is closed or backgrounded, it is lost forever. This is a severe UX issue for core events (like ride acceptance).
**Learning:** For critical transactional events, Realtime must be paired with a persistent data layer (e.g., a `notifications` table).
**Prevention:** Implement an architectural pattern where the backend (via triggers or explicit inserts) persists the event to a database table. The frontend should fetch unread notifications on mount and subscribe to the table changes via Realtime, ensuring no events are dropped.

## 2026-03-24 - Edge Function Hardcoded Secrets
**Vulnerability:** Hardcoding VAPID keys directly in the Edge Function code.
**Learning:** Hardcoding API keys or secrets in source code is a major security risk as they can be exposed in version control.
**Prevention:** Always use environment variables (e.g., `Deno.env.get`) configured securely in Supabase Secrets for sensitive keys like VAPID keys.

## 2024-03-26 - [Sanitize mailto link parameters]
**Vulnerability:** HTTP Header Injection / Email Body Injection via `mailto:` links. Unsanitized user data (an agreement ID) was directly interpolated into `window.location.href = \`mailto:...?subject=...${id}\``.
**Learning:** Even internal or database-generated IDs can be vectors if their format changes or if they become user-controllable. `mailto:` links act as a form of external execution context handled by the OS/Email Client, so any dynamic input must be sanitized to prevent injection of unintended email parameters like `&cc=`, `&bcc=`, or `&body=`.
**Prevention:** Always use `encodeURIComponent()` when embedding dynamic variables into URL parameters, including `mailto:` URIs.
