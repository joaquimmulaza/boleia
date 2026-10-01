# ENG#33 — Visibilidade proposta cruzada (P0)

## Plano (reuse vs gaps)

| AC | Já existe | Gap | Fix mínimo |
|----|-----------|-----|------------|
| B vê lista accionável | `filterPropostasParaInbox` + hubs + `PropostaReviewCard` | Filtro case-sensitive; deep link abre hub sem foco | `isPropostaAberta`; query `?focus=propostas&propostaId&openOfertaId` |
| Notif `proposal_received` | Trigger T33 + `notificationRouter` | Rota só `/passageiro` ou `/motorista` | `propostaHubDeepLink` com query params |
| Estado sync | RPC + `carregar()` pós-acção | — | Normalizar `estado` nos filtros inbox |
| «Avisámos o outro» | «Proposta enviada ao …» | Falta menção à notificação | Copy PT-PT curta pós-create |

**Fora deste diff:** notif reverse reject/cancel, badge count motorista, `/acordos` para propostas pendentes, nova migração.

## Ficheiros

- `src/utils/propostaEstado.js` — `isPropostaAberta`
- `src/utils/propostaInbox.js` — filtros robustos
- `src/utils/propostaFeedback.js` — copy pós-envio
- `src/utils/notificationRouter.js` — deep links
- `PassengerDashboard.jsx` / `DriverDashboard.jsx` — copy + deep link mount
- `PropostaReviewCard.jsx` — `data-proposta-id`
