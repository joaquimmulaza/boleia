# Quick Task: Reconciliar schema_migrations (Preview CI)

**Date:** 2026-09-10
**Status:** Done

## Description

O check Supabase Preview em `main` (`069711d`) falha: versões remotas MCP não estão em `supabase/migrations/` (monolitos locais `190000`/`220000` vs splits `190441…` / `225833`; ~17 timestamps). Reconciliar 1:1 como no PR #70, sem DDL em produção.

## Files Changed

- `supabase/migrations/*` — rename/add/delete para match exacto de `schema_migrations`
- Testes que `readFileSync` o SQL (ENG#3/5/9/11/13/14/15/16, editar procura)

## Verification

- [x] Conjunto de versões locais = remoto (61)
- [x] Sem timestamps locais-only que Preview tentaria reaplicar
- [x] Testes Vitest do âmbito a verde (excepto G15 mock pré-existente)
