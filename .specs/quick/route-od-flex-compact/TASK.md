# Quick Task: RouteOdRow flex compacto + fade condicional

**Date:** 2026-09-09
**Status:** Done
**Follow-up de:** `.specs/quick/route-od-arrow-center/`

## Description

A grelha 1fr/1fr com truncagem a 2 linhas desalinha a seta Origem→Destino quando um lado é curto e o outro longo. Passar a flex row compacto de 1 linha, com fade horizontal só quando há overflow real.

## Files

- `src/components/RouteOdRow.jsx` / `.test.jsx`
- `src/index.css` (utilitária `.truncate-fade-x` + `.is-truncated`)
- `src/components/OfertaMatchCard.jsx` (+ test se necessário)
- `src/pages/DriverDashboard.jsx` (border-t no preço das procuras)
- `src/pages/PassengerDashboard.jsx` / `src/components/GrupoDescobertaPanel.jsx` (shrink-0 nos chips se necessário)

## Approach

Flex `[origem text-end max~44%] [seta shrink-0] [destino text-start max~44%]` com `w-fit max-w-full`; medir overflow via ref + ResizeObserver; máscara só com `.is-truncated`. Sem `TruncatedText` neste primitivo.

## Verify

- Vitest `RouteOdRow`: 1 linha, `title`, `is-truncated` condicional, seta `shrink-0`
- Browser max-w-md: curto/curto, curto/longo, longo/longo — seta estável; fade só com corte; badge não espremida
- UI QA + code-reviewer VERDICT APPROVE
- Sem commit automático

## Commit (quando pedires)

`fix(ui): RouteOdRow flex compacto com fade condicional`
