# Privilégios Supabase / PostgreSQL (Boleia Certa)

## Migração `20261009160000_sec_default_privileges`

- **`public.perfis`:** o cliente PostgREST não faz `INSERT`/`DELETE` (revogado). Criação via trigger `handle_new_user`; eliminação via RPC `delete_own_account()`.
- **Funções trigger:** `REVOKE EXECUTE` de `PUBLIC`, `anon` e `authenticated` (inclui loop sobre todas as `RETURNS trigger` em `public`).
- **Default privileges (só FUNCTIONS):** `postgres` deixa de dar `EXECUTE` a `PUBLIC` e a `anon` em funções novas; mantém default `GRANT EXECUTE` para `authenticated` e `service_role`. **Nunca** alterar default privileges de `TABLES` ou `SEQUENCES`.

## Regra para novas migrações

1. **Nova RPC** (`CREATE OR REPLACE FUNCTION` que o cliente chama com `supabase.rpc`): na **mesma migração**, `GRANT EXECUTE ON FUNCTION … TO authenticated` (e `service_role` se aplicável).
2. **RPC em fluxo logged-out** (`anon`, ex. `/explorar` anónimo): além do acima, `GRANT EXECUTE … TO anon`. Inventário actual do cliente logged-out: **nenhuma** — só `SELECT` directo nas tabelas de browse.
3. **Função só para triggers / helpers internos:** após criar, `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` (ou só os roles expostos ao PostgREST).

Contratos Vitest: `src/services/SecDefaultPrivilegesContract.test.js` (defaults, perfis, allow-list anon, migrações futuras).

## Prova local PostgreSQL

Requer PostgreSQL 16+ (`apt install postgresql`). O script aplica **todas** as migrações (bootstrap Supabase-like + `localfix` só para `20260329161035_remote_schema.sql` em psql local).

```bash
chmod +x scripts/run-sec-default-privileges-pg-proof.sh scripts/apply-all-migrations-local.sh
./scripts/run-sec-default-privileges-pg-proof.sh
```

## Nota #240 (storage comprovativos)

A migração `20261009150000_sec_rls_grants_medio` inclui **policy `UPDATE`** (`comprovativos_update_own`) para o passageiro substituir ficheiro no path validado. O comentário «sem UPDATE» naquele ficheiro não significa ausência de policy — significa não conceder `UPDATE` amplo na tabela `storage.objects`.
