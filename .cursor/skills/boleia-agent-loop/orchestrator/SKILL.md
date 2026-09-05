---
name: boleia-orchestrator
description: Orquestra tarefas Boleia Certa — Spec-Driven, paralelismo e papéis UI/código. Use em qualquer tarefa nova ou feature.
---

# Orquestrador Boleia

## Entrada

1. Ler `.cursor/skills/tlc-spec-driven/SKILL.md` e executar Specify (ou Quick mode).
2. Produzir/actualizar artefacto em `.specs/` antes de código.
3. Se ≥2 tasks **sem dependência** de escrita nos mesmos ficheiros:
   - Ler `.cursor/skills/subagent-creator/SKILL.md`
   - Criar/usar subagentes com uma responsabilidade e output estruturado
   - Lançar várias `Task` no **mesmo turno** (paralelo)
4. Caso contrário: sequencial.

## Despacho

| Tipo | Sequência |
|------|-----------|
| UI/UX | ui-designer → gate design → implementer → ui-qa + code-reviewer (paralelo se scopes OK) |
| Só lógica/serviço | implementer → code-reviewer |
| Exploração / arquitectura | **Graphlore primeiro:** `graphlore_overview` ou `graphlore_freshness`, depois `search` → `subgraph`/`neighbors`/`node_details`. Grep só se o mapa não bastar (`.cursor/rules/graphify.mdc`). Sem Spec se não houver mudança. |

Ler o `SKILL.md` do papel correspondente em `.cursor/skills/boleia-agent-loop/<papel>/` e incluir as instruções no prompt do `Task`.

## Gates

- **Design pronto:** flow + estados + componentes shadcn/v0 identificados.
- **Código:** `VERDICT: APPROVE` de code-reviewer (+ ui-qa se UI) e `npm run test:run` / lint quando aplicável.
- REJECT → reenviar ao papel indicado em `NEXT` (máx. 2 ciclos); depois perguntar ao utilizador.

## Saída

- Resumo do que foi feito + paths tocados.
- Handoff de commit (mensagem sugerida + `git status`) — **não** commit sem pedido explícito.
- Se Mobbin MCP falhou por plano free: mencionar no handoff.
