# boleia-marketplace-agreement

**Role:** AGREEMENT / ADDENDUM AGENT  
**Created:** 2026-09-05  
**Status:** Done (uncommitted) — effective_from = next month

## Mission

Close divergence between UI copy («próximo mês») and backend (MVP applied prices immediately). Implement `effective_from` = first day of next calendar month so price/N changes are **not** retroactive; keep original contract auditable; leave must **not** recalculate quotas.

## Canonical invariants (do not renegotiate)

- Agreement 1 motorista : N passageiros (`acordos` + `acordos_passageiros`)
- Quotas frozen at acceptance
- Leave does **not** recalculate current-month quotas; frees capacity via P0 `leave_passenger` RPC — **DO NOT CHANGE** leave logic
- Adenda is **only** path to mutate prices / `n_passageiros_contrato`
- No divisor capacity, N_activos, or `/4` for pricing
- Four Ns preserved (`N_actual` · `N_proposto` · `N_contrato` · `N_activos`)

## Decision (effective_from) — CLOSED

1. Tabela `acordos_adendas` com snapshot `previo_*` + novo preço + `effective_from` = 1.º dia do mês seguinte (`Africa/Luanda`).
2. RPC `renegotiate_agreement_pricing` **não** muta cabeçalho/quotas live; agenda adenda pendente.
3. RPC `apply_due_agreement_adendas` aplica lazy quando `effective_from <= hoje` (chamada no load + no início da renegociação).
4. UI: preço corrente + banner «Novo preço a partir de …»; copy «próximo mês» alinhada ao backend.
5. Leave / `leave_passenger` **intocado**.

## ALTERAÇÕES

| Área | Detalhe |
|------|---------|
| MCP migration | `adenda_effective_from_next_month` |
| DDL | `acordos_adendas` + RLS SELECT envolvidos |
| RPC | `renegotiate_agreement_pricing` (agenda) + `apply_due_agreement_adendas` (lazy) |
| Service | `AgreementService.js` — adenda + listagens com `adenda_pendente` |
| UI | `MyAgreements.jsx` — banner adenda pendente |
| Tests | AgreementService, MyAgreements, AgreementsE2E temporal |

## NÃO ALTERADO (P0)

- `leave_passenger` RPC / `leavePassenger` wiring
- RLS UPDATE drops (propostas/acordos/…)
- Matching*, Grupo*, PropostaService, dashboards, PublishRoute

## TESTES

`npm run test:run -- AgreementService.test.js AgreementsE2E.test.jsx MyAgreements.test.jsx` → **48 passed**

## RISCO / DEPENDÊNCIAS

- Aplicação efectiva no virar do mês depende de lazy apply no load (ou nova renegociação). Sem cron dedicado.
- Faltas no mês corrente continuam a usar `quota_mensal_kz` live (correcto).
