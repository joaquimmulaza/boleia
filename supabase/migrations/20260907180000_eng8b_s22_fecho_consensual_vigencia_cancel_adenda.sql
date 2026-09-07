-- ENG#8b: rescisão consensual com vigência (imediato|fim_ciclo) + cancel_agreement_adenda

ALTER TABLE public.acordos
  ADD COLUMN IF NOT EXISTS rescisao_vigencia text;

ALTER TABLE public.acordos
  DROP CONSTRAINT IF EXISTS acordos_rescisao_vigencia_check;

ALTER TABLE public.acordos
  ADD CONSTRAINT acordos_rescisao_vigencia_check
  CHECK (
    rescisao_vigencia IS NULL
    OR lower(rescisao_vigencia) = ANY (ARRAY['imediato'::text, 'fim_ciclo'::text])
  );

DROP FUNCTION IF EXISTS public.terminate_agreement(uuid, text, text, uuid);

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
  v_dias_decorridos integer;
  v_solicitante_is_driver boolean;
  v_confirma boolean := false;
  v_faltas_ok boolean := false;
  v_estado_final text;
  v_mensagem text;
  r record;
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

  v_is_driver := (v_uid = v_acordo.driver_id);

  SELECT EXISTS (
    SELECT 1
    FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id
      AND ap.passenger_id = v_uid
      AND lower(ap.estado) = 'activo'
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
    IF lower(v_acordo.estado) <> 'activo' THEN
      RAISE EXCEPTION 'Este acordo já não está activo.';
    END IF;

    -- Pedido: preferir p_vigencia; confirmação (abaixo) usa a vigência já pedida
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
            AND lower(ap.estado) = 'activo'
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

    -- Confirmação: usar vigência já pedida (não a do confirmante)
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
        rescisao_effective_on = v_effective
      WHERE id = p_acordo_id;

      v_mensagem := 'Encerramento amigável confirmado; o acordo mantém-se activo até ao fim deste mês.';
    ELSE
      v_dias_uteis := COALESCE(v_acordo.dias_uteis_mes, 0);
      IF v_dias_uteis < 1 THEN
        RAISE EXCEPTION 'Dias úteis do acordo inválidos para calcular a rescisão.';
      END IF;

      SELECT COUNT(*)::integer INTO v_dias_decorridos
      FROM generate_series(v_mes_inicio, v_hoje, interval '1 day') AS d
      WHERE EXTRACT(ISODOW FROM d) < 6;

      v_dias_decorridos := LEAST(GREATEST(v_dias_decorridos, 0), v_dias_uteis);

      FOR r IN
        SELECT id, quota_mensal_kz
        FROM public.acordos_passageiros
        WHERE acordo_id = p_acordo_id
          AND lower(estado) = 'activo'
        ORDER BY ordem_insercao ASC, passenger_id ASC
      LOOP
        UPDATE public.acordos_passageiros
        SET
          quota_mensal_kz = GREATEST(
            0,
            LEAST(
              r.quota_mensal_kz,
              ROUND(
                r.quota_mensal_kz::numeric * v_dias_decorridos::numeric
                / v_dias_uteis::numeric
              )::integer
            )
          ),
          estado = 'saiu'
        WHERE id = r.id;
      END LOOP;

      UPDATE public.acordos
      SET
        estado = 'cancelado',
        rescisao_modo = 'consensual',
        rescisao_vigencia = 'imediato',
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

    SELECT COUNT(*)::integer INTO v_dias_decorridos
    FROM generate_series(v_mes_inicio, v_hoje, interval '1 day') AS d
    WHERE EXTRACT(ISODOW FROM d) < 6;

    v_dias_decorridos := LEAST(GREATEST(v_dias_decorridos, 0), v_dias_uteis);

    FOR r IN
      SELECT id, quota_mensal_kz
      FROM public.acordos_passageiros
      WHERE acordo_id = p_acordo_id
        AND lower(estado) = 'activo'
      ORDER BY ordem_insercao ASC, passenger_id ASC
    LOOP
      UPDATE public.acordos_passageiros
      SET
        quota_mensal_kz = GREATEST(
          0,
          LEAST(
            r.quota_mensal_kz,
            ROUND(
              r.quota_mensal_kz::numeric * v_dias_decorridos::numeric
              / v_dias_uteis::numeric
            )::integer
          )
        ),
        estado = 'saiu'
      WHERE id = r.id;
    END LOOP;

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

REVOKE ALL ON FUNCTION public.terminate_agreement(uuid, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.terminate_agreement(uuid, text, text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_agreement_adenda(
  p_adenda_id uuid,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_adenda public.acordos_adendas%ROWTYPE;
  v_estado text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_adenda_id IS NULL THEN
    RAISE EXCEPTION 'adenda_id é obrigatório.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      RETURN p_adenda_id;
    END IF;
  END IF;

  SELECT * INTO v_adenda
  FROM public.acordos_adendas
  WHERE id = p_adenda_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Adenda não encontrada.';
  END IF;

  v_estado := lower(v_adenda.estado);

  IF v_estado = 'cancelada_iniciador' THEN
    IF p_idempotency_key IS NOT NULL THEN
      INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
      VALUES (p_idempotency_key, 'cancel_agreement_adenda', v_adenda.id, v_uid)
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
    RETURN v_adenda.id;
  END IF;

  IF v_estado NOT IN ('pendente_passageiro', 'pendente_contraparte') THEN
    RAISE EXCEPTION 'Só podes anular uma renegociação ainda pendente.';
  END IF;

  IF v_uid IS DISTINCT FROM v_adenda.created_by THEN
    RAISE EXCEPTION 'Só quem iniciou a renegociação a pode anular.';
  END IF;

  UPDATE public.acordos_adendas
  SET
    estado = 'cancelada_iniciador',
    superseded_at = now()
  WHERE id = v_adenda.id;

  BEGIN
    INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
    SELECT
      t.user_id,
      'A renegociação de preço foi anulada por quem a propôs.',
      'info',
      jsonb_build_object(
        'type', 'agreement_update',
        'acordo_id', v_adenda.acordo_id,
        'adenda_id', v_adenda.id,
        'adenda_estado', 'cancelada_iniciador'
      )
    FROM (
      SELECT a.driver_id AS user_id
      FROM public.acordos a
      WHERE a.id = v_adenda.acordo_id
      UNION
      SELECT ap.passenger_id
      FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = v_adenda.acordo_id
        AND lower(ap.estado) = 'activo'
    ) t
    WHERE t.user_id IS DISTINCT FROM v_uid;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Falha ao notificar anulação de adenda %: %', v_adenda.id, SQLERRM;
  END;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'cancel_agreement_adenda', v_adenda.id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_adenda.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_agreement_adenda(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_agreement_adenda(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_agreement_adenda(uuid, uuid) TO authenticated;
