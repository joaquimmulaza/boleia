# PACOTE ENG #3 — Aceite atómico → acordo 1:N

**Scope:** Medium (RPC gap + testes de contrato; sem UI nova)

## Objetivo

Aceitar proposta cria acordo 1:N de forma atómica via `accept_proposal`; valores congelados do snapshot da proposta; irmãs canceladas; capacidade/waitlist; sem órfãos.

## Gap identificado (design-first)

A migração `audit_gaps_accept_proposal_member_ids` exige `p_member_ids` para **todos** os grupos, mas a UI só envia IDs quando `requiresMemberSelection` (N_actual > N_proposto). Grupo com N_actual = N_proposto falhava com «Capacidade inconsistente».

## Diff mínimo

1. **RPC** — fallback auto-select primeiros N activos quando `p_member_ids` vazio e count = N; exigir picker explícito quando count > N; guard «procura fechada» / acordo activo existente.
2. **UI** — `PropostaReviewCard` envia IDs dos membros listados quando há `grupo_id` e não há picker (defesa client).
3. **Testes** — `PacoteEng3Acceptance.test.js` (happy path 1→M→1, snapshot, capacidade, idempotência, race mock, órfãos, SQL guards).

## Fora de scope

Escrow IBAN (#5), Browse (#4).

## Verificação

`npm run test:run -- src/services/PacoteEng3Acceptance.test.js`
