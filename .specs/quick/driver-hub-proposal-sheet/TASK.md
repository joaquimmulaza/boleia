# Quick Task: Sheet de proposta no hub do motorista

**Date:** 2026-10-03
**Status:** Done

## Plano

Quick Task: montar `OpportunityProposalSheet` no hub do motorista, só para procura e para grupo.
Files: `src/pages/DriverDashboard.jsx`, `src/pages/DriverDashboard.test.jsx`, `src/test/confirmPropostaSheet.js`, `src/pages/PacoteEng30Acceptance.test.jsx`
Approach: reutilizar o sheet e `resolveOpportunityProposal`. Não os reconstruir. O CTA do cartão abre o sheet com N snapshot e o preço da oferta seleccionada.
Verify: testes do hub (procura N=1, grupo × N só em por passageiro, total do acordo num preço, sem stepper, frase do número fixo) e prova visual dos frames 90:77 e 90:43.

Design já aprovado (Critiquito): Figma `OUrBNaukPsXB14x2nwGSJy` nodes `90:77` (procura) e `90:43` (grupo). Sem Stitch novo.

## Fora

- Lista do hub, `OpportunityCard`, Explorar, stepper do passageiro, CTA anónimo, cabeçalho.
- Softs: fade cap, chave de horário, `n_candidato` 0/null, tecto do stepper, buraco de OD vazio no cartão.
- Schema, migração, contrato Supabase.
- Contra-proposta e o sheet sem preço (oferta ainda não existe) — continuam a recolher o valor.

## Verification

- [x] Procura N=1: total igual ao preço por passageiro, sem stepper, com a frase do número fixo.
- [x] Grupo: N multiplica só em por passageiro; total do acordo fica um preço, sem × N.
- [x] «Sem compatibilidade com esta oferta» mantém-se e não abre o sheet.
