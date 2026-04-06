
## 2026-03-24 - Persisting Realtime Notifications
**Vulnerability:** Realtime WebSockets are ephemeral. If a user receives a notification when the app is closed or backgrounded, it is lost forever. This is a severe UX issue for core events (like ride acceptance).
**Learning:** For critical transactional events, Realtime must be paired with a persistent data layer (e.g., a `notifications` table).
**Prevention:** Implement an architectural pattern where the backend (via triggers or explicit inserts) persists the event to a database table. The frontend should fetch unread notifications on mount and subscribe to the table changes via Realtime, ensuring no events are dropped.

## 2026-03-24 - Edge Function Hardcoded Secrets
**Vulnerability:** Hardcoding VAPID keys directly in the Edge Function code.
**Learning:** Hardcoding API keys or secrets in source code is a major security risk as they can be exposed in version control.
**Prevention:** Always use environment variables (e.g., `Deno.env.get`) configured securely in Supabase Secrets for sensitive keys like VAPID keys.

## 2024-04-03 - URI Injection in tel: and mailto: links
**Vulnerability:** Unsanitized variables concatenated directly into `tel:` and `mailto:` link attributes, opening possibilities to inject line breaks and additional headers (e.g. `cc:`, `bcc:`, `body:`) into user emails, or executing arbitrary USSD codes and unintended destinations for phone links.
**Learning:** React escapes HTML content in elements to prevent XSS but not the logic of URLs, leaving URI-specific injections possible via attributes like `href`.
**Prevention:** Always use `encodeURIComponent()` when dynamically interpolating user-controlled or dynamically fetched inputs into the parameters of URI schemes like `mailto:` or `tel:`.
