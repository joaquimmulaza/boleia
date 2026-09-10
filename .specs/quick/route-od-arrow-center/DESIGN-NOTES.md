# Design notes — Centrar seta OD

## UI Skills consultadas (2026-09-09)

- `ibelick/baseline-ui` — polish de layout; `cn`; sem animação de layout; tokens existentes.
- `pbakaus/layout` — Operate+Read: estrutura previsível; `gap` para ritmo entre origem/seta/destino; correcção óptica só após render.
- `jakubkrehel/better-layout` — alinhar a arestas partilhadas; propriedades lógicas (`text-end` / `text-start`); planear clipping/crescimento de texto.

## Padrão visual

```
[origem text-end] [seta self-center] [destino text-start]
minmax(0,1fr) | auto | minmax(0,1fr)
```

- Origem cresce em direcção à seta; destino afasta-se da seta.
- Seta no eixo geométrico do par OD e na altura do bloco mais alto (`items-center` + `self-center`).
- Badge («Publicada», etc.) fica **fora** da grelha, irmão flex com `shrink-0`; `RouteOdRow` no item flex usa `min-w-0 flex-1`.
- Truncagem 2 linhas + fade + `title` inalterados (sem `height`/`min-height` forçados).
- Sem ecrã Stitch novo: micro-ajuste do primitivo `RouteOdRow` já gated na truncagem OD.

## Stitch (Project Resolution)

- Projecto canónico: **Boleia Certa** `8575463146283895778`
- Ecrãs existentes: rescisão/detalhe de acordo — **nenhum** card de marketplace/OD.
- Sem `edit_screens` (não há ecrã de card); sem `generate_screen_from_text` (não é ecrã novo).
- Persistido `projectId` em `.stitch/metadata.json` (gitignore local).

## Componentes

- Reutilizar `RouteOdRow` + `TruncatedText` + `ArrowRight` (Lucide). Sem primitivo shadcn novo.

## Gate design

Flow: lista de cards (hub motorista, matches, grupos) — estados 1/1, 1/2, 2/2 linhas + badge opcional.
Estados: vazio/loading não tocados.

VERDICT: APPROVE
NEXT: implementer (TDD RouteOdRow)
