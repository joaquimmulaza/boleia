# Quick Task: Detalhe da oportunidade + proposta (slice 2)

**Date:** 2026-10-03
**Status:** Done

## Plano (antes do código)

Já existe e reutiliza-se:

- `resolveOpportunityCard` — flexível = «Disponível para acordos», sem rota inventada; `TOTAL_ACORDO` é um valor, sem × N; oferta fixa só tem rota com OD real.
- `RouteIndicator` — origem, linha, destino.
- `OverlayShell` + `SheetDragHandle` — pega, drag, backdrop, Fechar por conteúdo. Não se reconstrói o chrome.
- `OfertaDetailSheet` / `ProposalSheet` — detalhe e lista do hub do motorista. Fora deste slice.
- `/explorar` já monta `OpportunityCard`, sem abrir detalhe.

Diff mínimo:

1. `OpportunityDetailSheet` lê o mesmo modelo do cartão e abre no toque em `/explorar`.
2. `OpportunityProposalSheet` + modelo puro: motorista (grupo e passageiro) mostra «Este número fica fixo nesta proposta.» com `N_proposto`; o stepper do passageiro não. `TOTAL_ACORDO` não multiplica.

## Fora

- CTA anónimo «Entrar para propor», `.text-fade-cap`, chave de horário, «0 passageiros».
- Fade do cartão acima de 2 linhas.
- Chrome do sheet.
- `OfertaMatchCard` e o hub do motorista.
- Ratings, chat, reserva, GPS, pagamentos, matching novo.
- Schema, migração, contrato Supabase.
- Copy de falha de envio.

## Verification

- [x] Detalhe flexível `TOTAL_ACORDO`: «Disponível para acordos» + horário dos dados, um preço, sem rota, sem × N.
- [x] Oferta fixa: `RouteIndicator` só com OD real.
- [x] Nomes no detalhe e na proposta: texto completo, sem fade nem reticências.
- [x] Motorista grupo e passageiro: a frase do número fixo. Stepper do passageiro: sem essa frase. N é o snapshot.
