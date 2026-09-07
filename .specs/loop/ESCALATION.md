# Escalação do loop Boleia (URGENT vs AUTO)

## Política de PR / git

| Acção | Autonomia |
|-------|-----------|
| Commit + push na **branch do agent** durante tick | AUTO |
| Abrir / actualizar PR | AUTO |
| Merge em `main` / `master` | **HUMAN** — nunca automático |
| Commit fora de tick na máquina do utilizador | HUMAN (só se pedir) |
| Force push / rewrite history | HUMAN — proibido no loop |

## Dual-mode

| MODE | Quando | Notas |
|------|--------|-------|
| `local` | `tick local`, `primeiro tick`, `continua o loop` sem Automation | Cursor aberto; MCPs completos; cuidado com WIP sujo |
| `cloud` | `tick cloud`, Automation `boleia-loop-tick` | PC pode estar fechado; branch isolada |
| Fallback | Cloud falhou | Prompt em `.specs/loop/FALLBACK-PROMPT.md` → utilizador cola `tick local` |

## Matriz AUTO (agentes resolvem)

- Escolher #1 do backlog já priorizado
- Spec/Quick alinhado a `PROJECT` / invariantes
- Codificar, testar, lint
- Até 2 ciclos `VERDICT: REJECT` → fix
- Abrir PR + actualizar `STATE.md` / `TICK-*.md`
- Tick quieto se nada a fazer (sem ping)

## Matriz URGENT (ping humano)

| Situação | Mensagem típica |
|----------|-----------------|
| Créditos Cursor esgotados | tick parado — créditos |
| Cloud Agent falhou | prompt pronto — corre `tick local` |
| PR pronto, testes verdes | link do PR — merge é teu |
| Ambiguidade de produto | 1 pergunta; pausa esse item; pode avançar outro |
| Secrets / IBAN real / auth produção | pedido explícito — não inventar |
| 2× REJECT sem fix | escalação com causa + paths |
| Workspace local sujo (tick local) e risco de conflito | NEED_HUMAN: stash/commit WIP |

## Quiet hours (só Automation)

- Preferência: **09:00–19:00** weekdays (Africa/Luanda), intervalo **2h**
- Tick local: utilizador dispara quando quiser

## Um pacote por tick

Só o item **#1** do PM entra em engenharia. #2/#3 ficam para o próximo tick.
