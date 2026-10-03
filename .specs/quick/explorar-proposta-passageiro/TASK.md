# Quick Task: Explorar — mesmo cartão e proposta do passageiro

**Date:** 2026-10-03
**Status:** In Progress

## Plano

O utilizador autenticado não fica em `/explorar`: a sessão vai para o hub, e o Explorar sem procura é o feed `browse` de `PassengerDashboard`, ainda com `OfertaMatchCard` («Publicada», «Sem origem/…»). `/explorar` anónimo já usa `OpportunityCard`. A folha `OpportunityProposalSheet` e `resolveOpportunityProposal` já existem (PR #182) e não estão montadas nesse feed.

Diff mínimo:

1. O feed Explorar do passageiro passa a `OpportunityCard` (o mesmo do anónimo). O CTA abre `OpportunityProposalSheet`. Oferta incompleta (lacunas já calculadas) mantém o sheet de dados em falta.
2. Cabeçalho dos dois estados: o ícone `boleia-logo.png` que já existe mais a palavra «Boleia Certa». Sem header novo.
3. `/explorar` anónimo: o CTA continua para `/auth`, com a mesma cópia.

## Fora

- Hub do motorista, schema, migração, contrato Supabase.
- Fade, chave de horário, `n_candidato` 0, tecto do stepper, buraco de OD vazio.
- `OfertaMatchCard` nos matches e na lista de espera.
- Reconstruir a folha.

## Verification

- [ ] Autenticado no Explorar abre «Nova proposta» a partir de «Propor acordo».
- [ ] Anónimo em `/explorar`: CTA continua para `/auth`.
- [ ] `POR_PASSAGEIRO`: stepper, total = unidade × N. `TOTAL_ACORDO`: um preço, sem × N.
- [ ] Flexível sem rota inventada. Fixa com a rota real.
- [ ] Os dois cabeçalhos mostram ícone e «Boleia Certa».
