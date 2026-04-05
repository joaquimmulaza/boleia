
## 2026-03-24 - Persisting Realtime Notifications
**Vulnerability:** Realtime WebSockets are ephemeral. If a user receives a notification when the app is closed or backgrounded, it is lost forever. This is a severe UX issue for core events (like ride acceptance).
**Learning:** For critical transactional events, Realtime must be paired with a persistent data layer (e.g., a `notifications` table).
**Prevention:** Implement an architectural pattern where the backend (via triggers or explicit inserts) persists the event to a database table. The frontend should fetch unread notifications on mount and subscribe to the table changes via Realtime, ensuring no events are dropped.

## 2026-03-24 - Edge Function Hardcoded Secrets
**Vulnerability:** Hardcoding VAPID keys directly in the Edge Function code.
**Learning:** Hardcoding API keys or secrets in source code is a major security risk as they can be exposed in version control.
**Prevention:** Always use environment variables (e.g., `Deno.env.get`) configured securely in Supabase Secrets for sensitive keys like VAPID keys.

## 2026-03-24 - URI Injection Vulnerability in mailto and tel Links
**Vulnerability:** Unsanitized user input interpolated directly into `mailto:` and `tel:` links can lead to URI injection.
**Learning:** If user-controlled data is placed into a URI scheme without encoding, an attacker could inject additional parameters or manipulate the URI structure.
**Prevention:** Always use `encodeURIComponent` when interpolating dynamic or user-controlled data into URI schemes like `mailto:` and `tel:`.
