# Fix recovery redirect (Vercel SSO + Supabase)

## Goal
Links de recuperação de palavra-passe devem abrir `https://boleia-cyan.vercel.app/auth?mode=update-password` sem login Vercel.

## Root cause
- Supabase Site URL / fallback apontava para `boleia-joaquim-mulazas-projects.vercel.app/` (domínio com SSO Protection → 403).
- `redirectTo` no client usava `window.location.origin` (mesmo domínio protegido).
- Redirect URLs em Supabase não incluíam o path canónico.

## Acceptance
- AC1: `resetPasswordForEmail` usa `VITE_APP_URL` (fallback `window.location.origin`).
- AC2: Supabase Site URL = `https://boleia-cyan.vercel.app`.
- AC3: Redirect URLs incluem `https://boleia-cyan.vercel.app/auth?mode=update-password` e localhost.
- AC4: Hash `type=recovery` na raiz redirecciona para `/auth?mode=update-password`.
- AC5: Testes Vitest verdes.

## Ops
- Supabase Dashboard → Auth → URL Configuration (projecto `fdclrbcgytnuqcrpsevw`).
- Vercel → `VITE_APP_URL=https://boleia-cyan.vercel.app` (production, preview, development).
