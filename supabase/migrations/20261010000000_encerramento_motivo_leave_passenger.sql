-- leave_passenger: consensual pendente (sem rescisao_confirmada_em) não bloqueia sem_lugares_vivos.
-- Justa causa e consensual confirmado mantêm encerramento_motivo NULL.

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
  END IF;

  PERFORM public._maybe_fechar_acordo_sem_lugares_vivos(p_acordo_id);

  IF v_ultimo_passageiro_saiu THEN
    UPDATE public.acordos
    SET encerramento_motivo = 'sem_lugares_vivos'
    WHERE id = p_acordo_id
      AND lower(estado) = 'cancelado'
      AND lower(coalesce(rescisao_modo, '')) <> 'justa_causa'
      AND rescisao_confirmada_em IS NULL
      AND encerramento_motivo IS NULL;
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

  IF v_uid IS DISTINCT FROM v_acordo.driver_id THEN
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
