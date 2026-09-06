# Quick: Waitlist bucket + estados de proposta nos hubs

**Data:** 2026-09-06  
**Scope:** Medium — reutilizar `WaitlistService`, `lista_espera`, `propostaInbox`, `OfertaMatchCard`, `PropostaReviewCard`.

## Problema
Auditoria produção: waitlist difícil de encontrar; propostas rejeitadas/canceladas desaparecem dos hubs (filtro só `aberta`).

## Reutilizar (não reinventar)
| Peça | Já existe |
|------|-----------|
| Waitlist insert/list | `WaitlistService.enqueueWaitlist`, `listWaitlistByProcura` |
| Match waitlist bucket | `MatchingService.findCompatibleOfertas` → `waitlist[]` |
| Card waitlist + CTA | `OfertaMatchCard` variant `waitlist` |
| Filtros proposta | `filterPropostasParaInbox`, `filterPropostasEnviadas` |
| RPC reject/cancel | `PropostaService.rejectProposta`, `cancelProposta` |

## Mudanças mínimas
1. `propostaInbox.js`: filtros `filterPropostasTerminadas*` via `isPropostaHistorico` (rejeitada, cancelada, aceite; **não** invalidada).
2. `propostaEstado.js`: labels PT + chips (Por responder, Aguarda resposta, Rejeitada, Cancelada, Aceite).
3. `PropostaReviewCard`: `modo="historico"` read-only com chip; chip pendente em abertas.
4. `PassengerDashboard`: secção «Lista de espera» antes de propostas; historico terminadas; reload após reject (não remover optimistically).
5. `DriverDashboard`: secção historico terminadas; chips pendentes.

## Verificação UI
- Passageiro com procura: ver bucket lista de espera + CTA «Entrar na lista de espera» em ofertas sem vagas.
- Após recusar/cancelar proposta: card move para secção terminada com label «Rejeitada» ou «Cancelada».
- Motorista: idem em «Ver propostas».

## Fora de scope
- Idempotência `reject_agreement_adenda`; waitlist no hub motorista por oferta (só informativo em procuras).
