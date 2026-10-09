-- P1 encerramento: idempotência 2.ª confirmação consensual + notificação motorista em leave_passenger
-- Depende de #249 (20261009190000_leave_passenger_reservado_saiu): merge #249 antes de #250.

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

  PERFORM public._maybe_fechar_acordo_sem_lugares_vivos(p_acordo_id);
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

  IF v_target IS DISTINCT FROM v_acordo.driver_id
     AND v_estado_acordo = 'activo' THEN
    BEGIN
      INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
      VALUES (
        v_acordo.driver_id,
        'Um passageiro saiu do acordo.',
        'warning',
        jsonb_build_object('type', 'agreement_update', 'acordo_id', p_acordo_id)
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Falha ao notificar motorista saída passageiro acordo %: %',
          p_acordo_id, SQLERRM;
    END;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'leave_passenger', p_acordo_id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN p_acordo_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.terminate_agreement(
  p_acordo_id uuid,
  p_modo text,
  p_justificativa text DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL,
  p_vigencia text DEFAULT 'imediato'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_acordo public.acordos%ROWTYPE;
  v_modo text;
  v_vigencia text;
  v_is_driver boolean;
  v_is_pax boolean;
  v_hoje date;
  v_mes_inicio date;
  v_effective date;
  v_dias_uteis integer;
  v_solicitante_is_driver boolean;
  v_confirma boolean := false;
  v_faltas_ok boolean := false;
  v_estado_final text;
  v_mensagem text;
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

  v_modo := lower(COALESCE(p_modo, ''));

  IF v_modo NOT IN ('aviso_previo', 'consensual', 'justa_causa') THEN
    RAISE EXCEPTION
      'Modo de rescisão inválido. Use aviso_previo, consensual ou justa_causa.';
  END IF;

  PERFORM public.apply_due_agreement_terminations(p_acordo_id);

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = p_acordo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  IF lower(COALESCE(v_modo, '')) = 'consensual'
     AND lower(COALESCE(v_acordo.rescisao_modo, '')) = 'consensual'
     AND v_acordo.rescisao_solicitada_por IS NOT NULL
     AND v_acordo.rescisao_solicitada_por IS DISTINCT FROM v_uid
     AND v_acordo.rescisao_confirmada_em IS NOT NULL
     AND (
       (
         lower(v_acordo.estado) = 'cancelamento_pendente'
         AND lower(COALESCE(v_acordo.rescisao_vigencia, '')) = 'fim_ciclo'
       )
       OR (
         lower(v_acordo.estado) IN ('cancelado', 'cancelado_justificado')
         AND lower(COALESCE(v_acordo.rescisao_vigencia, '')) = 'imediato'
       )
     ) THEN
    IF p_idempotency_key IS NOT NULL THEN
      INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
      VALUES (p_idempotency_key, 'terminate_agreement', p_acordo_id, v_uid)
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
    RETURN p_acordo_id;
  END IF;

  v_is_driver := (v_uid = v_acordo.driver_id);

  SELECT EXISTS (
    SELECT 1
    FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id
      AND ap.passenger_id = v_uid
      AND lower(ap.estado) IN ('activo', 'reservado')
  ) INTO v_is_pax;

  IF NOT v_is_driver AND NOT v_is_pax THEN
    RAISE EXCEPTION 'Sem permissão para rescindir este acordo.';
  END IF;

  v_hoje := (timezone('Africa/Luanda', now()))::date;
  v_mes_inicio := date_trunc('month', v_hoje)::date;
  v_effective := (date_trunc('month', v_hoje) + interval '1 month')::date;

  IF v_modo = 'aviso_previo' THEN
    IF lower(v_acordo.estado) <> 'activo' THEN
      RAISE EXCEPTION 'Este acordo já não está activo.';
    END IF;

    UPDATE public.acordos
    SET
      estado = 'cancelamento_pendente',
      rescisao_modo = 'aviso_previo',
      rescisao_solicitada_por = v_uid,
      rescisao_justificativa = NULLIF(btrim(COALESCE(p_justificativa, '')), ''),
      rescisao_vigencia = NULL,
      rescisao_effective_on = v_effective
    WHERE id = p_acordo_id;

    v_mensagem := 'A outra parte pediu a rescisão do acordo com aviso prévio; '
      || 'o acordo mantém-se activo até ao fim deste mês.';

  ELSIF v_modo = 'consensual' THEN
    IF lower(COALESCE(v_acordo.rescisao_modo, '')) = 'consensual'
       AND v_acordo.rescisao_solicitada_por IS NOT NULL
       AND v_acordo.rescisao_solicitada_por IS DISTINCT FROM v_uid
       AND lower(v_acordo.estado) <> 'activo' THEN
      IF p_idempotency_key IS NOT NULL THEN
        INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
        VALUES (p_idempotency_key, 'terminate_agreement', p_acordo_id, v_uid)
        ON CONFLICT (idempotency_key) DO NOTHING;
      END IF;
      RETURN p_acordo_id;
    END IF;

    IF lower(v_acordo.estado) <> 'activo' THEN
      RAISE EXCEPTION 'Este acordo já não está activo.';
    END IF;

    v_vigencia := lower(COALESCE(
      NULLIF(btrim(COALESCE(p_vigencia, '')), ''),
      NULLIF(btrim(COALESCE(v_acordo.rescisao_vigencia, '')), ''),
      'imediato'
    ));

    IF v_vigencia NOT IN ('imediato', 'fim_ciclo') THEN
      RAISE EXCEPTION 'Vigência inválida. Use imediato ou fim_ciclo.';
    END IF;

    IF lower(COALESCE(v_acordo.rescisao_modo, '')) = 'consensual'
       AND v_acordo.rescisao_solicitada_por IS NOT NULL
       AND v_acordo.rescisao_solicitada_por IS DISTINCT FROM v_uid THEN
      v_solicitante_is_driver :=
        (v_acordo.rescisao_solicitada_por = v_acordo.driver_id);

      v_confirma := (v_solicitante_is_driver AND v_is_pax)
        OR (NOT v_solicitante_is_driver AND v_is_driver);
    END IF;

    IF NOT v_confirma THEN
      IF lower(COALESCE(v_acordo.rescisao_modo, '')) = 'consensual'
         AND v_acordo.rescisao_solicitada_por = v_uid THEN
        UPDATE public.acordos
        SET
          rescisao_vigencia = v_vigencia,
          rescisao_justificativa = NULLIF(btrim(COALESCE(p_justificativa, '')), '')
        WHERE id = p_acordo_id;
      ELSE
        UPDATE public.acordos
        SET
          rescisao_modo = 'consensual',
          rescisao_solicitada_por = v_uid,
          rescisao_justificativa = NULLIF(btrim(COALESCE(p_justificativa, '')), ''),
          rescisao_vigencia = v_vigencia,
          rescisao_effective_on = NULL
        WHERE id = p_acordo_id;
      END IF;

      BEGIN
        INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
        SELECT
          t.user_id,
          CASE
            WHEN v_vigencia = 'fim_ciclo' THEN
              'A outra parte pediu encerramento amigável no fim deste mês — confirma em Acordos.'
            ELSE
              'A outra parte pediu encerramento amigável imediato (ajuste proporcional) — confirma em Acordos.'
          END,
          'warning',
          jsonb_build_object(
            'type', 'agreement_update',
            'acordo_id', p_acordo_id,
            'rescisao_modo', 'consensual',
            'rescisao_vigencia', v_vigencia
          )
        FROM (
          SELECT v_acordo.driver_id AS user_id
          UNION
          SELECT ap.passenger_id
          FROM public.acordos_passageiros ap
          WHERE ap.acordo_id = p_acordo_id
            AND lower(ap.estado) IN ('activo', 'reservado')
        ) t
        WHERE t.user_id IS DISTINCT FROM v_uid;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Falha ao notificar pedido consensual do acordo %: %',
            p_acordo_id, SQLERRM;
      END;

      IF p_idempotency_key IS NOT NULL THEN
        INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
        VALUES (p_idempotency_key, 'terminate_agreement', p_acordo_id, v_uid)
        ON CONFLICT (idempotency_key) DO NOTHING;
      END IF;

      RETURN p_acordo_id;
    END IF;

    v_vigencia := lower(COALESCE(
      NULLIF(btrim(COALESCE(v_acordo.rescisao_vigencia, '')), ''),
      'imediato'
    ));

    IF v_vigencia = 'fim_ciclo' THEN
      UPDATE public.acordos
      SET
        estado = 'cancelamento_pendente',
        rescisao_modo = 'consensual',
        rescisao_vigencia = 'fim_ciclo',
        rescisao_effective_on = v_effective,
        rescisao_confirmada_por = v_uid,
        rescisao_confirmada_em = now()
      WHERE id = p_acordo_id;

      v_mensagem := 'Encerramento amigável confirmado; o acordo mantém-se activo até ao fim deste mês.';
    ELSE
      v_dias_uteis := COALESCE(v_acordo.dias_uteis_mes, 0);
      IF v_dias_uteis < 1 THEN
        RAISE EXCEPTION 'Dias úteis do acordo inválidos para calcular a rescisão.';
      END IF;

      PERFORM public._p0_finalize_lugares_rescisao_imediata(p_acordo_id, v_hoje);

      PERFORM set_config('boleia.skip_acordo_cancel_notif', 'on', true);

      UPDATE public.acordos
      SET
        estado = 'cancelado',
        rescisao_modo = 'consensual',
        rescisao_vigencia = 'imediato',
        rescisao_effective_on = v_hoje,
        cancelado_em = now(),
        rescisao_confirmada_por = v_uid,
        rescisao_confirmada_em = now()
      WHERE id = p_acordo_id;

      PERFORM set_config('boleia.skip_acordo_cancel_notif', 'off', true);

      PERFORM public.recount_oferta_vagas(v_acordo.oferta_id);

      BEGIN
        PERFORM public.promote_waitlist(v_acordo.oferta_id);
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Falha best-effort promote_waitlist na rescisão do acordo %: %',
            p_acordo_id, SQLERRM;
      END;

      v_mensagem := 'A rescisão consensual foi confirmada; o acordo está encerrado com ajuste proporcional.';
    END IF;

  ELSE
    IF lower(v_acordo.estado) NOT IN ('activo', 'cancelamento_pendente') THEN
      RAISE EXCEPTION 'Este acordo já não está activo.';
    END IF;

    IF NULLIF(btrim(COALESCE(p_justificativa, '')), '') IS NULL THEN
      RAISE EXCEPTION 'A justa causa exige uma justificativa.';
    END IF;

    IF lower(btrim(p_justificativa)) NOT IN
       ('faltas_excessivas', 'avaria_veiculo', 'seguranca') THEN
      RAISE EXCEPTION
        'Justificativa inválida. Use faltas_excessivas, avaria_veiculo ou seguranca.';
    END IF;

    v_dias_uteis := COALESCE(v_acordo.dias_uteis_mes, 0);

    IF v_dias_uteis < 1 THEN
      RAISE EXCEPTION 'Dias úteis do acordo inválidos para calcular a rescisão.';
    END IF;

    IF lower(btrim(p_justificativa)) = 'faltas_excessivas' THEN
      IF v_is_driver THEN
        SELECT EXISTS (
          SELECT 1
          FROM public.faltas f
          WHERE f.id_acordo = p_acordo_id
            AND f.tipo = 'Passageiro'
            AND f.data_falta >= v_mes_inicio
            AND f.data_falta <= v_hoje
          GROUP BY f.passenger_id
          HAVING COUNT(*)::numeric > (v_dias_uteis::numeric / 2.0)
        ) INTO v_faltas_ok;
      ELSE
        SELECT (COUNT(*)::numeric > (v_dias_uteis::numeric / 2.0))
        INTO v_faltas_ok
        FROM public.faltas f
        WHERE f.id_acordo = p_acordo_id
          AND f.tipo = 'Motorista'
          AND f.data_falta >= v_mes_inicio
          AND f.data_falta <= v_hoje;
      END IF;

      IF NOT v_faltas_ok THEN
        RAISE EXCEPTION
          'As faltas registadas neste mês não chegam para justa causa por faltas excessivas.';
      END IF;
    END IF;

    PERFORM public._p0_finalize_lugares_rescisao_imediata(p_acordo_id, v_hoje);

    UPDATE public.acordos
    SET
      estado = 'cancelado_justificado',
      rescisao_modo = 'justa_causa',
      rescisao_solicitada_por = v_uid,
      rescisao_justificativa = lower(btrim(p_justificativa)),
      rescisao_vigencia = NULL,
      rescisao_effective_on = v_hoje,
      cancelado_em = now()
    WHERE id = p_acordo_id;

    PERFORM public.recount_oferta_vagas(v_acordo.oferta_id);

    BEGIN
      PERFORM public.promote_waitlist(v_acordo.oferta_id);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Falha best-effort promote_waitlist na rescisão do acordo %: %',
          p_acordo_id, SQLERRM;
    END;

    v_mensagem := 'A outra parte rescindiu o acordo por justa causa.';
  END IF;

  SELECT estado INTO v_estado_final FROM public.acordos WHERE id = p_acordo_id;

  BEGIN
    INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
    SELECT
      t.user_id,
      v_mensagem,
      'warning',
      jsonb_build_object(
        'type', 'agreement_update',
        'acordo_id', p_acordo_id,
        'rescisao_modo', v_modo,
        'acordo_estado', v_estado_final
      )
    FROM (
      SELECT v_acordo.driver_id AS user_id
      UNION
      SELECT ap.passenger_id
      FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = p_acordo_id
    ) t
    WHERE t.user_id IS DISTINCT FROM v_uid;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Falha ao notificar rescisão do acordo %: %', p_acordo_id, SQLERRM;
  END;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'terminate_agreement', p_acordo_id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN p_acordo_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.leave_passenger(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_passenger(uuid, uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.leave_passenger(uuid, uuid, uuid) FROM anon;

REVOKE ALL ON FUNCTION public.terminate_agreement(uuid, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.terminate_agreement(uuid, text, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.terminate_agreement(uuid, text, text, uuid, text) FROM anon;
