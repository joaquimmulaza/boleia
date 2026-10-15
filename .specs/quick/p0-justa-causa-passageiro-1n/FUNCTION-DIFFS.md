# Diffs normalizados vs corpo anterior em `main`

## `terminate_agreement`

**Base:** `20261012180500_consensual_pending_block_reinit.sql`

```diff
+ DECLARE v_ap_row, v_vivos_restantes, v_ultimo_passageiro_saiu, v_pax_nome, v_mensagem_motorista, v_skip_rescisao_broadcast
+ Ramo justa_causa:
+   IF NOT v_is_driver THEN
+     saída só do invocador (reservado → _expirar_lugar…; activo → saiu + ajustar_obrigacao_pagamento_mes)
+     último vivo → suppress last_passenger_jc_self + _maybe_fechar_acordo_sem_lugares_vivos + encerramento_motivo sem_lugares_vivos
+     notificação dedicada ao motorista; v_skip_rescisao_broadcast := true
+   ELSE
+     (corpo anterior) suppress terminate_justa_causa → _p0_finalize_lugares… → cancelado_justificado
+   END IF
+ Broadcast final: IF NOT v_skip_rescisao_broadcast AND v_mensagem IS NOT NULL
+ v_estado_final: SELECT só se NULL (passageiro JC já preenche antes da notif motorista)
```
