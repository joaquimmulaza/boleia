# Quick Task: Grupos abertos hidratam pedido pendente

**Date:** 2026-10-05
**Status:** Done

## Description

Depois de refresh, um grupo em que o passageiro já tem pedido `pendente` em `membros_grupo` volta a mostrar «Pedir entrada». O Set local `enviados` nasce vazio. O rótulo «Pedido enviado» já existe no mesmo painel.

## Approach

`listGruposAbertos({ passengerId })` lê os `grupo_id` com `estado = 'pendente'` desse passageiro e marca `pedido_pendente` sem retirar o grupo da lista. `GrupoDescobertaPanel` semeia `enviados` com essa marca antes de mostrar o CTA. Sem `passengerId`, a lista fica como hoje. Sem schema.

## Files

- `src/services/GrupoService.js` — marca pedidos pendentes do passageiro
- `src/services/GrupoService.test.js` — contrato da query
- `src/components/GrupoDescobertaPanel.jsx` — hidrata o CTA no carregamento
- `src/components/GrupoDescobertaPanel.test.jsx` — comportamento após refresh

## Commit

`da992b2` — fix(grupos): hidratar pedido pendente nos grupos abertos

## Verification

- [x] Com pedido pendente, o CTA é «Pedido enviado» e `pedirEntradaGrupo` não é chamado.
- [x] Grupo sem pedido mantém «Pedir entrada» e o envio actual.
- [x] Sem `passengerId`, não consulta `membros_grupo`.
