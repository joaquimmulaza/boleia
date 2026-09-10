# Quick Task: Centrar seta Origem→Destino

**Date:** 2026-09-09
**Status:** Done
**Follow-up de:** `.specs/quick/text-truncation-od/`

## Description

A seta Origem→Destino em `RouteOdRow` era empurrada quando um texto tinha mais linhas ou caracteres que o outro. Corrigida a centragem horizontal e vertical sem alterar truncagem, fade, copy nem o badge do card.

## Files Changed

- `src/components/RouteOdRow.jsx` — grelha `minmax(0,1fr) | auto | minmax(0,1fr)`; origem `text-end`; destino `text-start`; seta `self-center`
- `src/components/RouteOdRow.test.jsx` — TDD do padrão de alinhamento
- `src/components/OfertaMatchCard.jsx` — `min-w-0 flex-1` no item flex ao lado do badge
- `src/components/OfertaMatchCard.test.jsx` — asserção `min-w-0 flex-1` no browse

## Verification

- [x] Testes Vitest de `RouteOdRow` a verde
- [x] Browser: hub passageiro (matches + grupos) — casos 1/1, 1/2 e 2/2 linhas; `dx`/`dy` = 0
- [x] Badge «Publicada» permanece à direita, fora da grelha OD
- [x] UI QA VERDICT APPROVE
- [x] Code reviewer VERDICT APPROVE

## Commit

(pendente — só quando o utilizador pedir)

`fix(ui): centrar seta origem-destino em RouteOdRow`
