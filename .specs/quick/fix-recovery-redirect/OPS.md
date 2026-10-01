# Ops — fix recovery redirect

## Supabase (obrigatório)

Dashboard: https://supabase.com/dashboard/project/fdclrbcgytnuqcrpsevw/auth/url-configuration

| Campo | Valor |
|-------|-------|
| Site URL | `https://boleia-cyan.vercel.app` |
| Redirect URLs | `https://boleia-cyan.vercel.app/auth?mode=update-password` |
| | `http://localhost:5173/auth?mode=update-password` |

### Script alternativo (Management API)

```bash
SUPABASE_ACCESS_TOKEN=sbp_... node scripts/update-supabase-auth-urls.mjs
```

Token: Supabase Dashboard → Account → Access Tokens.

## Vercel (feito)

`VITE_APP_URL=https://boleia-cyan.vercel.app` (production, preview, development).

## Verificação

1. Pedir recovery em https://boleia-cyan.vercel.app/auth?mode=forgot
2. Email deve conter `redirect_to=https://boleia-cyan.vercel.app/auth?mode=update-password`
3. Link abre ecrã «Definir nova palavra-passe» sem login Vercel
