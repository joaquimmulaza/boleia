# Diff normalizado — funções vs corpo em produção (main pré-20261012170000)

Base `apply_due_reserva_expiry`: `20261009180000_p0_acordo_pagamento_estados.sql`  
Base `leave_passenger`: `20261010000000_encerramento_motivo_leave_passenger.sql`

## Nova: `_p0_encerrar_acordo_sem_lugares_vivos_pos_expiracao(uuid)`

- Conta lugares `activo`/`reservado`; se > 0, return false.
- `INSERT _acordo_cancel_notif_suppress` (`last_reservation_expired`, true, true).
- `_maybe_fechar_acordo_sem_lugares_vivos` + `encerramento_motivo = sem_lugares_vivos` (gate consensual pendente igual leave).
- Limpa colunas rescisão consensual pendente (`rescisao_confirmada_em IS NULL`).
- Notificação motorista card **v1.8** (sem passageiro).

## `apply_due_reserva_expiry`

| Antes (prod) | Depois |
|--------------|--------|
| Após `_expirar`, **sempre** INSERT notif passageiro «A tua reserva expirou…» | Se `_p0_encerrar…` fechou acordo → **sem** notif passageiro |
| Fim: `_maybe_fechar_acordo_sem_lugares_vivos(p_acordo_id)` só | Fim: `_p0_encerrar…` (motivo + v1.8 + limpar consensual) |

## `leave_passenger`

| Antes (prod) | Depois |
|--------------|--------|
| Suppress só quando `v_ultimo_passageiro_saiu` | + `ELSIF v_uid = driver` parcial → suppress `driver_removed_passenger_partial` |
| Motorista remove parcial: **sem** notif ao removido | INSERT v1.10 ao `v_target` (titulo metadata + corpo com OD ou flexível) |
| Motorista caller parcial: já sem notif driver | Inalterado |
