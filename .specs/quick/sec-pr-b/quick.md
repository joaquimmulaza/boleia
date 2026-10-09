# Security PR B — push webhook, logout subscription, anon revoke, create_proposal grupo

## Escopo

1. Edge `send-push`: header `x-boleia-push-secret` vs `PUSH_WEBHOOK_SECRET` (constant-time); 401 se inválido.
2. Trigger `handle_new_notification_push`: enviar header; secret de `vault.decrypted_secrets`; tolerar secret em falta (log, skip pg_net).
3. Logout (`Layout`): DELETE `push_subscriptions` por user+endpoint, `unsubscribe()`, depois `signOut`.
4. REVOKE ALL `push_subscriptions` FROM anon, PUBLIC; manter grants authenticated.
5. `create_proposal`: `p_grupo_id` ∈ procura; `n_passageiros_propostos` ≤ membros activos; erros PT claros.

## Ops (Joaquim — ordem)

1. Criar secret no Vault (`push_webhook_secret`) com o mesmo valor que `PUSH_WEBHOOK_SECRET` na Edge Function.
2. Definir env `PUSH_WEBHOOK_SECRET` na função `send-push`.
3. Redeploy `send-push` (não automatizado neste PR).
4. Aplicar migração (trigger já tolera secret em falta).

## Provas

- `scripts/run-sec-pr-b-pg-proof.sh`
- Vitest: `SecPrBAcceptance`, `pushSubscriptionLogout`, `Layout` logout
