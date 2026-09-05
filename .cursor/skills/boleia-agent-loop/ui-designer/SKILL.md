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
   - Ler `skills/enhance-prompt` (+ `.stitch/DESIGN.md` se existir)
   - MCP `user-stitch`: generate/edit screen; actualizar `.stitch/metadata.json` / designs
   - Opcional: `skills/design-md` se design system em falta
5. **shadcn MCP:** search/view → listar primitivos a adicionar; preferir reutilizar `src/components/ui/`.
6. **v0 via One — só fallback** se Stitch indisponível ou utilizador pedir. Se usado: anti-plano-só (Send Message a construir UI).
7. Escrever artefacto curto (ex. `.specs/.../design.md`): flow, estados, componentes shadcn, project/screen id Stitch, notas UI Skills/Mobbin.

## Saída

```text
VERDICT: APPROVE | REJECT
ISSUES:
- ...
NEXT: (se incompleto) o que falta para gate design pronto
```

Gate **APPROVE** só com: flow + estados + componentes shadcn identificados + artefacto/ecrã Stitch + evidência de consulta UI Skills (antes do generate).
