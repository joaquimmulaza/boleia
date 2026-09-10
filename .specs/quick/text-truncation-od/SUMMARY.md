# SUMMARY — Truncagem OD

## Feito

- Primitivos `TruncatedText` + `RouteOdRow` (TDD)
- Utility CSS `.truncate-fade-y` / `-y-1|2|3` em `index.css` — **sem** Tailwind `line-clamp` (evita reticências secas); altura fixa N linhas + `mask-image`
- `RouteOdRow`: grelha `minmax(0,1fr)|auto|minmax(0,1fr)`, origem `text-end`, destino `text-start`, seta `self-center`
- Wire P0/P1 conforme inventário
- Correção UX (2026-09-09): removeu `line-clamp-*` que forçava `...` de 1 linha

## Decisão UX

2 linhas + fade mask + `title` nativo; sem «Ver mais» / Tooltip library; gap claro origem/seta/destino.
