# Summary — Preview reconcile #2

**Date:** 2026-09-10  
**Status:** Done

## Result

`supabase/migrations/` está 1:1 com `schema_migrations` do projecto produção `fdclrbcgytnuqcrpsevw` (**61 = 61**). Sem DDL aplicado em produção.

## What changed

- Timestamps locais inventados → versões MCP reais (eng5/9/11/13/14/15/16 + editar procura).
- Splits remotos em falta: eng7 (`224444`–`224517`), eng8b `162032`, seat `190441`/`449`/`530`/`551`.
- Removidos monolitos locais-only perigosos: `20260906220000` eng3 (`accept_proposal` sem `reservado`) e eng7.
- Mantidos `180000` e `190000` (existem no remoto com statements vazios; testes Seat/G15 continuam a lê-los).
- Testes de aceitação apontam para os ficheiros reconciliados; ENG#3 SQL alinhado a `accept_proposal` actual (`190530`, sem auto-select).

## Verification

- Diff versões local vs MCP: vazio.
- Vitest âmbito: 11/12 ficheiros verdes (139 passed). `TerminateAuditG15` 1 falha pré-existente (mock `.in` em `getAgreementsForPassenger`) — fora deste reconcile.
