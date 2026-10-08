# Contas QA (`public.qa_accounts`)

Allowlist exacta de utilizadores que podem ver o marketplace de teste (`is_test = true`) e cujas ofertas/procuras novas são marcadas automaticamente como teste.

## Operações (service_role)

A tabela tem RLS activo **sem policies** e `REVOKE ALL` para `anon` / `authenticated`. Só funções `SECURITY DEFINER` e o papel de serviço a leem.

Para adicionar uma conta QA criada via Admin API ou Dashboard:

```sql
insert into public.qa_accounts (user_id, note)
values ('<uuid-do-auth.users>', 'critiquito manual')
on conflict (user_id) do nothing;
```

Executar com **service_role** (Supabase SQL Editor em modo service role, ou migração MCP).

## O que não fazer

- Não confiar em padrões de email em runtime (`critiquito.*`, `@example.com`, etc.) — o seed inicial da migration `20261008142100` só captura contas **existentes** no momento do deploy.
- Registos posteriores com email «de teste» **não** entram na allowlist automaticamente.

## Referência

- Migration: `supabase/migrations/20261008142100_smoke_3a_is_test_flag.sql`
- RLS participantes + QA viewer: `supabase/migrations/20261008142200_smoke_3a_is_test_rls_qa_participant.sql`
- Prova local: `scripts/run-smoke-3a-rls-pg-proof.sh`
