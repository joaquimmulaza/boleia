# Diffs normalizados vs corpo anterior em `main`

## `apply_due_reserva_expiry`

**Base:** `20261009180000_p0_acordo_pagamento_estados.sql` (última redefinição em `main` antes desta migração)

```diff
 DECLARE
   v_row RECORD;
   ...
+  v_vivos integer;
+  v_pax_nome text;
+  v_driver_msg text;
   ...
-    SELECT ap.id, ap.acordo_id, ap.passenger_id, a.oferta_id, a.estado AS acordo_estado
+    SELECT ap.id, ap.acordo_id, ap.passenger_id, a.oferta_id, a.driver_id, a.estado AS acordo_estado
     ...
     PERFORM public._expirar_lugar_reservado_sem_divida(...);
+
+    SELECT COUNT(*)::integer INTO v_vivos ... lugares activo/reservado;
+    IF v_vivos > 0 AND v_row.driver_id IS NOT NULL THEN
+      -- copy v1.12 (com/sem nome)
+      INSERT INTO public.notificacoes (driver_id, metadata card v1.12, titulo, sem link)
+    END IF;
+
     INSERT INTO public.notificacoes (passageiro reserva_expirada) -- inalterado
```

## `leave_passenger`

**Base:** `20261010000000_encerramento_motivo_leave_passenger.sql`

```diff
-    ELSIF v_estado_acordo = 'activo' THEN
+    ELSIF lower(v_estado_acordo) IN ('activo', 'cancelamento_pendente') THEN
       ...
-          jsonb_build_object('type', 'agreement_update', 'acordo_id', p_acordo_id),
+          jsonb_build_object(
+            'type', 'status', 'card', 'v1.7', 'titulo', 'Ficou um lugar livre', ...
+          ),
     ...
-      BEGIN INSERT ... last passenger ... EXCEPTION RAISE WARNING
+      INSERT ... metadata card v1.8, titulo Acordo encerrado ... (sem EXCEPTION)
-      BEGIN INSERT ... partial ... EXCEPTION RAISE WARNING
+      INSERT ... (sem EXCEPTION após suppress + insert último)
```

**Nota:** PR #269 (`20261012170000_expiry_close_sem_lugares_vivos.sql`) também redefine estas funções — rebase obrigatório após merge.

## `leave_passenger` — v1.14 (passageiro removido, último)

**Base:** `20261012180000_driver_notif_passenger_exit.sql`

```diff
+ v_oferta_flex, v_origem, v_destino, v_corpo_v114
- last_passenger_driver_removed suppress: true, false
+ last_passenger_driver_removed suppress: true, true
+ ELSIF motorista AND último AND cancelado → INSERT passageiro v1.14 (info, sem link)
+   flexível ou sem OD → «O motorista retirou-te do acordo, que foi encerrado.»
+   OD real → «… {origem} → {destino}, que foi encerrado.»
- trigger genérico «O teu acordo de boleia foi cancelado.» (suppressed)
```
