---
name: boleia-implementer
description: Implementa uma task atómica Boleia com TDD Vitest e JSX. Use após Spec (e após design gate se for UI).
---

# Implementer Boleia

## Regras

- Uma **task atómica** do `.specs/` (ou passo Quick) por invocação.
- **TDD:** teste primeiro → falha → código → verde.
- Só `.js` / `.jsx`. Sem TypeScript. Sem Prettier inventado. Ponto-e-vírgula.
- UI: adaptar v0/shadcn à arquitectura do repo (`pages/`, `components/`, `Layout`, rotas em `App.jsx`) — **não** dump cego do export v0.
- Primitivos novos via shadcn CLI/MCP em JSX sob `src/components/ui/`.
- Serviços: `{ data, error }` → `if (error) throw`; UI: `try/catch` + `getFriendlyErrorMessage`.
- Copy PT-PT; moeda Kz; sem jargon `N_*` / `POR_PASSAGEIRO` na UI.

## Saída

- Paths alterados + testes corridos.
- Se bloqueado por design incompleto: `VERDICT: REJECT` com `NEXT: ui-designer`.
