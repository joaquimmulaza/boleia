# Sessão expirada — apply_due + perfil

## Problema
JWT expirado após idle: pedidos anon (401/42501) em perfis, acordos e RPCs lazy; UI presa em «A carregar perfil...».

## Fix
1. `authSessionRefresh.js` — caminho único (#255: `user.id:access_token`, 60s); `withLiveSessionAuthCall` para perfil e apply_due_*.
2. `getAgreementsFor*` e RPCs `apply_due_*` usam o helper.
3. Timeout ~10s no gate de perfil + retry + redirect `/auth?next=…`.
4. Testes: refresh único, falha → auth, timeout, sem loop.
