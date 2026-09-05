---
name: boleia-stitch
description: Ponte Boleia para skills Stitch em skills/ + MCP user-stitch, sincronizada com UI Skills. Use em qualquer geração/edição de ecrã UI/UX.
---

# Boleia Stitch Bridge

Ponte entre o MCP **Stitch** (`user-stitch`), o MCP **UI Skills** (`user-UI Skills MCP`) e as skills vendor em `C:\boleia-certa\skills\`.

## Skills vendor (ler sob demanda)

| Skill | Path | Uso |
|-------|------|-----|
| enhance-prompt | `skills/enhance-prompt/SKILL.md` | Polir prompt antes de `generate_screen_from_text` |
| design-md | `skills/design-md/SKILL.md` | Sintetizar `.stitch/DESIGN.md` a partir de ecrãs Stitch |
| stitch-loop | `skills/stitch-loop/SKILL.md` | Loop baton (SITE.md / next-prompt) — adaptar a app Vite, não site estático Next |
| react-components | `skills/react-components/SKILL.md` | Converter HTML Stitch → componentes — **ver overrides abaixo** |
| shadcn-ui | `skills/shadcn-ui/SKILL.md` | Primitivos shadcn alinhados ao registry |

## Overrides obrigatórios Boleia

1. **Sem TypeScript** — saída só `.js` / `.jsx` + JSDoc. Ignorar templates `.tsx` / `Props` TS do vendor.
2. **Stack:** React 19 + Vite + Tailwind 4 + shadcn em `src/components/ui/` + tokens `src/index.css`.
3. **Shell:** mobile-first `max-w-md` / `max-w-[480px]`; moeda **Kz**; tom urbano Luanda — nunca turismo.
4. **UI Skills sync:** antes de qualquer `generate_screen_from_text` / `edit_screens`, chamar `list_skills` / `get_skill` (mín. `ibelick/baseline-ui`) e injectar constraints no prompt.
5. **Proibido** copiar HTML Stitch directo para `src/`. Mapear para primitivos shadcn + padrões existentes (`pages/`, `layouts/Layout.jsx`).
6. **Não** criar projectos Stitch em massa sem confirmação do utilizador.

## Artefactos locais

```
.stitch/
  DESIGN.md        # SoT semântico para prompts Stitch
  SITE.md          # visão / roadmap / project id (se stitch-loop)
  metadata.json    # projectId + screens map
  designs/         # {page}.html + {page}.png
  next-prompt.md   # baton opcional (stitch-loop)
```

## Protocolo mínimo (ecrã novo)

1. Spec OK → UI Skills `get_skill`
2. `enhance-prompt` com DESIGN.md + constraints UI Skills + briefing Boleia
3. `user-stitch`: `list_projects` / `create_project` (se confirmado) → `generate_screen_from_text`
4. `get_screen` → guardar assets em `.stitch/designs/` (scripts em `skills/react-components/scripts/` se úteis)
5. Mapear para shadcn + gate design → TDD implementer
6. UI QA: UI Skills de novo + comparar screenshot Stitch

## MCP tools (namespace `user-stitch`)

`list_projects`, `create_project`, `get_project`, `list_screens`, `get_screen`, `generate_screen_from_text`, `edit_screens`, `generate_variants`, `create_design_system`, `upload_design_md`, `apply_design_system`, …
