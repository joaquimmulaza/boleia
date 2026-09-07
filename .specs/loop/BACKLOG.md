# Backlog loop (actualizado 2026-09-07)

## Top 3

1. **eng-8b-s22-fecho** — Rescisão consensual A (imediato/pro-rata \| fim_ciclo) + anular adenda iniciador — tipo: eng — DoD: A1–A6 em `.specs/quick/pacote-eng-8b-s22-fecho/quick.md` — deps: nenhuma
2. **seat-before-custody** — Assento/`N_activos` não deve consumir capacidade definitiva antes de `em_custodia` — tipo: eng — DoD: spec + RPC/UI alinhados a anti-leakage — deps: após #1
3. **falta-ida-regresso-policy** — Decidir e alinhar desconto ida/regresso (código meia quota vs contrato «só ambas») — tipo: eng — DoD: decisão em STATE + trigger/UI — deps: decisão produto

## Quiet?

- não — ENG#8b em curso (tick 21)

## Notas

- PR #98 cânone docs: **merged** em `main`
- copy «zona»: já guardada por testes; não é #1
- ProxyPay / B2B / Garantie Retour: fora MVP

HANDOFF:
FROM: pm
TO: shipwright
STATUS: DONE
ARTIFACT: .specs/loop/BACKLOG.md
NEXT: Executar eng-8b-s22-fecho
MODE: local
