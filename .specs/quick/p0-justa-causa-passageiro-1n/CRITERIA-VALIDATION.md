# Validação critérios finais PR #278

| Critério | Estado | Prova |
|----------|--------|-------|
| Passageiro JC: só o lugar, no próprio dia | OK | PG JC1N-1 (`saiu`, `lugar_rescisao_em` hoje Luanda); acordo `activo` |
| Outros mantêm lugares/pagamentos/estados | OK | PG JC1N-1 (`ap_b` activo; pagamento B 20000 em_custodia) |
| Último lugar vivo → acordo encerra | OK | PG JC1N-2 `sem_lugares_vivos` |
| Motorista JC → acordo inteiro | OK | PG JC1N-3 `cancelado_justificado`; sem activo/reservado |
| Financeiro: pro-rata − comissão, só lugar invocador | OK | PG JC1N-1 `calc_quota_proporcional` + `compute_payout_liquido_kz` por `ap_a`; B intacto |
| Oferta publicada | OK | PG JC1N-1/2 oferta `disponivel`/`parcial` |
| Notificações: motorista sim; outros passageiros não | OK | PG JC1N-1/4 (B count=0); motorista ≥1 |
| Estados separados (lugar / acordo / pagamento) | OK | PG JC1N-4 reservado→`expirado` vs acordo `activo`; JC1N-1 pagamento A ajustado vs B |
| Lugar reservado invocador | OK | PG JC1N-4 |
| Idempotência mesma chamada | OK | PG JC1N-1b + Vitest migração |
| UI copy B/B2 motorista | OK | Vitest `MyAgreements` + `driverJustaCausaPassageiroCopy` |

## Nota (notificações ao invocador)

No ramo passageiro JC, `v_skip_rescisao_broadcast` evita broadcast aos restantes; o motorista recebe notificação dedicada. **Não há INSERT de notificação para o passageiro invocador** — interpretação do critério «só invocador e motorista» = os únicos *destinatários possíveis* (excluir outros), não obrigar push ao invocador. Se o Maestro quiser notif explícita ao invocador, é follow-up separado.

## Financeiro

Pro-rata e comissão são **por `acordos_passageiros.id`** (`ajustar_obrigacao_pagamento_mes`), não por cabeçalho do acordo. Sem incompatibilidade com a regra aprovada.
