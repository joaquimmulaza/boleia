---
name: boleia-agent-loop
description: Loop multi-agente Boleia (orchestrator, ui-designer, implementer, ui-qa, code-reviewer). Use com tlc-spec-driven e subagent-creator; também ao criar/executar planos Cursor (Plan mode / CreatePlan / Implement the plan).
---

# Boleia Agent Loop

Skills por papel (ler a relevante):

- `orchestrator/SKILL.md` — Spec + despacho + gates + **bridge Plan mode**
- `ui-designer/SKILL.md` — Stitch + UI Skills sync / shadcn / Mobbin; v0 fallback
- `implementer/SKILL.md` — TDD + JSX
- `ui-qa/SKILL.md` — VERDICT UI (+ fidelidade Stitch)
- `code-reviewer/SKILL.md` — VERDICT código

Sempre: `.cursor/skills/tlc-spec-driven` em tarefa nova; `.cursor/skills/subagent-creator` para paralelismo; UI → também `.cursor/skills/boleia-stitch`.

**Plan mode:** CreatePlan / «Implement the plan» **não** substituem este loop. Ver secção Plan mode em `.cursor/rules/multi-agent-loop.mdc` e Bridge Plan mode no orchestrator — injectar todos de workflow no plano; na execução, despachar papéis (revisores via `Task`) até `VERDICT: APPROVE`.
