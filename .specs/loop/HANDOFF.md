# Handoff protocol (Boleia loop)

Cada papel de produto/eng no tick termina escrevendo (ou actualizando) um bloco `HANDOFF` no artefacto do tick:

- Log do tick: `.specs/loop/TICK-YYYYMMDD-HH.md`
- Ou no `TASK.md` / `SUMMARY.md` do quick/feature correspondiente

## Template obrigatório

```text
HANDOFF:
FROM: pm|shipwright|implementer|ui-designer|ui-qa|reviewer|intel|monetization|orchestrator
TO: next_role|human
STATUS: DONE|BLOCKED|NEED_HUMAN
ARTIFACT: path/relativo/ao/repo
NEXT: instrução de 1 linha para o destinatário
MODE: local|cloud
```

## Regras

- `STATUS: NEED_HUMAN` → orquestrador pára o item e notifica o utilizador (ver `ESCALATION.md`); pode avançar outro item da fila se for seguro.
- `STATUS: BLOCKED` sem NEED_HUMAN → orquestrador tenta fallback (ex. cloud→local) uma vez.
- `TO: human` só para urgências da matriz em `ESCALATION.md`.
- Um tick processa **no máximo 1 pacote de engenharia** (top 1 do PM).
