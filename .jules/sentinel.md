## 2024-05-24 - Supabase getSession vs getUser in Auth Guards
**Vulnerability:** Insecure authentication verification
**Learning:** `supabase.auth.getSession()` trusts the local browser session cache. This can be manipulated by malicious actors to bypass client-side routing guards if the session token is altered or injected locally, whereas `supabase.auth.getUser()` verifies the current session directly with the Supabase server, making it much more resilient against client-side spoofing.
**Prevention:** Always use `supabase.auth.getUser()` in route guards (like `ProtectedRoute.jsx`) and global layouts that conditionally render or redirect based on authentication or RBAC attributes (`App.jsx`, `Layout.jsx`).
