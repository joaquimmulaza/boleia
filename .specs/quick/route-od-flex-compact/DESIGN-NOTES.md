# Design notes — RouteOd flex compact + fade condicional

## UI Skills consultadas (2026-09-09)

- `ibelick/baseline-ui` — `cn`; tipografia densa; tokens existentes; sem animação de layout; **excepção pedida:** fade via `mask-image` (não reticências / não gradiente decorativo).
- `pbakaus/layout` — Operate+Read: grupo OD como unidade; `gap` para ritmo; clip/crescimento de texto planeado; correcção óptica após render.

## Padrão visual (alvo)

```
[origem text-end 1 linha max~44%] [seta shrink-0 self-center] [destino text-start 1 linha max~44%]
flex row · w-fit max-w-full · badge fora (shrink-0)
```

- Fade horizontal só com classe `is-truncated` (`scrollWidth > clientWidth`).
- Meta card: ícones Lucide Clock/Users (sem emoji); `border-t` antes do preço.
- Tokens: classes já nos cards (`rounded-xl`, `p-5`, `gap-2`/`gap-3`, `text-slate-*`, `primary`, `border-slate-*`) + design system Stitch Urban Commuter Utility.

## Stitch

- Projecto: **Boleia Certa** `8575463146283895778`
- Ecrã: `ofertas-compativeis-od-flex` → `19eb9112bf1947bfbaca6d053097d5d2` («Ofertas compatíveis (Linha OD Corrigida)»)
- Assets: `.stitch/designs/ofertas-compativeis-od-flex.png` / `.html`
- 3 variantes OD: curto/curto, curto/longo, longo/longo; 1 linha; fade mask; badge Publicada
- Gate design: APPROVE (estrutura alvo documentada + ecrã Stitch + UI Skills)

## Componentes

- `RouteOdRow` (sem `TruncatedText`); Lucide `ArrowRight`
- `TruncatedText` + `.truncate-fade-y*` mantidos para pickup/autocomplete
- Sem primitivo shadcn novo

VERDICT: APPROVE
NEXT: implementer (TDD RouteOdRow)
