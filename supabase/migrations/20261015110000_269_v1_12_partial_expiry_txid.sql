-- #269 soft: notificação motorista v1.12 (expiração parcial) inclui txid como v1.11.
-- Base OBRIGATÓRIA (#275 / G1–G4): 20261012220000_driver_notif_passenger_exit.sql
-- (última redefinição de apply_due_reserva_expiry antes desta — inclui card v1.12).
-- NÃO usar 20261012181000 nem migrações ENG#18/P0 anteriores.
-- Só esta função; leave_passenger permanece em 20261012220000 / 20261012221000.

CREATE OR REPLACE FUNCTION public.apply_due_reserva_expiry(p_acordo_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row RECORD;
  v_oferta_ids uuid[] := ARRAY[]::uuid[];
  v_oferta_id uuid;
  v_count integer := 0;
  v_vivos integer;
  v_fechou boolean;
  v_fecha_todo_lote boolean;
  v_acordos_fecha_todo_lote uuid[] := ARRAY[]::uuid[];
  v_pax_nome text;
  v_driver_msg text;
BEGIN
  PERFORM public._p0_assert_lazy_apply_due_scope(p_acordo_id);

  SELECT COALESCE(array_agg(batch.acordo_id), ARRAY[]::uuid[])
  INTO v_acordos_fecha_todo_lote
  FROM (
    SELECT ap.acordo_id
    FROM public.acordos_passageiros ap
    JOIN public.acordos a ON a.id = ap.acordo_id
    WHERE lower(ap.estado) = 'reservado'
      AND ap.reservado_expira_em IS NOT NULL
      AND ap.reservado_expira_em <= now()
      AND (
        (p_acordo_id IS NOT NULL AND ap.acordo_id = p_acordo_id)
        OR (p_acordo_id IS NULL AND public._p0_acordo_in_lazy_apply_due_scope(ap.acordo_id))
      )
      AND lower(a.estado) IN ('activo', 'cancelamento_pendente', 'cancelado', 'cancelado_justificado')
      AND NOT EXISTS (
        SELECT 1
        FROM public.pagamentos_acordo pg
        WHERE pg.acordo_passageiro_id = ap.id
          AND lower(pg.estado) IN ('comprovativo_enviado', 'em_custodia', 'liquidado')
      )
    GROUP BY ap.acordo_id
    HAVING lower(max(a.estado)) IN ('activo', 'cancelamento_pendente')
      AND (
        SELECT COUNT(*)::integer
        FROM public.acordos_passageiros ap_v
        WHERE ap_v.acordo_id = ap.acordo_id
          AND lower(ap_v.estado) IN ('activo', 'reservado')
      ) = COUNT(*)::integer
  ) batch;

  FOR v_row IN
    SELECT ap.id, ap.acordo_id, ap.passenger_id, a.oferta_id, a.driver_id, a.estado AS acordo_estado
    FROM public.acordos_passageiros ap
    JOIN public.acordos a ON a.id = ap.acordo_id
    WHERE lower(ap.estado) = 'reservado'
      AND ap.reservado_expira_em IS NOT NULL
      AND ap.reservado_expira_em <= now()
      AND (
        (p_acordo_id IS NOT NULL AND ap.acordo_id = p_acordo_id)
        OR (p_acordo_id IS NULL AND public._p0_acordo_in_lazy_apply_due_scope(ap.acordo_id))
      )
      AND lower(a.estado) IN ('activo', 'cancelamento_pendente', 'cancelado', 'cancelado_justificado')
      AND NOT EXISTS (
        SELECT 1
        FROM public.pagamentos_acordo pg
        WHERE pg.acordo_passageiro_id = ap.id
          AND lower(pg.estado) IN ('comprovativo_enviado', 'em_custodia', 'liquidado')
      )
    ORDER BY ap.acordo_id, ap.reservado_expira_em, ap.id
    FOR UPDATE OF ap
  LOOP
    v_fecha_todo_lote := v_row.acordo_id = ANY (v_acordos_fecha_todo_lote);

    PERFORM public._expirar_lugar_reservado_sem_divida(
      v_row.id,
      'Prazo de reserva expirado'
    );

    SELECT COUNT(*)::integer INTO v_vivos
    FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = v_row.acordo_id
      AND lower(ap.estado) IN ('activo', 'reservado');

    v_fechou := false;
    IF v_vivos = 0
       AND lower(v_row.acordo_estado) IN ('activo', 'cancelamento_pendente') THEN
      v_fechou := public._p0_encerrar_acordo_sem_lugares_vivos_pos_expiracao(
        v_row.acordo_id,
        v_row.passenger_id
      );
    END IF;


    IF v_vivos > 0
       AND v_row.driver_id IS NOT NULL
       AND NOT v_fechou
       AND NOT v_fecha_todo_lote
       AND lower(v_row.acordo_estado) IN ('activo', 'cancelamento_pendente') THEN
      SELECT NULLIF(btrim(COALESCE(p.nome_completo, '')), '')
      INTO v_pax_nome
      FROM public.perfis p
      WHERE p.id = v_row.passenger_id;

      IF v_pax_nome IS NOT NULL THEN
        v_driver_msg :=
          'A reserva de ' || v_pax_nome || ' expirou. O acordo continua.';
      ELSE
        v_driver_msg := 'A reserva de um passageiro expirou. O acordo continua.';
      END IF;

      BEGIN
        INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
        VALUES (
          v_row.driver_id,
          v_driver_msg,
          'info',
          jsonb_build_object(
            'type', 'status',
            'card', 'v1.12',
            'titulo', 'Ficou um lugar livre',
            'acordo_id', v_row.acordo_id,
            'reason', 'reserva_expirada_lugar_livre',
            'txid', txid_current()::text
          )
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Falha ao notificar motorista expiração parcial (v1.12) acordo %: %',
            v_row.acordo_id, SQLERRM;
      END;
    END IF;

    IF NOT v_fecha_todo_lote AND NOT v_fechou THEN
      INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
      VALUES (
        v_row.passenger_id,
        'A tua reserva expirou por falta de pagamento a tempo. A vaga foi libertada.',
        'warning',
        jsonb_build_object(
          'type', 'reserva_expirada',
          'acordo_id', v_row.acordo_id,
          'inbox', 'passageiro'
        )
      );
    END IF;

    IF v_row.oferta_id IS NOT NULL AND NOT (v_row.oferta_id = ANY (v_oferta_ids)) THEN
      v_oferta_ids := array_append(v_oferta_ids, v_row.oferta_id);
    END IF;

    v_count := v_count + 1;
  END LOOP;

  FOREACH v_oferta_id IN ARRAY v_oferta_ids
  LOOP
    PERFORM public.recount_oferta_vagas(v_oferta_id);
    BEGIN
      PERFORM public.promote_waitlist(v_oferta_id);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Falha best-effort promote_waitlist após expiry oferta %: %',
          v_oferta_id, SQLERRM;
    END;
  END LOOP;

  -- Reservados pendurados em acordos já cancelados (sem TTL aplicável)
  FOR v_row IN
    SELECT ap.id, ap.acordo_id, a.oferta_id
    FROM public.acordos_passageiros ap
    JOIN public.acordos a ON a.id = ap.acordo_id
    WHERE lower(ap.estado) = 'reservado'
      AND lower(a.estado) IN ('cancelado', 'cancelado_justificado')
      AND (
        (p_acordo_id IS NOT NULL AND ap.acordo_id = p_acordo_id)
        OR (p_acordo_id IS NULL AND public._p0_acordo_in_lazy_apply_due_scope(ap.acordo_id))
      )
    FOR UPDATE OF ap
  LOOP
    PERFORM public._expirar_lugar_reservado_sem_divida(
      v_row.id,
      'Acordo terminado antes da activação'
    );
    v_count := v_count + 1;
  END LOOP;

  IF p_acordo_id IS NOT NULL THEN
    PERFORM public._p0_encerrar_acordo_sem_lugares_vivos_pos_expiracao(p_acordo_id);
  END IF;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_due_reserva_expiry(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_due_reserva_expiry(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_due_reserva_expiry(uuid) FROM anon;
