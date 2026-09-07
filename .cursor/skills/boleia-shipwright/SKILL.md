---
name: boleia-shipwright
description: Shipwright Boleia — converte o pacote #1 do backlog num prompt técnico fechado e despacha executor local ou Cloud Agent. Use após PM no tick; fallback cloud→local com prompt colável.
---

# Boleia Shipwright

## Quando

- Após `boleia-product-pm` no tick
- Pedido “manda isto ao Cloud Agent” / “prompt técnico para X”
- Orquestrador em modo tick autónomo

## Entrada

1. `.specs/loop/BACKLOG.md` item **#1**
2. `TASK.md` / spec apontada pelo PM
3. `.specs/project/PROJECT.md` + `ROADMAP.md` + `STATE.md` (invariantes e Next relevantes)
4. `.specs/loop/HANDOFF.md` + `.specs/loop/ESCALATION.md`
5. `MODE` do tick: `local` | `cloud` (ver orquestrador)

## Regras

- **Não** inventes scope — só o #1 do backlog / TASK.
- **Não** faças merge em `main`.
- Em tick autónomo: commit/push na **branch do agent** permitido; merge = humano.
- Fora de tick: não commits sem pedido explícito do utilizador.
- Incluir no prompt: TDD, JS/JSX only, invariantes tocadas, paths prováveis, DoD, gate VERDICT.

## Dual-mode

| MODE | Acção |
|------|--------|
| `local` | Despachar `implementer` (+ `ui-designer` se UI) via `Task` no workspace; depois `code-reviewer` (+ `ui-qa` se UI) |
| `cloud` | Lançar `Task` com `environment: "cloud"` e o prompt técnico; repo `joaquimmulaza/boleia` / remote do projecto |
| cloud falhou | Escrever prompt completo em `.specs/loop/FALLBACK-PROMPT.md` e `HANDOFF` `TO: human` com instrução: colar `tick local` |

## Prompt técnico (template)

```markdown
# Pacote: {slug}
MODE: {local|cloud}
DoD: …
Invariantes: …
Ficheiros / áreas: …
Spec/Quick: path
Obrigatório: tlc-spec-driven se preciso; TDD; VERDICT code-reviewer (+ ui-qa se UI); abrir PR; NÃO merge main
HANDOFF no fim do trabalho.
```

## Saída

- Artefacto do prompt em `.specs/loop/TICK-…md` ou `FALLBACK-PROMPT.md`
- `HANDOFF` `FROM: shipwright` → `implementer` | `human`
