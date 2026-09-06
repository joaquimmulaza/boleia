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
6. **One-project:** um projecto Stitch canónico por produto («Boleia Certa»). Lista vazia **nunca** justifica ignorar Stitch — ver Project Resolution Protocol.

## Artefactos locais

```
.stitch/
  DESIGN.md        # SoT semântico para prompts Stitch
  SITE.md          # visão / roadmap / project id (se stitch-loop)
  metadata.json    # projectId + screens map (obrigatório após resolver projecto)
  designs/         # {page}.html + {page}.png
  next-prompt.md   # baton opcional (stitch-loop)
```

### Schema mínimo `.stitch/metadata.json`

```json
{
  "projectId": "4044680601076201931",
  "title": "Boleia Certa",
  "screens": {},
  "updatedAt": "2026-09-06T00:00:00.000Z"
}
```

- `projectId` — ID sem prefixo `projects/` (formato exigido por `generate_screen_from_text`).
- `screens` — mapa `{ "slug": { "id", "title", … } }` actualizado após cada `get_project` / generate.
- Persistir sempre após `create_project` ou escolha de projecto existente.

## Project Resolution Protocol (obrigatório)

Antes de qualquer `generate_screen_from_text` / `edit_screens` numa tarefa UI real:

1. Se `.stitch/metadata.json` tem `projectId` válido → usar esse; opcionalmente `get_project` / `list_screens` para verificar.
2. Senão → `list_projects` (`view=owned`).
3. **Lista vazia** → `create_project(title: "Boleia Certa")` **sem pedir confirmação**; gravar `projectId` + `title` em `.stitch/metadata.json`.
4. **Há projectos** → escolher nesta ordem: (a) o de `metadata.json` se ainda existir; (b) título exactamente «Boleia Certa»; (c) o owned mais recente → actualizar `metadata.json`.
5. Gerar/editar ecrãs **no mesmo projecto**. Micro-ajustes (copy, spacing) → `edit_screens` no screen existente, sem novo projecto.

### Quando criar um *segundo* projecto Stitch

Só se: (1) o utilizador pedir explicitamente; (2) sandbox/experimento visual isolado; ou (3) superfície de produto distinta (ex. admin vs app). **Não** criar um projecto por feature/ecrã/task.

### Proibido

- `list_projects` vazio → ignorar Stitch / inventar UI / cair em v0 só por isso.
- Criar um projecto Stitch por task.
- Tratar «falta de confirmação» como bloqueio do SoT.
- Smoke dry-run sem ecrã-alvo pode omitir `generate_screen_from_text`, mas **não** documentar «evitar `create_project`» como boa prática em tarefa UI real.

### Fallback v0

Só se MCP Stitch indisponível, erro de auth, ou utilizador pedir explicitamente. **Nunca** por lista de projectos vazia.

## Protocolo mínimo (ecrã novo)

1. Spec OK → UI Skills `get_skill`
2. **Project Resolution Protocol** → `projectId` em `.stitch/metadata.json`
3. `enhance-prompt` com DESIGN.md + constraints UI Skills + briefing Boleia
4. `user-stitch`: `generate_screen_from_text` (ou `edit_screens`) com o `projectId` resolvido
5. `get_screen` → guardar assets em `.stitch/designs/`; actualizar `screens` em `metadata.json`
6. Mapear para shadcn + gate design → TDD implementer
7. UI QA: UI Skills de novo + comparar screenshot Stitch

## MCP tools (namespace `user-stitch`)

`list_projects`, `create_project`, `get_project`, `list_screens`, `get_screen`, `generate_screen_from_text`, `edit_screens`, `generate_variants`, `create_design_system`, `upload_design_md`, `apply_design_system`, …
