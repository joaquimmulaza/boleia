---
name: boleia-orchestrator
description: Orquestra tarefas Boleia Certa — Spec-Driven, paralelismo e papéis UI/código. Use em qualquer tarefa nova, feature, CreatePlan ou «Implement the plan».
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

## Bridge Plan mode

CreatePlan = artefacto de **planeamento**. Execute = **despacho de papéis** (este skill). O plano Cursor não dispensa Spec nem gates VERDICT.

### Template mínimo de todos no CreatePlan

| Tipo de tarefa | Todos obrigatórios no plano |
|----------------|----------------------------|
| UI / UX / ecrãs | Spec/Quick → ui-designer (+ Stitch Project Resolution) → gate design → implementer → ui-qa → code-reviewer |
| Lógica / serviço (`src/`) | Spec/Quick → implementer → code-reviewer |
| Só docs / rules / skills (sem `src/`) | Implementar alterações → code-reviewer leve (consistência); sem Stitch/ui-qa; Spec opcional |
| Só leitura / explicação | Sem todos de implementação |

Ao receber «Implement the plan»: se o plano omitiu papéis da tabela, **completar o loop** na mesma (todos de sessão + `Task` para revisores).

## Despacho

| Tipo | Sequência |
|------|-----------|
| UI/UX | ui-designer (UI Skills → Stitch/`boleia-stitch`) → gate design → implementer → ui-qa + code-reviewer (paralelo se scopes OK) |
| Só lógica/serviço | implementer → code-reviewer |
| Só docs/rules/skills | implementar → code-reviewer leve |
| Exploração / arquitectura | **Graphlore primeiro:** `graphlore_overview` ou `graphlore_freshness`, depois `search` → `subgraph`/`neighbors`/`node_details`. Grep só se o mapa não bastar (`.cursor/rules/graphify.mdc`). Sem Spec se não houver mudança. |

Ler o `SKILL.md` do papel correspondente em `.cursor/skills/boleia-agent-loop/<papel>/` e incluir as instruções no prompt do `Task`. Em UI, incluir também `.cursor/skills/boleia-stitch/SKILL.md`.

**Revisores** (`ui-qa`, `code-reviewer`): preferir `Task` (não só checklist inline) para o hook `subagentStop` processar `VERDICT: REJECT`.

## Gates

- **Design pronto:** flow + estados + componentes shadcn + ecrã/artefacto Stitch + consulta UI Skills documentada. (v0 só se fallback.)
- **Código:** `VERDICT: APPROVE` de code-reviewer (+ ui-qa se UI) e `npm run test:run` / lint quando aplicável.
- REJECT → reenviar ao papel indicado em `NEXT` (máx. 2 ciclos); depois perguntar ao utilizador.

## Saída

Checklist:

- [ ] Spec/Quick em `.specs/` (se aplicável)
- [ ] `VERDICT: APPROVE` de code-reviewer (e ui-qa se UI) quando houve mudança em `src/` ou UI
- [ ] Resumo + paths tocados
- [ ] Handoff de commit (mensagem sugerida + `git status`) — **não** commit sem pedido explícito
- [ ] Se Mobbin MCP falhou por plano free: mencionar no handoff
