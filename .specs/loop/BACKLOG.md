# Backlog loop (actualizado 2026-09-07)

## Top 3

1. **seat-before-custody** — Assento/`N_activos` não deve consumir capacidade definitiva antes de `em_custodia` — tipo: eng — DoD: spec + RPC/UI alinhados a anti-leakage — deps: merge #99
2. **falta-ida-regresso-policy** — Decidir e alinhar desconto ida/regresso (código meia quota vs contrato «só ambas») — tipo: eng — DoD: decisão em STATE + trigger/UI — deps: decisão produto
3. **admin-polish-critiquito** — Polish UX `/admin/pagamentos` — tipo: ui — DoD: Critiquito — deps: opcional

## Quiet?

- não — PR #99 aguarda merge humano; depois #1 eng = seat-before-custody

HANDOFF:
FROM: orchestrator
TO: human
STATUS: NEED_HUMAN
ARTIFACT: .specs/loop/TICK-20260907-21.md
NEXT: Merge https://github.com/joaquimmulaza/boleia/pull/99
MODE: local
