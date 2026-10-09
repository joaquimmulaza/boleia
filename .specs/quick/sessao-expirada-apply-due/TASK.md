# Sessão expirada — apply_due + perfil

## Problema
JWT expirado após idle: pedidos anon (401/42501) em perfis, acordos e RPCs lazy; UI presa em «A carregar perfil...».

## Fix
1. `authSessionRefresh.js` — caminho único (#255: `user.id:access_token`, 60s); `withLiveSessionAuthCall` para perfil e apply_due_*.
2. `getAgreementsFor*` e RPCs `apply_due_*` usam o helper.
3. Timeout ~10s no gate de perfil (não invalida fetch em voo; perfil tardio limpa erro) + retry + redirect `/auth?openAcordoId` (UUID).
4. `isLiveAuthSession` exige `expires_at` futuro; refresh usa `hasAuthSessionShape`.
5. 42501 com JWT válido **não** dispara refresh (#255).
6. Set de tentativas com cap + reset em sign-out / token novo.
7. Limpar sessão morta: `signOut({ scope: 'local' })`.
8. `SIGNED_OUT` → `sessionEndedForAuthRedirect` → ProtectedRoute `/auth?sessionEnded=1`.
9. Pós-login acordo: `resolvePostLoginPathWithOpenAcordo` reconstrói `/acordos?openAcordoId=`.
