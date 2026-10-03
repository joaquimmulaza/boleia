# Quick Task: cartões do hub motorista «Procuras e grupos»

**Date:** 2026-10-03

## Goal

A lista «Procuras e grupos» usa o mesmo `OpportunityCard` + `RouteIndicator` do feed. Sem segundo cartão, sem sheet de proposta, sem schema.

## Reutilizado

- `OpportunityCard` e `resolveOpportunityCard` (página Figma `78:2`, frames `78:6` e `78:25`).
- `RouteIndicator` quando origem e destino existem.
- CTA do hub continua a abrir o sheet já montado (`driver-propor-sheet`). Não se monta `OpportunityProposalSheet`.

## Comportamento

- OD real → `RouteIndicator`. Nunca as palavras «Origem» ou «Destino» no lugar de uma rota em falta.
- Procura sem OD não inventa rota nem o título «Disponível para acordos» (esse título fica na oferta flexível, já no modelo do cartão).
- «Sem compatibilidade com esta oferta» é contexto do hub no mesmo cartão e desliga o CTA.
- Seta horizontal, «Individual» e o preço na mesma fila do botão saem. O preço da oferta seleccionada fica no rodapé, à esquerda do CTA.
- «Proposta enviada» continua a desligar o CTA. Lista de espera sem CTA directo.
- Softs fora: fade cap, chave de horário, `n_candidato` 0/null, tecto do stepper, buraco de OD vazio.

## Fora

- Explorar, PR #185, stepper do passageiro, cabeçalho, ficheiros do sheet de proposta.
