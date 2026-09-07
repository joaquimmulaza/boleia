# Tick log template

Criar ficheiros `TICK-YYYYMMDD-HH.md` nesta pasta em cada tick (ex. `TICK-20260907-15.md`).

```markdown
# Tick YYYY-MM-DD HH:00
MODE: local|cloud

## Quiet?
sim|não — motivo

## PM
- Top 1: …
- BACKLOG actualizado: sim|não

## Shipwright
- Prompt / Task: …
- Executor: local|cloud|fallback

## Resultado
- PR: url|n/a
- VERDICT: …

HANDOFF:
FROM: orchestrator
TO: human|shipwright|…
STATUS: DONE|BLOCKED|NEED_HUMAN
ARTIFACT: .specs/loop/TICK-…
NEXT: …
MODE: local|cloud
```
