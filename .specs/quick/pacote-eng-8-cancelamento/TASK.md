# PACOTE ENG #8 — Cancelamento acordo (agendado + justa causa)

**Data:** 2026-09-06  
**Base:** `cursor/pacote-eng-7-adendas-effective-from-dda5`  
**Scope:** Medium — RPC já em migrações s22; entrega = testes G15 + contrato idempotência/vagas.

## Requisitos

| ID | Requisito | Verificação |
|----|-----------|-------------|
| A1 | Sem justa causa (`aviso_previo`) → `cancelamento_pendente` até fim do mês; vaga ocupada | G15 Vitest + contrato SQL |
| A2 | Justa causa → cancelamento imediato (`cancelado_justificado`) + `recount_oferta_vagas` | G15 Vitest + contrato SQL |
| A3 | Idempotência via `p_idempotency_key` + `rpc_idempotency` | G15 + AgreementService.test |
| A4 | Preços congelados intactos em aviso prévio (sem defaults plataforma) | G15 |
| A5 | `apply_due_agreement_terminations` liberta vagas no dia 1 | G15 lazy RPC |

## Fora do scope

- UX polish / Critiquito
- ProxyPay / Multicaixa
- Nova schema (reutiliza colunas s22)

## RPCs (migrações existentes)

- `terminate_agreement(p_acordo_id, p_modo, p_justificativa?, p_idempotency_key?)`
- `apply_due_agreement_terminations(p_acordo_id?)`
