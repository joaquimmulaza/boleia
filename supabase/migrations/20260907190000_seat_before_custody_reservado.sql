-- seat-before-custody: soft-hold reservado até em_custodia

ALTER TABLE public.acordos_passageiros
  DROP CONSTRAINT IF EXISTS acordos_passageiros_estado_check;

ALTER TABLE public.acordos_passageiros
  ADD CONSTRAINT acordos_passageiros_estado_check
  CHECK (estado = ANY (ARRAY['activo'::text, 'reservado'::text, 'saiu'::text]));

CREATE OR REPLACE FUNCTION public.oferta_ocupacao(p_oferta_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(COUNT(*), 0)::integer
  FROM public.acordos_passageiros ap
  JOIN public.acordos a ON a.id = ap.acordo_id
  WHERE a.oferta_id = p_oferta_id
    AND lower(a.estado) IN ('activo', 'cancelamento_pendente')
    AND lower(ap.estado) IN ('activo', 'reservado');
$function$;

CREATE OR REPLACE FUNCTION public.trg_acordos_passageiros_create_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_driver_id uuid;
  v_take_rate numeric := 0.10;
  v_mes date := date_trunc('month', timezone('Africa/Luanda', now()))::date;
BEGIN
  IF lower(COALESCE(NEW.estado, '')) NOT IN ('activo', 'reservado') THEN
    RETURN NEW;
  END IF;

  SELECT driver_id INTO v_driver_id
  FROM public.acordos
  WHERE id = NEW.acordo_id;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Acordo não encontrado para pagamento.';
  END IF;

  INSERT INTO public.pagamentos_acordo (
    acordo_id,
    acordo_passageiro_id,
    passenger_id,
    driver_id,
    valor_kz,
    take_rate_pct,
    valor_payout_liquido_kz,
    mes_referencia
  ) VALUES (
    NEW.acordo_id,
    NEW.id,
    NEW.passenger_id,
    v_driver_id,
    NEW.quota_mensal_kz,
    v_take_rate,
    public.compute_payout_liquido_kz(NEW.quota_mensal_kz, v_take_rate),
    v_mes
  )
  ON CONFLICT (acordo_passageiro_id, mes_referencia) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_proposal(
  p_proposta_id uuid,
  p_member_ids uuid[] DEFAULT NULL::uuid[],
  p_idempotency_key uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prop public.propostas%ROWTYPE;
  v_oferta public.ofertas_capacidade%ROWTYPE;
  v_procura public.procuras%ROWTYPE;
  v_ocupadas integer;
  v_disponiveis integer;
  v_n integer;
  v_total integer;
  v_base integer;
  v_resto integer;
  v_acordo_id uuid;
  v_uid uuid := auth.uid();
  v_member_id uuid;
  v_membro public.membros_grupo%ROWTYPE;
  v_ids uuid[];
  v_seen uuid[] := ARRAY[]::uuid[];
  i integer := 0;
  v_quota integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      SELECT subject_id INTO v_acordo_id
      FROM public.rpc_idempotency
      WHERE idempotency_key = p_idempotency_key;
      RETURN v_acordo_id;
    END IF;
  END IF;

  SELECT * INTO v_prop FROM public.propostas WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada.';
  END IF;
  IF v_prop.estado <> 'aberta' THEN
    RAISE EXCEPTION 'Proposta não está aberta.';
  END IF;

  IF v_uid = v_prop.created_by THEN
    RAISE EXCEPTION 'Só a contraparte pode aceitar ou rejeitar esta proposta.';
  END IF;

  SELECT * INTO v_oferta FROM public.ofertas_capacidade WHERE id = v_prop.oferta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta não encontrada.';
  END IF;

  SELECT * INTO v_procura FROM public.procuras WHERE id = v_prop.procura_id;
  IF v_uid IS DISTINCT FROM v_oferta.driver_id AND v_uid IS DISTINCT FROM v_procura.owner_id THEN
    RAISE EXCEPTION 'Sem permissão para aceitar esta proposta.';
  END IF;

  SELECT COALESCE(COUNT(*), 0) INTO v_ocupadas
  FROM public.acordos_passageiros ap
  JOIN public.acordos a ON a.id = ap.acordo_id
  WHERE a.oferta_id = v_oferta.id
    AND lower(a.estado) IN ('activo', 'cancelamento_pendente')
    AND lower(ap.estado) IN ('activo', 'reservado');

  v_disponiveis := v_oferta.vagas_totais - v_ocupadas;
  v_n := v_prop.n_passageiros_propostos;

  IF v_n > v_disponiveis THEN
    RAISE EXCEPTION 'Vagas insuficientes para este grupo. Use lista de espera.';
  END IF;

  IF v_prop.modo_preco = 'POR_PASSAGEIRO' THEN
    v_base := v_prop.valor_mensal_ask_kz;
    v_total := v_base * v_n;
    v_resto := 0;
  ELSIF v_prop.modo_preco = 'TOTAL_ACORDO' THEN
    v_total := v_prop.valor_mensal_ask_kz;
    v_base := v_total / v_n;
    v_resto := v_total % v_n;
  ELSE
    RAISE EXCEPTION 'Modo de preço desconhecido.';
  END IF;

  INSERT INTO public.acordos (
    oferta_id, procura_id, grupo_id, driver_id,
    modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz,
    estado
  ) VALUES (
    v_prop.oferta_id, v_prop.procura_id, v_prop.grupo_id, v_oferta.driver_id,
    v_prop.modo_preco, v_n,
    v_total, v_base,
    'activo'
  ) RETURNING id INTO v_acordo_id;

  IF v_prop.grupo_id IS NOT NULL THEN
    v_ids := COALESCE(p_member_ids, ARRAY[]::uuid[]);

    IF cardinality(v_ids) IS DISTINCT FROM v_n THEN
      RAISE EXCEPTION 'Capacidade inconsistente com proposta';
    END IF;

    FOREACH v_member_id IN ARRAY v_ids
    LOOP
      IF v_member_id = ANY (v_seen) THEN
        RAISE EXCEPTION 'Capacidade inconsistente com proposta';
      END IF;
      v_seen := array_append(v_seen, v_member_id);

      SELECT *
      INTO v_membro
      FROM public.membros_grupo
      WHERE grupo_id = v_prop.grupo_id
        AND passenger_id = v_member_id
        AND lower(estado) = 'activo';

      IF NOT FOUND THEN
        RAISE EXCEPTION
          'Membro % não está activo no grupo da proposta.',
          v_member_id;
      END IF;

      IF v_prop.modo_preco = 'POR_PASSAGEIRO' THEN
        v_quota := v_base;
      ELSE
        v_quota := CASE WHEN i < v_resto THEN v_base + 1 ELSE v_base END;
      END IF;

      INSERT INTO public.acordos_passageiros (
        acordo_id, passenger_id, quota_mensal_kz, ordem_insercao,
        pickup_name, pickup_lat, pickup_lng,
        dropoff_name, dropoff_lat, dropoff_lng,
        estado
      ) VALUES (
        v_acordo_id, v_membro.passenger_id, v_quota, i,
        v_membro.pickup_name, v_membro.pickup_lat, v_membro.pickup_lng,
        v_membro.dropoff_name, v_membro.dropoff_lat, v_membro.dropoff_lng,
        'reservado'
      );
      i := i + 1;
    END LOOP;
  ELSE
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'Proposta sem grupo exige n_passageiros_propostos = 1.';
    END IF;

    IF p_member_ids IS NOT NULL AND cardinality(p_member_ids) > 0 THEN
      IF cardinality(p_member_ids) <> 1 OR p_member_ids[1] IS DISTINCT FROM v_procura.owner_id THEN
        RAISE EXCEPTION 'Capacidade inconsistente com proposta';
      END IF;
    END IF;

    INSERT INTO public.acordos_passageiros (
      acordo_id, passenger_id, quota_mensal_kz, ordem_insercao, estado
    ) VALUES (
      v_acordo_id, v_procura.owner_id, v_base, 0, 'reservado'
    );
  END IF;

  INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
  SELECT
    ap.passenger_id,
    'Acordo formado: o teu lugar está reservado. Confirma o pagamento para activar o lugar.',
    'success',
    jsonb_build_object('type', 'agreement_update', 'acordo_id', v_acordo_id)
  FROM public.acordos_passageiros ap
  WHERE ap.acordo_id = v_acordo_id AND lower(ap.estado) = 'reservado';

  PERFORM public.recount_oferta_vagas(v_oferta.id);

  UPDATE public.propostas
  SET
    estado = 'aceite',
    valor_mensal_por_passageiro_resolvido_kz = v_base,
    valor_mensal_total_resolvido_kz = v_total,
    updated_at = now()
  WHERE id = v_prop.id;

  UPDATE public.propostas
  SET estado = 'cancelada', updated_at = now()
  WHERE procura_id = v_prop.procura_id
    AND id <> v_prop.id
    AND estado = 'aberta';

  UPDATE public.procuras
  SET estado = 'fechada', updated_at = now()
  WHERE id = v_prop.procura_id;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'accept_proposal', v_acordo_id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_acordo_id;
END;
$function$;

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

  UPDATE public.acordos_passageiros
  SET estado = 'saiu'
  WHERE id = v_row.id;

  PERFORM public.recount_oferta_vagas(v_acordo.oferta_id);

  BEGIN
    PERFORM public.promote_waitlist(v_acordo.oferta_id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Falha best-effort promote_waitlist na saída do acordo %: %',
        p_acordo_id, SQLERRM;
  END;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'leave_passenger', p_acordo_id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN p_acordo_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_validate_payment(
  p_pagamento_id uuid,
  p_aprovar boolean,
  p_motivo text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.pagamentos_acordo%ROWTYPE;
  v_ap public.acordos_passageiros%ROWTYPE;
  v_oferta_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso reservado a administradores.';
  END IF;

  SELECT * INTO v_row
  FROM public.pagamentos_acordo
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado.';
  END IF;

  IF lower(v_row.estado) <> 'comprovativo_enviado' THEN
    RAISE EXCEPTION 'Só comprovativos enviados podem ser validados.';
  END IF;

  IF p_aprovar THEN
    UPDATE public.pagamentos_acordo
    SET
      estado = 'em_custodia',
      validado_por = v_uid,
      validado_em = now(),
      rejeicao_motivo = NULL,
      updated_at = now()
    WHERE id = p_pagamento_id;

    SELECT * INTO v_ap
    FROM public.acordos_passageiros
    WHERE id = v_row.acordo_passageiro_id
    FOR UPDATE;

    IF FOUND AND lower(v_ap.estado) = 'reservado' THEN
      UPDATE public.acordos_passageiros
      SET estado = 'activo'
      WHERE id = v_ap.id;

      SELECT oferta_id INTO v_oferta_id
      FROM public.acordos
      WHERE id = v_ap.acordo_id;

      IF v_oferta_id IS NOT NULL THEN
        PERFORM public.recount_oferta_vagas(v_oferta_id);
      END IF;
    END IF;
  ELSE
    UPDATE public.pagamentos_acordo
    SET
      estado = 'pendente_pagamento',
      comprovativo_path = NULL,
      comprovativo_enviado_em = NULL,
      validado_por = v_uid,
      validado_em = now(),
      rejeicao_motivo = NULLIF(trim(p_motivo), ''),
      updated_at = now()
    WHERE id = p_pagamento_id;
  END IF;

  RETURN p_pagamento_id;
END;
$function$;

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
          AND lower(estado) IN ('activo', 'reservado')
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
        AND lower(estado) IN ('activo', 'reservado')
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
