## 2024-05-24 - Supabase Auth Bypass Risk
**Vulnerability:** Using `supabase.auth.getSession()` for authorization checks in protected routes (`ProtectedRoute.jsx`, `App.jsx`, `Layout.jsx`).
**Learning:** `getSession()` only checks the local session data (e.g., localStorage), which can be easily manipulated by a malicious user to spoof authentication and bypass route guards. It does not verify the token with the Supabase server.
**Prevention:** Always use `supabase.auth.getUser()` in auth guards and protected routes to ensure the user's identity is cryptographically verified by the Supabase backend.
