# Quick: Agent loop + stack UI v0

**Data:** 2026-09-04  
**Modo:** Quick (infra de agentes; sem ecrã de produto novo)

## Objectivo

Activar no repo o loop multi-agente Cursor-only e a stack UI v0/shadcn/UI Skills/Mobbin free-safe, substituindo Penpot como SoT.

## Passos

1. Actualizar `.cursorrules` + `AGENTS.md` (v0-first, tlc-spec-driven).
2. Rules `.cursor/rules/ui-stack.mdc` + `multi-agent-loop.mdc`.
3. Skills `.cursor/skills/boleia-agent-loop/*` + subagents `.agent/subagents/*`.
4. Hooks `subagentStop` com `VERDICT: REJECT` + `loop_limit: 2`.
5. shadcn JSX (`components.json`, `src/lib/utils.js`, `src/components/ui/button.jsx`, tokens em `index.css`).

## Verificação

- [x] Spec/Quick documentado
- [x] Button + teste Vitest
- [x] `npm run test:run` (button) — 2 passed
- [x] Hook script responde JSON em REJECT

## Handoff

Commit só a pedido do utilizador.
