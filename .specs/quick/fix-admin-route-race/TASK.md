# Quick — fix AdminRoute redirect race

## Bug

`AuthContext` põe `loading=false` antes de `fetchProfile` terminar. `AdminRoute` vê `session` + `profile=null` e redirecciona para `/acordos` mesmo com `is_admin=true`.

## Fix

1. Auth: só `loading=false` após tentativa de carregar perfil (se há sessão).
2. AdminRoute: se sessão e perfil ainda null, mostrar “A verificar…” (belt).
3. Testes AdminRoute + AuthContext.

## DoD

- [ ] Login admin → `/admin/pagamentos` não redirecciona
- [ ] Simulação browser fluxo pagamento
- [ ] VERDICT code-reviewer
