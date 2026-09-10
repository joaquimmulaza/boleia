# Summary — Preview ENG#18 reconcile (hotfix pós #110)

**Date:** 2026-09-10  
**Status:** Done

## Problem

Merge #110 deixou ficheiro órfão `20260910120000_pacote_eng18_ttl_reserva_iban_gate.sql` (monólito local). Produção/remoto tinha ENG#18 aplicado em **3 partes** via MCP.

## Before → After

| Before (git main pós #110) | After (este PR) |
|----------------------------|-----------------|
| `20260910120000_pacote_eng18_ttl_reserva_iban_gate.sql` (1 ficheiro) | Removido |
| — | `20260910100345_pacote_eng18_ttl_reserva_iban_gate.sql` |
| — | `20260910100358_pacote_eng18_ttl_reserva_iban_gate_part2.sql` |
| — | `20260910100408_pacote_eng18_ttl_reserva_iban_gate_part3.sql` |

**Contagem:** 64 versões local = 64 remoto (`fdclrbcgytnuqcrpsevw`).

## Nota produto (documentação)

Rejeitar comprovativo mantém `reservado` com TTL activo; expiração continua lazy nas listagens (`apply_due_reserva_expiry`).

## Verification

- `list_migrations` MCP: diff versões vazio vs `supabase/migrations/`.
- `PacoteEng18Acceptance.test.js` lê os 3 ficheiros reconciliados.
