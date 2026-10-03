# Quick Task: Explorar autenticado abre o detalhe no corpo

**Date:** 2026-10-03
**Status:** Done

## Plano

No Explorar do passageiro autenticado (`PassengerDashboard`, feed browse sem procura) o `OpportunityCard` já está montado, mas só recebe `onCta`. O toque no corpo não abre nada. Em `/explorar` anónimo o mesmo cartão já abre `OpportunityDetailSheet` (PR #182) via `onOpen`.

Ligar o mesmo `onOpen` → `OpportunityDetailSheet`. O CTA «Propor acordo» continua a abrir `OpportunityProposalSheet`. Anónimo não muda: corpo abre o detalhe, CTA vai para `/auth` com a cópia «Propor acordo».

## Fora

- Hub do motorista, lista e folha de proposta em voo.
- Reconstruir o detalhe. Schema, migração.
- Fade, chave de horário, `n_candidato` 0/null, tecto do stepper, buraco de OD vazio, wordmark do cabeçalho, stepper do passageiro.

## Verification

- [x] Autenticado: corpo abre `opportunity-detail-sheet` e não a proposta.
- [x] Autenticado: CTA abre `opportunity-proposal-sheet` e não o detalhe.
- [x] Autenticado: o CTA do detalhe abre a proposta e fecha o detalhe.
- [x] Anónimo: corpo abre o detalhe.
- [x] Anónimo: CTA «Propor acordo» navega para `/auth`.
