# PACOTE ENG #9 — Waitlist quando capacidade < N_proposto

**Data:** 2026-09-06  
**Base:** ENG#1–#8  
**Scope:** Medium — reutilizar `WaitlistService`, `matchingFilters`, `accept_proposal`, `promote_waitlist`.

## Problema
Quando `vagas_disponiveis < N_proposto`, aceite não pode criar acordo — fluxo waitlist. Promoção não pode auto-aceitar nem notificar «vaga aberta» sem capacidade suficiente para o grupo.

## Reutilizar (não reinventar)
| Peça | Já existe |
|------|-----------|
| Classificação direct/waitlist | `evaluateMatch` + `MatchingService` |
| Gate aceite | `accept_proposal` SQL (`v_n > v_disponiveis`) |
| Waitlist insert/promote | `WaitlistService`, RPC `promote_waitlist` |
| UI estados | `OfertaMatchCard`, buckets em hubs |
| ENG#3 não-regressão | `PacoteEng3Acceptance.test.js` |

## Diff mínimo
1. `promote_waitlist`: só `notificada` se `vagas_disponiveis >= n_candidato` da procura (N_actual sync).
2. `PassengerDashboard`: matching usa N_actual (`membrosCount`) quando grupo existe.
3. `PacoteEng9Acceptance.test.js`: capacidade→waitlist, sem auto-acordo, promoção sem accept, CTAs auth, snapshot, ENG#3 intacto.

## Verificação
```bash
npm run test:run -- src/services/PacoteEng9Acceptance.test.js \
  src/services/PacoteEng3Acceptance.test.js \
  src/services/WaitlistService.test.js \
  src/utils/matchingFilters.test.js \
  src/pages/PassengerDashboard.test.jsx
```
