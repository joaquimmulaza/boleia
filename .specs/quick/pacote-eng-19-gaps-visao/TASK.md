# PACOTE #19 — Gaps visão no path crítico

**Base:** `main` pós ENG#18 (PR #110)

## Goal
Fechar desvios visão Oferta↔Procura no path browse→acordo/pagamento. Audit-first, smallest diff.

## Acceptance (AC)

1. **Oferta flexível:** zero OD inventada in UI/API (browse, proposta, acordo, comprovativo)
2. **1:N:** N_proposto / N_contrato / N_activos coherentes; grupo incompleto negociável sem reescrever snapshots
3. **Adendas:** effective_from = dia 1 mês seguinte; sem mutação retroactiva do mês corrente (G13/G14)
4. **WhatsApp auxiliar:** sem CTA primário que substitua proposta/pagamento/aceite in-app
5. **Valores:** sempre do acordo/snapshot — nunca defaults plataforma
6. **CTAs:** só com auth

## Audit (2026-09-10)

| AC | Estado | Notas |
|----|--------|-------|
| 1 | Fix | `MyAgreements` detalhe flexível deixou de usar rótulos Partida/Chegada |
| 2 | OK | `syncNCandidato` não toca propostas; `buildPropostaReview` usa N_proposto |
| 3 | OK | `firstDayNextMonthLuanda` + migrações ENG#7 + G13/G14 |
| 4 | OK | WhatsApp só em fallback colapsável (`GrupoProcuraPanel`), link auxiliar |
| 5 | OK | `AcordoPagamentoPanel` / RPCs usam `valor_kz` congelado |
| 6 | OK | `listOfertasDisponiveis` exige auth; inbox filters sem userId → [] |

## Ship

- Fix: `MyAgreements.jsx` (detalhe flexível)
- Testes: `PacoteEng19Acceptance.test.js` + regressão MyAgreements
- Regressão: PacoteEng2/3/5/12, FlexMatching, AdendaAuditG13G14, MarketplaceAudit

## Out of scope

Pack B; polish cosmético #102–#106
