---
name: boleia-ui-designer
description: Desenha UI/UX Boleia com Stitch + UI Skills sync, shadcn e Mobbin free-safe. v0 só fallback. Use antes de implementar ecrãs ou componentes novos.
---

# UI Designer Boleia

## Contexto visual

Luanda, boleias casa–trabalho, moeda **Kz**, tom urbano/utilitário — nunca turismo.

## Passos

1. Confirmar requisitos/estados a partir do Spec (`tlc-spec-driven`).
2. **UI Skills MCP (obrigatório primeiro):** `list_skills` / `get_skill` (mín. `ibelick/baseline-ui`). Extrair constraints (spacing, hierarquia, tipografia, a11y) para o prompt.
3. **Mobbin (free-safe, opcional):** `search_screens` ou `search_flows` com `platform: "web"`, `mode: "standard"`, `limit` ≤ 5. Se falhar por plano → continuar e anotar.
4. **Stitch (gerador SoT):** seguir `.cursor/skills/boleia-stitch/SKILL.md`:
   - **Project Resolution Protocol** (obrigatório): `metadata.json` → senão `list_projects` → se vazio `create_project(title: "Boleia Certa")` sem confirmação → persistir `projectId`. Reutilizar o projecto canónico; novos ecrãs = screens no mesmo projecto.
   - Ler `skills/enhance-prompt` (+ `.stitch/DESIGN.md` se existir)
   - MCP `user-stitch`: `generate_screen_from_text` / `edit_screens` com o `projectId` resolvido; actualizar `.stitch/metadata.json` / designs
   - Opcional: `skills/design-md` se design system em falta
5. **shadcn MCP:** search/view → listar primitivos a adicionar; preferir reutilizar `src/components/ui/`.
6. **v0 via One — só fallback** se Stitch MCP indisponível/auth falhou ou utilizador pedir. **Nunca** por `list_projects` vazio. Se usado: anti-plano-só (Send Message a construir UI).
7. Escrever artefacto curto (ex. `.specs/.../design.md`): flow, estados, componentes shadcn, project/screen id Stitch, notas UI Skills/Mobbin.

## Saída

```text
VERDICT: APPROVE | REJECT
ISSUES:
- ...
NEXT: (se incompleto) o que falta para gate design pronto
```

Gate **APPROVE** só com: flow + estados + componentes shadcn identificados + artefacto/ecrã Stitch + `projectId` resolvido/persistido + evidência de consulta UI Skills (antes do generate).

Gate **REJECT** se: MCP Stitch está ok mas o agente saltou Stitch (lista vazia ignorada, sem `create_project`, sem ecrã/artefacto) ou caiu em v0 só porque não havia projectos.
