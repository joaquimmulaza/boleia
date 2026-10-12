-- P0: persistir justa causa por lugar (UI motorista v1.10) + terminate_agreement (base 20261012210000).
-- Base terminate_agreement: 20261012210000_justa_causa_passageiro_1n.sql

ALTER TABLE public.acordos_passageiros
  ADD COLUMN IF NOT EXISTS lugar_rescisao_modo text,
  ADD COLUMN IF NOT EXISTS lugar_rescisao_em timestamptz;

ALTER TABLE public.acordos_passageiros
  DROP CONSTRAINT IF EXISTS acordos_passageiros_lugar_rescisao_modo_check;

ALTER TABLE public.acordos_passageiros
  ADD CONSTRAINT acordos_passageiros_lugar_rescisao_modo_check
  CHECK (lugar_rescisao_modo IS NULL OR lugar_rescisao_modo IN ('justa_causa'));

CREATE OR REPLACE FUNCTION public.terminate_agreement(
  p_acordo_id uuid,
  p_modo text,
  p_justificativa text DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL,
  p_vigencia text DEFAULT 'imediato'
)
RETURNS jsonb
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
  v_link text;
  v_ap_row public.acordos_passageiros%ROWTYPE;
  v_vivos_restantes integer;
  v_ultimo_passageiro_saiu boolean := false;
  v_pax_nome text;
  v_mensagem_motorista text;
  v_jc_invocador_reservado boolean := false;
  v_jc_invocador_variant text;
  v_lugar_rescisao_em timestamptz;
  v_skip_rescisao_broadcast boolean := false;
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
      RETURN jsonb_build_object('acordo_id', p_acordo_id, 'status', 'ok');
    END IF;
  END IF;

  v_modo := lower(COALESCE(p_modo, ''));
  v_link := '/acordos?openAcordoId=' || p_acordo_id::text;

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
    RETURN jsonb_build_object('acordo_id', p_acordo_id, 'status', 'confirmado_idempotente');
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
    IF lower(COALESCE(v_acordo.rescisao_modo, '')) = 'consensual'
       AND v_acordo.rescisao_solicitada_por IS NOT NULL
       AND v_acordo.rescisao_confirmada_em IS NULL
       AND lower(v_acordo.estado) = 'activo' THEN
      RAISE EXCEPTION
        'Já existe um pedido de encerramento amigável pendente. Confirma ou recusa antes de escolher outra modalidade.';
    END IF;

    IF lower(v_acordo.estado) <> 'activo' THEN
      RAISE EXCEPTION 'Este acordo já não está activo.';
    END IF;

    UPDATE public.acordos
    SET
      estado = 'cancelamento_pendente',
      rescisao_modo = 'aviso_previo',
      rescisao_solicitada_por = v_uid,
      rescisao_solicitada_em = now(),
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
       AND lower(v_acordo.estado) <> 'activo'
       AND v_acordo.rescisao_confirmada_em IS NULL THEN
      IF p_idempotency_key IS NOT NULL THEN
        INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
        VALUES (p_idempotency_key, 'terminate_agreement', p_acordo_id, v_uid)
        ON CONFLICT (idempotency_key) DO NOTHING;
      END IF;
      RETURN jsonb_build_object('acordo_id', p_acordo_id, 'status', 'ja_encerrado');
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
         AND v_acordo.rescisao_solicitada_por IS NOT NULL
         AND v_acordo.rescisao_confirmada_em IS NULL THEN
        RAISE EXCEPTION
          'Já existe um pedido de encerramento amigável pendente. Confirma ou recusa antes de iniciar outro pedido.';
      END IF;

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
          rescisao_solicitada_em = now(),
          rescisao_justificativa = NULLIF(btrim(COALESCE(p_justificativa, '')), ''),
          rescisao_vigencia = v_vigencia,
          rescisao_effective_on = NULL
        WHERE id = p_acordo_id;
      END IF;

      BEGIN
        INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata, link)
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
          ),
          v_link || '&focus=rescisao'
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

      RETURN jsonb_build_object('acordo_id', p_acordo_id, 'status', 'ok');
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

      INSERT INTO public._acordo_cancel_notif_suppress (
        acordo_id, txid, reason, suppress_driver, suppress_passenger
      ) VALUES (
        p_acordo_id, txid_current(), 'terminate_consensual_immediate', true, true
      );

      PERFORM public._p0_finalize_lugares_rescisao_imediata(p_acordo_id, v_hoje);

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

    IF NOT v_is_driver THEN
      SELECT * INTO v_ap_row
      FROM public.acordos_passageiros
      WHERE acordo_id = p_acordo_id
        AND passenger_id = v_uid
      FOR UPDATE;

      IF NOT FOUND OR lower(v_ap_row.estado) NOT IN ('activo', 'reservado') THEN
        RAISE EXCEPTION 'Passageiro não está activo neste acordo.';
      END IF;

      v_jc_invocador_reservado := lower(v_ap_row.estado) = 'reservado';

      IF lower(v_ap_row.estado) = 'reservado' THEN
        PERFORM public._expirar_lugar_reservado_sem_divida(
          v_ap_row.id,
          'Rescisão por justa causa'
        );
      ELSE
        UPDATE public.acordos_passageiros SET estado = 'saiu' WHERE id = v_ap_row.id;
        PERFORM public.ajustar_obrigacao_pagamento_mes(v_ap_row.id, v_hoje, false);
      END IF;

      UPDATE public.acordos_passageiros
      SET
        lugar_rescisao_modo = 'justa_causa',
        lugar_rescisao_em = now()
      WHERE id = v_ap_row.id;

      SELECT ap.lugar_rescisao_em INTO v_lugar_rescisao_em
      FROM public.acordos_passageiros ap
      WHERE ap.id = v_ap_row.id;

      SELECT COUNT(*)::integer INTO v_vivos_restantes
      FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = p_acordo_id
        AND lower(ap.estado) IN ('activo', 'reservado');

      v_ultimo_passageiro_saiu := (v_vivos_restantes = 0);

      IF v_ultimo_passageiro_saiu THEN
        INSERT INTO public._acordo_cancel_notif_suppress (
          acordo_id, txid, reason, suppress_driver, suppress_passenger
        ) VALUES (
          p_acordo_id, txid_current(), 'last_passenger_jc_self', true, true
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
      END IF;

      PERFORM public.recount_oferta_vagas(v_acordo.oferta_id);

      BEGIN
        PERFORM public.promote_waitlist(v_acordo.oferta_id);
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Falha best-effort promote_waitlist na justa causa passageiro %: %',
            p_acordo_id, SQLERRM;
      END;

      SELECT NULLIF(btrim(COALESCE(p.nome_completo, '')), '')
      INTO v_pax_nome
      FROM public.perfis p
      WHERE p.id = v_uid;

      SELECT lower(estado) INTO v_estado_final FROM public.acordos WHERE id = p_acordo_id;

      IF v_ultimo_passageiro_saiu AND lower(COALESCE(v_estado_final, '')) = 'cancelado' THEN
        v_mensagem_motorista := CASE
          WHEN v_pax_nome IS NOT NULL THEN
            v_pax_nome || ' rescindiu por justa causa e o acordo foi encerrado. A tua oferta continua publicada.'
          ELSE
            'O último passageiro rescindiu por justa causa e o acordo foi encerrado. A tua oferta continua publicada.'
        END;
      ELSE
        v_mensagem_motorista := CASE
          WHEN v_pax_nome IS NOT NULL THEN
            v_pax_nome || ' rescindiu o lugar por justa causa. Ficou um lugar livre.'
          ELSE
            'Um passageiro rescindiu o lugar por justa causa. Ficou um lugar livre.'
        END;
      END IF;

      BEGIN
        INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata, link)
        VALUES (
          v_acordo.driver_id,
          v_mensagem_motorista,
          'warning',
          jsonb_build_object(
            'type', 'agreement_update',
            'acordo_id', p_acordo_id,
            'rescisao_modo', 'justa_causa',
            'acordo_estado', v_estado_final
          ),
          v_link
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Falha ao notificar motorista justa causa passageiro %: %',
            p_acordo_id, SQLERRM;
      END;

      v_jc_invocador_variant := CASE
        WHEN v_jc_invocador_reservado THEN 'reservado'
        WHEN v_ultimo_passageiro_saiu THEN 'ultimo'
        ELSE 'parcial'
      END;

      BEGIN
        INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata, link)
        VALUES (
          v_uid,
          '·',
          'info',
          jsonb_build_object(
            'type', 'justa_causa_passageiro_invocador',
            'acordo_id', p_acordo_id,
            'rescisao_modo', 'justa_causa',
            'variant', v_jc_invocador_variant,
            'lugar_rescisao_em', v_lugar_rescisao_em,
            'acordo_estado', v_estado_final
          ),
          v_link
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Falha ao notificar invocador justa causa passageiro %: %',
            p_acordo_id, SQLERRM;
      END;

      v_skip_rescisao_broadcast := true;
    ELSE
      INSERT INTO public._acordo_cancel_notif_suppress (
        acordo_id, txid, reason, suppress_driver, suppress_passenger
      ) VALUES (
        p_acordo_id, txid_current(), 'terminate_justa_causa', true, true
      );

      PERFORM public._p0_finalize_lugares_rescisao_imediata(
        p_acordo_id,
        v_hoje,
        'Rescisão por justa causa'
      );

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
  END IF;

  IF v_estado_final IS NULL THEN
    SELECT estado INTO v_estado_final FROM public.acordos WHERE id = p_acordo_id;
  END IF;

  IF NOT v_skip_rescisao_broadcast AND v_mensagem IS NOT NULL THEN
  BEGIN
    INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata, link)
    SELECT
      t.user_id,
      v_mensagem,
      'warning',
      jsonb_build_object(
        'type', 'agreement_update',
        'acordo_id', p_acordo_id,
        'rescisao_modo', v_modo,
        'acordo_estado', v_estado_final
      ),
      CASE
        WHEN lower(COALESCE(v_modo, '')) = 'consensual'
          AND lower(COALESCE(v_estado_final, '')) IN ('cancelado', 'cancelamento_pendente')
          THEN v_link || '&focus=rescisao'
        ELSE v_link
      END
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
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'terminate_agreement', p_acordo_id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('acordo_id', p_acordo_id, 'status', 'ok');
END;
$function$;

REVOKE ALL ON FUNCTION public.terminate_agreement(uuid, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.terminate_agreement(uuid, text, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.terminate_agreement(uuid, text, text, uuid, text) FROM anon;
