# Design notes — Truncagem OD

## UI Skills (ibelick/baseline-ui)

- Tipografia densa: truncagem multi-linha **sem** Tailwind `line-clamp` (esse utility força reticências).
- Sem animação de altura («Ver mais»).
- `title` nativo para texto completo (sem Radix Tooltip novo).
- Fade via `mask-image` (pedido explícito; não é gradiente decorativo purple).

## Padrão visual (corrigido 2026-09-09 + seta 2026-09-09)

- OD: `RouteOdRow` — grid `minmax(0,1fr) | auto | minmax(0,1fr)` + 2× `TruncatedText` (`.truncate-fade-y-2`).
- Origem `text-end`, destino `text-start`, seta `self-center` (eixo geométrico H+V).
- **Só `max-height`** (N linhas) — **sem** `height`/`min-height` forçados.
- Colunas de texto com `min-w-0`; coluna da seta `shrink-0 self-center flex items-center justify-center`.
- `mask-image` no fundo da caixa; `text-overflow: clip` (sem `...`).
- Layout: `gap-2`, `items-center`, `w-full`.
- Pickup / autocomplete: mesmo `TruncatedText` com tipografia via `className`.
- Follow-up: `.specs/quick/route-od-arrow-center/`.

## Gate design

Micro-polish em cards existentes — sem ecrã Stitch novo (plano).

VERDICT: APPROVE
