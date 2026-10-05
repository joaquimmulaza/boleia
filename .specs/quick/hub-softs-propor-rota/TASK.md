# Quick: softs da review #201 + aviso ao propor rota diferente

**Date:** 2026-10-05
**Status:** Done

## Description

Um PR com os softs da review do #201 e o lock de produto «avisar e deixar seguir» quando «Propor acordo» no Explorar usa uma procura activa cuja rota (origem/destino) não é compatível com a oferta. Sem migrações.

## Approach

Reutilizar `acordoBloqueiaApagarGrupo`, o raio OD de `matchingFilters`, `ConfirmationModal` e o kebab existente. Não inventar transferência de dono: `leave_grupo_membro` só marca o membro `saiu` e actualiza `n_candidato`.

## Decisão — dono / Sair

O painel no hub só monta a procura do próprio passageiro (`PassengerDashboard` → `GrupoProcuraPanel`). Um colega que entrou no grupo de outra procura não abre este painel. O ramo «membro: só Sair» já funciona quando o painel é renderizado com `userId` diferente do dono (testes do painel); não há segundo ecrã de grupo no produto.

`leave_grupo_membro` não transfere `procuras.owner_id` (não existe transferência no schema/RPC). Depois de Sair, o dono deixava de ser membro activo mas `resolveGrupoPapel` continuava a tratá-lo como dono por `owner_id`, e o kebab mantinha Editar. A correcção: dono só conta se ainda for membro activo. Sem membro activo, o kebab some (Editar, Apagar, Sair e convite). Não se inventa transferência.

## Decisão — CI e ENG34-3

`vite.config.js` não exclui testes. O include por omissão do Vitest apanha `src/pages/PacoteEng34Acceptance.test.jsx`. `npx vitest run src/pages/PacoteEng34Acceptance.test.jsx -t ENG34-3` falha no `main` (não encontra «Fazer contra-proposta»).

Os checks do #201 são só `Vercel Preview Comments` (success) e `Supabase Preview` (skipped). Não há `.github/workflows` nem job que corra Vitest. O CI fica verde porque não corre testes nenhum, não porque esta suite esteja excluída. Não se adiciona workflow neste PR: isso puxaria o ENG#34 (e a suite inteira) para um job novo, fora da lista. A frase do #201 que apresentava o ENG34-3 como excluído do CI não se repete.

## Gate «Propor acordo»

Só no feed Explorar (`proporNoFeed`), com procura activa. Ofertas compatíveis no separador «A minha procura» continuam a ir directas para a folha. Oferta flexível (`flexibilidade_rota`) é compatível em rota, como `evaluateMatch` — não pede aviso mesmo sem OD. Oferta fixa sem OD completo, ou procura sem OD completo, é incompatível e mostra o aviso. Confirmar abre a folha actual; enviar continua no «Confirmar proposta». Cancelar não abre a folha nem cria proposta.

## Nota de produto — pedidos pendentes depois do dono sair

Não se altera agora. `leave_grupo_membro` não transfere a posse. Depois de o dono sair, ninguém vê os pedidos de entrada pendentes: o painel do hub só abre a procura do próprio passageiro e já não há dono membro para os aprovar.

## Files

- `src/utils/grupoKebab.js` + teste
- `src/utils/matchingFilters.js` + teste
- `src/utils/proporRotaAviso.js` + teste
- `src/services/GrupoService.js` + teste
- `src/components/GrupoProcuraPanel.jsx` + teste
- `src/pages/PassengerDashboard.jsx` + teste
- `AGENTS.md`, `.specs/project/STATE.md`

## Fora

Softs/G3/G4/Pack B, marketing `/explorar`, migrações, correcção do ENG34-3, workflow de CI novo.
