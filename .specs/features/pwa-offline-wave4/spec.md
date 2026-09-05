# PWA Offline Wave 4 — Specification

## Problem Statement

Wave 3 cobriu `leave_passenger` / `cancel_proposal` + fila IndexedDB. Falta idempotência nas restantes RPCs de mutação, UI de procura (dias + teto), optimistic «Saída Pendente», reforço visual da quota, e fechar gaps de auditoria G9 / G3 / G4 / G10 com mocks.

## Decisions

| ID | Decision |
| -- | -------- |
| 1C | Teto mensal no formulário de procura + reforço da quota congelada em MyAgreements |
| 2C | G9 = fórmula faltas; G3/G4/G10 = overbooking/concorrência por mocks Vitest (sem race Postgres) |

## Goals

- [x] `p_idempotency_key` em `accept_proposal`, `leave_grupo_membro`, `renegotiate_agreement_pricing`, `accept_agreement_adenda` (cliente + fila; SQL remoto via MCP pendente)
- [x] Cliente gera UUID + enfileira offline nestas RPCs
- [x] PassengerDashboard: picker `dias_semana` + campo `teto_mensal_kz` (Kz)
- [x] MyAgreements: quota destacada + badge «Saída Pendente (A sincronizar...)»
- [x] Audit: G9 numérico; G3/G4/G10 mocks; remover skips cobertos

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Race verdadeira Postgres | Decisão 2C — só mocks |
| Pro-rata de adendas | Não adoptado (2C = faltas) |
| Pasta `src/__tests__/` | Testes colocados |

## Requirements

| ID | Requirement |
| -- | ----------- |
| W4-01 | RPCs Wave 4 aceitam `p_idempotency_key`; chave duplicada = sucesso sem re-mutar |
| W4-02 | AgreementService / GrupoService passam chave; offline → `enqueueRpc` |
| W4-03 | Procura grava `dias_semana` + `teto_mensal_kz` escolhidos pelo utilizador |
| W4-04 | Cards activos mostram quota/preço congelado proeminente em Kz |
| W4-05 | `offlineQueued` leave → badge Saída Pendente + botão Sair disabled |
| W4-06 | G9: `desconto_kz = quota / dias_uteis` (ex. 30000/22 ≈ 1363.64) |
| W4-07 | G3/G4/G10: mocks overbooking / segundo aceite rejeitado |

## Stack

- JS + JSDoc; Vitest; Supabase MCP para DDL; `npm run test:run`
