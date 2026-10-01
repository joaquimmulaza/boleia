# SUMMARY — Esqueceu a palavra-passe

## Entregue

- Spec + design (Stitch/UI Skills MCP degradados nesta sessão — shell Auth como SoT visual)
- `AuthContext`: `passwordRecoveryPending` + `clearPasswordRecovery` + sessionStorage `bc_password_recovery`
- Guards: `RootRoute`, `ProtectedRoute` → `/auth?mode=update-password`
- UI: modos forgot / update-password em `Auth.jsx` + `useAuthForm`
- `errorHandler` + `validatePassword` (mín. 8)
- Testes Vitest verdes no âmbito auth (45 scoped)

## Ops (manual)

Dashboard Supabase → Authentication → URL Configuration:

- **Site URL:** `https://boleia-cyan.vercel.app` (domínio público; **não** usar `boleia-joaquim-mulazas-projects.vercel.app` — SSO Vercel 403)
- **Redirect URLs:**
  - `http://localhost:5173/auth?mode=update-password`
  - `https://boleia-cyan.vercel.app/auth?mode=update-password`

Vercel env: `VITE_APP_URL=https://boleia-cyan.vercel.app` (production + preview + development)

Opcional: template email Recovery em PT-PT.
