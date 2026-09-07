# Draft — Cursor Automation `boleia-loop-tick`

> Isto é um **draft** para colares / confirmares no editor de Automations do Cursor.  
> Não activa sozinho. Após activares: créditos + horário são da tua conta.

## Nome

`boleia-loop-tick`

## Descrição

Tick do loop produto/engenharia Boleia Certa: PM prioriza → Shipwright → Cloud Agent no repo → PR sem merge. Silêncio se nada a fazer. Ping só em urgências (`.specs/loop/ESCALATION.md`).

## Trigger (sugerido)

- Agendado: a cada **2 horas**
- Janela: **09:00–19:00**, segunda a sexta
- Timezone: **Africa/Luanda** (WAT) — no editor usa o fuso disponível equivalente (ex. Africa/Lagos) se Luanda não listar

## Tools

- Agent / Cloud Agent no repositório do Boleia Certa (`joaquimmulaza/boleia` ou remote configurado)
- GitHub (abrir PR) se disponível na Automation
- **Não** activar merge automático

## Instruções (prompt da Automation)

```text
És o Maestro do loop Boleia Certa (MODE=cloud).

1. Lê e segue:
   - .cursor/skills/boleia-agent-loop/orchestrator/SKILL.md
   - .specs/loop/ESCALATION.md
   - .specs/loop/HANDOFF.md
   - .specs/project/PROJECT.md
   - .specs/project/ROADMAP.md
   - .specs/project/STATE.md
   - .specs/loop/BACKLOG.md

2. Corre um único tick autónomo MODE=cloud:
   - Se quiet (nada a fazer / PR à espera de merge sem novo #1) → escreve .specs/loop/TICK-YYYYMMDD-HH.md com quiet e termina SEM ping.
   - Senão: boleia-product-pm → boleia-shipwright → Cloud Agent no pacote #1 → reviewers VERDICT → abrir/actualizar PR.
   - NUNCA merge em main.
   - NEED_HUMAN só conforme ESCALATION.md.

3. Actualiza STATE.md se abrires PR.
4. Resposta final curta: quiet | PR link | NEED_HUMAN motivo.
```

## Comandos locais (sem Automation)

No Agent chat do repo:

| Comando | Efeito |
|---------|--------|
| `primeiro tick` | Orquestrador tick MODE=local |
| `tick local` | Idem, explícito local |
| `tick cloud` | Tick com Cloud Agent |
| `continua o loop` | Próximo tick local a partir do BACKLOG |

## To finish in editor

- [ ] Confirmar repo / branch base
- [ ] Confirmar fuso horário e janela 09–19
- [ ] Confirmar tools GitHub + agent
- [ ] Activar só quando houver créditos
- [ ] Testar um run manual antes do schedule
