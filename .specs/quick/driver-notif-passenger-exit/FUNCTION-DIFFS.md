# Diffs normalizados vs corpo anterior em `main`

## `apply_due_reserva_expiry`

**Base:** `20261012181000_expiry_close_sem_lugares_vivos.sql` (#269 — v1.10/v1.11; já em prod)

```diff
 DECLARE
   ...
+  v_pax_nome text;
+  v_driver_msg text;
   ...
-    SELECT ap.id, ap.acordo_id, ap.passenger_id, a.oferta_id, a.estado AS acordo_estado
+    SELECT ap.id, ap.acordo_id, ap.passenger_id, a.oferta_id, a.driver_id, a.estado AS acordo_estado
     ...
     PERFORM public._expirar_lugar_reservado_sem_divida(...);

+    -- v_vivos já existe na base #269; reutilizado para guard v1.12
     IF v_vivos > 0 AND v_row.driver_id IS NOT NULL AND NOT v_fechou
        AND NOT v_fecha_todo_lote
        AND lower(v_row.acordo_estado) IN ('activo', 'cancelamento_pendente') THEN
       -- copy v1.12 (com/sem nome)
-      INSERT INTO public.notificacoes ...
+      BEGIN INSERT ... EXCEPTION WHEN OTHERS THEN RAISE WARNING ... END;
     END IF;

     INSERT INTO public.notificacoes (passageiro reserva_expirada) -- inalterado
```

## `leave_passenger`

**Base:** `20261012181000_expiry_close_sem_lugares_vivos.sql` (mantém bloco v1.10)

```diff
-    ELSIF v_estado_acordo = 'activo' THEN
+    ELSIF lower(v_estado_acordo) IN ('activo', 'cancelamento_pendente') THEN
       ...
-          jsonb_build_object('type', 'agreement_update', 'acordo_id', p_acordo_id),
+          jsonb_build_object(
+            'type', 'status', 'card', 'v1.7', 'titulo', 'Ficou um lugar livre', ...
+          ),
     ...
-      INSERT ... last passenger ... (sem metadata card)
+      BEGIN INSERT ... card v1.8, titulo Acordo encerrado ... EXCEPTION RAISE WARNING END;
-      INSERT ... partial ...
+      BEGIN INSERT ... card v1.7 ... EXCEPTION RAISE WARNING END;
```

**Nota:** `#278` (`20261012210000` / `20261012213000`) altera `terminate_agreement` apenas — não redefine `leave_passenger` / `apply_due_reserva_expiry`.

## `leave_passenger` — v1.14 (passageiro removido, último)

**Base:** `20261012220000_driver_notif_passenger_exit.sql`

```diff
+ v_oferta_flex, v_origem, v_destino, v_corpo_v114
- last_passenger_driver_removed suppress: true, false
+ last_passenger_driver_removed suppress: true, true
+ ELSIF motorista AND último AND cancelado → INSERT passageiro v1.14 (info, sem link)
+   flexível ou sem OD → «O motorista retirou-te do acordo, que foi encerrado.»
+   OD real → «… {origem} → {destino}, que foi encerrado.»
- trigger genérico «O teu acordo de boleia foi cancelado.» (suppressed)
```

## `_purge_pagamento_mensal_disponivel_notif` / `_anular_pagamento_sem_divida` / `trg_pagamentos_acordo_notify`

**Base:** `_anular_pagamento_sem_divida` → `20261009180000_p0_acordo_pagamento_estados.sql`; trigger → `20260907151936_pacote_eng16_domain_notifications.sql`

**Migração:** `20261012222000_pagamento_anulacao_v1_15.sql` (v1.15)

```diff
+ CREATE FUNCTION _purge_pagamento_mensal_disponivel_notif(passenger_id, pagamento_id)
+   DELETE notificacoes WHERE mensagem = «Pagamento mensal disponível…»
+     AND metadata.type payment_update AND metadata.pagamento_id = p_pagamento_id::text

+ _anular_pagamento_sem_divida: após UPDATE, PERFORM purge se FOUND

+ trg_pagamentos_acordo_notify INSERT: skip notify se NEW.estado = anulado
+ trg UPDATE → anulado: PERFORM purge (sem novo push «Pagamento mensal…»)
```

**Dados prod:** ~10 linhas legacy no sino com aviso mensal apontando a pagamentos já `anulado` — corrigir num one-off à parte (sem DELETE em migração).
