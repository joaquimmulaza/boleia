## 2024-03-20 - [RBAC relying on user_metadata]
**Vulnerability:** Authorization checks (e.g. `tipo_perfil`) rely on `session.user.user_metadata` instead of secure app_metadata or DB role mappings.
**Learning:** `user_metadata` in Supabase is editable by the user on the client side, meaning users can escalate their privileges.
**Prevention:** Rely on secure DB checks (e.g., query the `perfis` table) to determine user roles instead of trusting `user_metadata` directly.
