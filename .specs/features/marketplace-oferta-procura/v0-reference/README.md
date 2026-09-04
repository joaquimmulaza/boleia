# Referência visual v0 — Marketplace mobile

**Chat v0:** https://v0.app/chat/cYa4j7gxE0p  
**Preview build:** https://boleia-certa-marketplace-mobile-ui.v0.build (pode exigir sessão v0)  
**Gerado:** 4 Set 2026 via One MCP (`v0-pro`)  
**Skill UI:** `mengto/design-first-ui-prompting` + baseline-ui constraints

## O que mudou vs wireframes Penpot

| Antes (horrível) | Depois (v0) |
|------------------|-------------|
| Labels técnicos (`N_candidato`, `POR_PASSAGEIRO`) | Copy humana PT-PT |
| Campos cinzentos sem hierarquia | Cards, chips, rotas Talatona→Mutual |
| Sem brand mark | Header `B·C` + título |
| CTA genérico | CTAs contextuais (Ver propostas, Propor acordo, …) |

## Ficheiros

- `app__page.tsx` — 8 vistas + screen switcher
- `app__globals.css` — tokens e componentes CSS
- `app__layout.tsx` — metadata PT-PT

## Notas de implementação (repo Boleia Certa)

- Stack do repo: **JSX** (não copiar TypeScript do sandbox v0 para `src/`)
- Reutilizar `Layout`, `PageShell`, `PageHeader`, Lucide
- Penpot continua SoT de consolidação — **reimportar estes ecrãs** quando o plugin estiver ligado (substituir boards `MKT — *` antigos)
- Gate UI: validar no browser contra este protótipo + Penpot actualizado
