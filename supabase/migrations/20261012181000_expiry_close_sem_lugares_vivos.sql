-- Expiração do último lugar vivo: encerramento sem_lugares_vivos + card motorista v1.11 (sem notif passageiro).
-- Motorista remove passageiro não-último: card estado v1.10 ao removido (sem CTA), supressão txid.
-- Reparação is_test/QA: supabase/scripts/expiry_close_sem_lugares_vivos_is_test_repair.sql (manual).

CREATE OR REPLACE FUNCTION public._p0_encerrar_acordo_sem_lugares_vivos_pos_expiracao(
  p_acordo_id uuid,
  p_passageiro_expirado_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_acordo public.acordos%ROWTYPE;
  v_vivos integer;
  v_estado_antes text;
  v_pax_nome text;
  v_mensagem text;
BEGIN
  IF p_acordo_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = p_acordo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_estado_antes := lower(v_acordo.estado);

  IF v_estado_antes NOT IN ('activo', 'cancelamento_pendente') THEN
    RETURN false;
  END IF;

  SELECT COUNT(*)::integer INTO v_vivos
  FROM public.acordos_passageiros ap
  WHERE ap.acordo_id = p_acordo_id
    AND lower(ap.estado) IN ('activo', 'reservado');

  IF v_vivos > 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public._acordo_cancel_notif_suppress (
    acordo_id, txid, reason, suppress_driver, suppress_passenger
  ) VALUES (
    p_acordo_id, txid_current(), 'last_reservation_expired', true, true
  );

  PERFORM public._maybe_fechar_acordo_sem_lugares_vivos(p_acordo_id);

  UPDATE public.acordos
  SET encerramento_motivo = 'sem_lugares_vivos'
  WHERE id = p_acordo_id
    AND lower(estado) = 'cancelado'
    AND encerramento_motivo IS NULL
    AND (
      rescisao_modo IS NULL
      OR (
        lower(rescisao_modo) = 'consensual'
        AND rescisao_confirmada_em IS NULL
      )
    );

  UPDATE public.acordos
  SET
    rescisao_modo = NULL,
    rescisao_solicitada_por = NULL,
    rescisao_vigencia = NULL,
    rescisao_justificativa = NULL,
    rescisao_effective_on = NULL,
    rescisao_solicitada_em = NULL
  WHERE id = p_acordo_id
    AND lower(COALESCE(rescisao_modo, '')) = 'consensual'
    AND rescisao_confirmada_em IS NULL;

  IF v_estado_antes IN ('activo', 'cancelamento_pendente')
     AND lower((SELECT estado FROM public.acordos WHERE id = p_acordo_id)) = 'cancelado' THEN
    IF p_passageiro_expirado_id IS NOT NULL THEN
      SELECT NULLIF(trim(nome_completo), '') INTO v_pax_nome
      FROM public.perfis
      WHERE id = p_passageiro_expirado_id;
    END IF;

    IF v_pax_nome IS NOT NULL THEN
      v_mensagem :=
        'A reserva de ' || v_pax_nome
        || ' expirou e o acordo foi encerrado. A tua oferta continua publicada.';
    ELSE
      v_mensagem :=
        'A reserva do último passageiro expirou e o acordo foi encerrado. A tua oferta continua publicada.';
    END IF;

    BEGIN
      INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
      VALUES (
        v_acordo.driver_id,
        v_mensagem,
        'info',
        jsonb_build_object(
          'type', 'status',
          'card', 'v1.11',
          'titulo', 'Acordo encerrado',
          'acordo_id', p_acordo_id,
          'reason', 'last_reservation_expired',
          'txid', txid_current()
        )
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Falha ao notificar motorista encerramento por expiração último lugar %: %',
          p_acordo_id, SQLERRM;
    END;

    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION public._p0_encerrar_acordo_sem_lugares_vivos_pos_expiracao(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._p0_encerrar_acordo_sem_lugares_vivos_pos_expiracao(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._p0_encerrar_acordo_sem_lugares_vivos_pos_expiracao(uuid, uuid) TO service_role;

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

CREATE OR REPLACE FUNCTION public.leave_passenger(
  p_acordo_id uuid,
  p_passenger_id uuid DEFAULT NULL::uuid,
  p_idempotency_key uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_target uuid;
  v_acordo public.acordos%ROWTYPE;
  v_row public.acordos_passageiros%ROWTYPE;
  v_hoje date := (timezone('Africa/Luanda', now()))::date;
  v_estado_antes text;
  v_pg_id uuid;
  v_estado_acordo text;
  v_pax_nome text;
  v_mensagem_saida text;
  v_vivos_restantes integer;
  v_ultimo_passageiro_saiu boolean;
  v_link text;
  v_oferta_flex boolean;
  v_origem text;
  v_destino text;
  v_corpo_v110 text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_acordo_id IS NULL THEN
    RAISE EXCEPTION 'acordo_id é obrigatório.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      RETURN p_acordo_id;
    END IF;
  END IF;

  v_target := COALESCE(p_passenger_id, v_uid);
  v_link := '/acordos?openAcordoId=' || p_acordo_id::text;

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = p_acordo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  IF v_uid IS DISTINCT FROM v_target AND v_uid IS DISTINCT FROM v_acordo.driver_id THEN
    RAISE EXCEPTION 'Sem permissão para sair deste acordo.';
  END IF;

  SELECT * INTO v_row
  FROM public.acordos_passageiros
  WHERE acordo_id = p_acordo_id
    AND passenger_id = v_target
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Passageiro não pertence a este acordo.';
  END IF;

  IF lower(v_row.estado) NOT IN ('activo', 'reservado') THEN
    RAISE EXCEPTION 'Passageiro não está activo neste acordo.';
  END IF;

  v_estado_antes := lower(v_row.estado);

  IF v_estado_antes = 'reservado' THEN
    UPDATE public.acordos_passageiros
    SET
      estado = 'saiu',
      reservado_expira_em = NULL
    WHERE id = v_row.id
      AND lower(estado) = 'reservado';

    SELECT id INTO v_pg_id
    FROM public.pagamentos_acordo
    WHERE acordo_passageiro_id = v_row.id
      AND mes_referencia = date_trunc('month', timezone('Africa/Luanda', now()))::date
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_pg_id IS NOT NULL THEN
      PERFORM public._anular_pagamento_sem_divida(
        v_pg_id,
        'Saíste antes da activação do lugar'
      );
    END IF;
  ELSE
    UPDATE public.acordos_passageiros SET estado = 'saiu' WHERE id = v_row.id;
    PERFORM public.ajustar_obrigacao_pagamento_mes(v_row.id, v_hoje, false);
  END IF;

  SELECT COUNT(*)::integer INTO v_vivos_restantes
  FROM public.acordos_passageiros ap
  WHERE ap.acordo_id = p_acordo_id
    AND lower(ap.estado) IN ('activo', 'reservado');

  v_ultimo_passageiro_saiu := (v_vivos_restantes = 0);

  -- Último passageiro: supressão via tabela interna + txid (cliente não forja — ver cabeçalho).
  -- Self-leave: motorista recebe só o card dedicado; passageiro a sair não recebe «O teu acordo…».
  -- Motorista remove último: passageiro recebe cancelamento normal; motorista não recebe trigger genérico.
  IF v_ultimo_passageiro_saiu THEN
    IF v_uid IS DISTINCT FROM v_acordo.driver_id THEN
      INSERT INTO public._acordo_cancel_notif_suppress (
        acordo_id, txid, reason, suppress_driver, suppress_passenger
      ) VALUES (
        p_acordo_id, txid_current(), 'last_passenger_self_left', true, true
      );
    ELSE
      INSERT INTO public._acordo_cancel_notif_suppress (
        acordo_id, txid, reason, suppress_driver, suppress_passenger
      ) VALUES (
        p_acordo_id, txid_current(), 'last_passenger_driver_removed', true, false
      );
    END IF;
  ELSIF v_uid = v_acordo.driver_id THEN
    INSERT INTO public._acordo_cancel_notif_suppress (
      acordo_id, txid, reason, suppress_driver, suppress_passenger
    ) VALUES (
      p_acordo_id, txid_current(), 'driver_removed_passenger_partial', true, true
    );
  END IF;

  PERFORM public._maybe_fechar_acordo_sem_lugares_vivos(p_acordo_id);

  IF v_ultimo_passageiro_saiu THEN
    UPDATE public.acordos
    SET encerramento_motivo = 'sem_lugares_vivos'
    WHERE id = p_acordo_id
      AND lower(estado) = 'cancelado'
      AND encerramento_motivo IS NULL
      AND (
        rescisao_modo IS NULL
        OR (
          lower(rescisao_modo) = 'consensual'
          AND rescisao_confirmada_em IS NULL
        )
      );
  END IF;

  PERFORM public.recount_oferta_vagas(v_acordo.oferta_id);

  BEGIN
    PERFORM public.promote_waitlist(v_acordo.oferta_id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Falha best-effort promote_waitlist na saída do acordo %: %',
        p_acordo_id, SQLERRM;
  END;

  SELECT lower(estado) INTO v_estado_acordo
  FROM public.acordos
  WHERE id = p_acordo_id;

  IF v_uid = v_acordo.driver_id AND NOT v_ultimo_passageiro_saiu THEN
    SELECT
      o.flexibilidade_rota,
      NULLIF(btrim(COALESCE(o.origin_name, '')), ''),
      NULLIF(btrim(COALESCE(o.destination_name, '')), '')
    INTO v_oferta_flex, v_origem, v_destino
    FROM public.ofertas_capacidade o
    WHERE o.id = v_acordo.oferta_id;

    IF COALESCE(v_oferta_flex, false)
       OR v_origem IS NULL
       OR v_destino IS NULL THEN
      v_corpo_v110 := 'O motorista retirou-te do acordo. O teu lugar foi libertado.';
    ELSE
      v_corpo_v110 :=
        'O motorista retirou-te do acordo '
        || v_origem
        || ' → '
        || v_destino
        || '. O teu lugar foi libertado.';
    END IF;

    BEGIN
      INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
      VALUES (
        v_target,
        v_corpo_v110,
        'info',
        jsonb_build_object(
          'type', 'status',
          'card', 'v1.10',
          'titulo', 'Já não fazes parte deste acordo',
          'acordo_id', p_acordo_id,
          'reason', 'driver_removed_passenger_partial',
          'txid', txid_current()
        )
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Falha ao notificar passageiro removido (v1.10) acordo %: %',
          p_acordo_id, SQLERRM;
    END;
  ELSIF v_uid IS DISTINCT FROM v_acordo.driver_id THEN
    SELECT NULLIF(btrim(COALESCE(p.nome_completo, '')), '')
    INTO v_pax_nome
    FROM public.perfis p
    WHERE p.id = v_target;

    IF v_ultimo_passageiro_saiu AND v_estado_acordo = 'cancelado' THEN
      v_mensagem_saida := CASE
        WHEN v_pax_nome IS NOT NULL THEN
          v_pax_nome || ' saiu e o acordo foi encerrado. A tua oferta continua publicada.'
        ELSE
          'O último passageiro saiu e o acordo foi encerrado. A tua oferta continua publicada.'
      END;

      BEGIN
        INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata, link)
        VALUES (
          v_acordo.driver_id,
          v_mensagem_saida,
          'info',
          jsonb_build_object(
            'type', 'status',
            'acordo_id', p_acordo_id,
            'reason', 'last_passenger_left',
            'txid', txid_current()
          ),
          v_link
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Falha ao notificar motorista encerramento por último passageiro %: %',
            p_acordo_id, SQLERRM;
      END;
    ELSIF v_estado_acordo = 'activo' THEN
      v_mensagem_saida := CASE
        WHEN v_pax_nome IS NOT NULL THEN
          v_pax_nome || ' saiu do acordo. Ficou um lugar livre.'
        ELSE
          'Um passageiro saiu do acordo.'
      END;

      BEGIN
        INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata, link)
        VALUES (
          v_acordo.driver_id,
          v_mensagem_saida,
          'warning',
          jsonb_build_object('type', 'agreement_update', 'acordo_id', p_acordo_id),
          v_link
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Falha ao notificar motorista saída passageiro acordo %: %',
            p_acordo_id, SQLERRM;
      END;
    END IF;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'leave_passenger', p_acordo_id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN p_acordo_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.leave_passenger(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_passenger(uuid, uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.leave_passenger(uuid, uuid, uuid) FROM anon;
