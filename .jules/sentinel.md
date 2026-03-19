## 2024-03-19 - [CRITICAL] Authentication bypass via user_metadata
**Vulnerability:** Role-based access control (RBAC) was relying on `session.user.user_metadata.tipo_perfil` to authorize access to protected routes (Driver or Passenger dashboards).
**Learning:** In Supabase, `user_metadata` can be freely modified by users via the client API (using `supabase.auth.updateUser()`). Trusting it for authorization allows any user to elevate their privileges to any role.
**Prevention:** Always use the server-side authoritative source for RBAC, such as querying a restricted `perfis` table directly, or using secure `app_metadata` managed by Edge Functions or Database Triggers.
