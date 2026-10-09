# perfis 42501 — motorista em /acordos

## Bug
Sessão motorista em `/acordos`: 2× HTTP 401 em `/rest/v1/perfis`, consola `42501 permission denied for table perfis`. UI degrada mas não rebenta.

## Causa (verificado prod)
- `authenticated` tem SELECT nas 7 colunas (incl. `iban_titular`); `anon` **não** tem SELECT em `perfis`.
- 401 + 42501 = pedido como **anon**: `fetchProfile` disparava antes de JWT válido (`onAuthStateChange` com `user.id` mas sem `access_token` / token expirado / storage obsoleto).
- **Não** era coluna `iban_titular` nem embed `getAgreementsForDriver` (embed autenticado em `acordos_passageiros`).

## Fix (cliente)
- `fetchProfile`: só com sessão viva (`getSession` + `access_token` + `user.id`); retry único após `refreshSession` em 401/42501; sem loop de `console.warn` nesses erros.
- `onAuthStateChange`: só chama `fetchProfile` se `isLiveAuthSession(nextSession)`.
- Revert embed driver e merge de nomes em `MyAgreements` (workaround desnecessário).
- `perfisGrants.js`: manter `PERFIL_COLUNAS_SELECT` completo alinhado à migração.

## Fora de âmbito
Grants, RLS, migrações.
