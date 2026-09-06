-- PACOTE ENG #7: adendas — aceite_agendada, cancelada_substituta, respond_agreement_adenda

ALTER TABLE public.acordos_adendas
  DROP CONSTRAINT IF EXISTS acordos_adendas_estado_check;

ALTER TABLE public.acordos_adendas
  ADD CONSTRAINT acordos_adendas_estado_check
  CHECK (
    lower(estado) = ANY (
      ARRAY[
        'pendente_passageiro'::text,
        'pendente_contraparte'::text,
        'rejeitada'::text,
        'cancelada_iniciador'::text,
        'cancelada_substituta'::text,
        'aceite'::text,
        'aceite_agendada'::text,
        'em_vigor'::text
      ]
    )
  );

-- Normalizar legado aceite → aceite_agendada (sem mutar em_vigor / rejeitada)
UPDATE public.acordos_adendas
SET estado = 'aceite_agendada'
WHERE lower(estado) = 'aceite'
  AND applied_at IS NULL
  AND superseded_at IS NULL;

-- propose: substituir adenda pendente → cancelada_substituta
CREATE OR REPLACE FUNCTION public.renegotiate_agreement_pricing(
  p_acordo_id uuid,
  p_modo_preco text,
  p_valor_ask_kz integer,
  p_n_passageiros integer DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_acordo public.acordos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_is_driver boolean;
  v_is_pax boolean;
  v_estado_inicial text;
  v_n_activos integer;
  v_n integer;
  v_total integer;
  v_base integer;
  v_effective date;
  v_previo_quotas jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      RETURN p_acordo_id;
    END IF;
  END IF;

  IF p_modo_preco IS NULL OR p_valor_ask_kz IS NULL THEN
    RAISE EXCEPTION 'modo_preco e valor_ask_kz são obrigatórios.';
  END IF;

  IF p_valor_ask_kz < 0 THEN
    RAISE EXCEPTION 'Valor em Kz deve ser um inteiro não negativo.';
  END IF;

  PERFORM public.apply_due_agreement_adendas(p_acordo_id);

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = p_acordo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  IF lower(v_acordo.estado) <> 'activo' THEN
    RAISE EXCEPTION 'Acordo não está activo.';
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
    RAISE EXCEPTION 'Sem permissão para renegociar este acordo.';
  END IF;

  v_estado_inicial := CASE
    WHEN v_is_driver THEN 'pendente_passageiro'
    ELSE 'pendente_contraparte'
  END;

  SELECT COALESCE(COUNT(*), 0)::integer INTO v_n_activos
  FROM public.acordos_passageiros
  WHERE acordo_id = p_acordo_id
    AND lower(estado) = 'activo';

  IF v_n_activos < 1 THEN
    RAISE EXCEPTION 'O acordo não tem passageiros activos.';
  END IF;

  v_n := v_acordo.n_passageiros_contrato;

  IF v_n IS NULL OR v_n < 1 THEN
    RAISE EXCEPTION 'N_contrato inválido neste acordo.';
  END IF;

  IF p_n_passageiros IS NOT NULL AND p_n_passageiros IS DISTINCT FROM v_n THEN
    RAISE EXCEPTION
      'n_passageiros (%) deve coincidir com N_contrato (%); sem recálculo retroactivo.',
      p_n_passageiros, v_n;
  END IF;

  IF p_modo_preco = 'POR_PASSAGEIRO' THEN
    v_base := p_valor_ask_kz;
    v_total := v_base * v_n;
  ELSIF p_modo_preco = 'TOTAL_ACORDO' THEN
    v_total := p_valor_ask_kz;
    v_base := v_total / v_n;
  ELSE
    RAISE EXCEPTION 'Modo de preço desconhecido.';
  END IF;

  v_effective := (
    date_trunc('month', timezone('Africa/Luanda', now()))
    + interval '1 month'
  )::date;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'passenger_id', ap.passenger_id,
        'quota_mensal_kz', ap.quota_mensal_kz,
        'estado', ap.estado
      )
      ORDER BY ap.ordem_insercao ASC, ap.passenger_id ASC
    ),
    '[]'::jsonb
  )
  INTO v_previo_quotas
  FROM public.acordos_passageiros ap
  WHERE ap.acordo_id = p_acordo_id;

  UPDATE public.acordos_adendas
  SET
    superseded_at = now(),
    estado = 'cancelada_substituta'
  WHERE acordo_id = p_acordo_id
    AND applied_at IS NULL
    AND superseded_at IS NULL
    AND lower(estado) IN (
      'pendente_passageiro',
      'pendente_contraparte',
      'aceite',
      'aceite_agendada'
    );

  INSERT INTO public.acordos_adendas (
    acordo_id,
    effective_from,
    modo_preco,
    n_passageiros_contrato,
    valor_mensal_total_kz,
    valor_mensal_por_passageiro_kz,
    previo_modo_preco,
    previo_n_passageiros_contrato,
    previo_valor_mensal_total_kz,
    previo_valor_mensal_por_passageiro_kz,
    previo_quotas,
    created_by,
    estado
  ) VALUES (
    p_acordo_id,
    v_effective,
    p_modo_preco,
    v_n,
    v_total,
    v_base,
    v_acordo.modo_preco,
    v_acordo.n_passageiros_contrato,
    v_acordo.valor_mensal_total_kz,
    v_acordo.valor_mensal_por_passageiro_kz,
    v_previo_quotas,
    v_uid,
    v_estado_inicial
  );

  BEGIN
    IF v_is_driver THEN
      INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
      SELECT
        ap.passenger_id,
        'O motorista propôs um novo preço — aceita a adenda em Acordos.',
        'success',
        jsonb_build_object(
          'type', 'agreement_update',
          'acordo_id', p_acordo_id,
          'effective_from', v_effective,
          'adenda_estado', v_estado_inicial
        )
      FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = p_acordo_id
        AND lower(ap.estado) = 'activo';
    ELSE
      INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
      VALUES (
        v_acordo.driver_id,
        'Um passageiro propôs um novo preço — responde à adenda em Acordos.',
        'success',
        jsonb_build_object(
          'type', 'agreement_update',
          'acordo_id', p_acordo_id,
          'effective_from', v_effective,
          'adenda_estado', v_estado_inicial
        )
      );
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Falha ao notificar adenda do acordo %: %', p_acordo_id, SQLERRM;
  END;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'renegotiate_agreement_pricing', p_acordo_id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN p_acordo_id;
END;
$function$;

-- accept: aceite_agendada (não muta live antes de effective_from)
CREATE OR REPLACE FUNCTION public.accept_agreement_adenda(
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
  v_acordo public.acordos%ROWTYPE;
  v_estado text;
  v_is_pax boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_adenda_id IS NULL THEN
    RAISE EXCEPTION 'ID da adenda é obrigatório.';
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

  IF v_adenda.superseded_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta adenda já foi substituída.';
  END IF;

  IF v_adenda.applied_at IS NOT NULL OR lower(v_adenda.estado) = 'em_vigor' THEN
    RAISE EXCEPTION 'Esta adenda já foi aplicada.';
  END IF;

  v_estado := lower(v_adenda.estado);

  IF v_estado IN ('aceite', 'aceite_agendada') THEN
    IF p_idempotency_key IS NOT NULL THEN
      INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
      VALUES (p_idempotency_key, 'accept_agreement_adenda', v_adenda.id, v_uid)
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
    RETURN v_adenda.id;
  END IF;

  IF v_estado NOT IN ('pendente_passageiro', 'pendente_contraparte') THEN
    RAISE EXCEPTION 'Adenda não está pendente de aceitação.';
  END IF;

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = v_adenda.acordo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  IF lower(v_acordo.estado) <> 'activo' THEN
    RAISE EXCEPTION 'Acordo não está activo.';
  END IF;

  IF v_uid = v_adenda.created_by THEN
    RAISE EXCEPTION 'Só a contraparte pode aceitar esta adenda.';
  END IF;

  IF v_estado = 'pendente_passageiro' THEN
    IF v_uid = v_acordo.driver_id THEN
      RAISE EXCEPTION 'Apenas um passageiro activo do acordo pode aceitar a adenda.';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = v_adenda.acordo_id
        AND ap.passenger_id = v_uid
        AND lower(ap.estado) = 'activo'
    ) INTO v_is_pax;

    IF NOT v_is_pax THEN
      RAISE EXCEPTION 'Apenas um passageiro activo do acordo pode aceitar a adenda.';
    END IF;
  ELSE
    IF v_uid IS DISTINCT FROM v_acordo.driver_id THEN
      RAISE EXCEPTION 'Apenas o motorista do acordo pode aceitar esta adenda.';
    END IF;
  END IF;

  UPDATE public.acordos_adendas
  SET
    estado = 'aceite_agendada',
    aceite_em = now(),
    aceite_por = v_uid
  WHERE id = v_adenda.id;

  PERFORM public.apply_due_agreement_adendas(v_adenda.acordo_id);

  BEGIN
    INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
    VALUES (
      v_adenda.created_by,
      'A contraparte aceitou a adenda de preço do acordo.',
      'success',
      jsonb_build_object(
        'type', 'agreement_update',
        'acordo_id', v_adenda.acordo_id,
        'adenda_id', v_adenda.id,
        'adenda_estado', 'aceite_agendada'
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Falha ao notificar aceite de adenda %: %', v_adenda.id, SQLERRM;
  END;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'accept_agreement_adenda', v_adenda.id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_adenda.id;
END;
$function$;

-- apply_due: aceite legado + aceite_agendada
CREATE OR REPLACE FUNCTION public.apply_due_agreement_adendas(
  p_acordo_id uuid DEFAULT NULL::uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (timezone('Africa/Luanda', now()))::date;
  v_adenda public.acordos_adendas%ROWTYPE;
  v_base integer;
  v_resto integer;
  v_quota integer;
  r record;
  i integer;
  v_applied integer := 0;
BEGIN
  FOR v_adenda IN
    SELECT *
    FROM public.acordos_adendas
    WHERE applied_at IS NULL
      AND superseded_at IS NULL
      AND lower(estado) IN ('aceite', 'aceite_agendada')
      AND effective_from <= v_today
      AND (p_acordo_id IS NULL OR acordo_id = p_acordo_id)
    ORDER BY effective_from ASC, created_at ASC
    FOR UPDATE
  LOOP
    UPDATE public.acordos
    SET
      modo_preco = v_adenda.modo_preco,
      n_passageiros_contrato = v_adenda.n_passageiros_contrato,
      valor_mensal_total_kz = v_adenda.valor_mensal_total_kz,
      valor_mensal_por_passageiro_kz = v_adenda.valor_mensal_por_passageiro_kz
    WHERE id = v_adenda.acordo_id;

    IF v_adenda.modo_preco = 'POR_PASSAGEIRO' THEN
      v_base := v_adenda.valor_mensal_por_passageiro_kz;
      v_resto := 0;
    ELSE
      v_base := v_adenda.valor_mensal_por_passageiro_kz;
      v_resto := v_adenda.valor_mensal_total_kz
        - (v_base * v_adenda.n_passageiros_contrato);
      IF v_resto < 0 THEN
        v_resto := 0;
      END IF;
    END IF;

    i := 0;
    FOR r IN
      SELECT id
      FROM public.acordos_passageiros
      WHERE acordo_id = v_adenda.acordo_id
        AND lower(estado) = 'activo'
      ORDER BY ordem_insercao ASC, passenger_id ASC
    LOOP
      IF v_adenda.modo_preco = 'POR_PASSAGEIRO' THEN
        v_quota := v_base;
      ELSE
        v_quota := CASE WHEN i < v_resto THEN v_base + 1 ELSE v_base END;
      END IF;

      UPDATE public.acordos_passageiros
      SET quota_mensal_kz = v_quota
      WHERE id = r.id;

      i := i + 1;
    END LOOP;

    UPDATE public.acordos_adendas
    SET
      applied_at = now(),
      estado = 'em_vigor'
    WHERE id = v_adenda.id;

    v_applied := v_applied + 1;
  END LOOP;

  RETURN v_applied;
END;
$function$;

-- RPC unificada respond (accept | reject)
CREATE OR REPLACE FUNCTION public.respond_agreement_adenda(
  p_adenda_id uuid,
  p_accept boolean,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_accept IS TRUE THEN
    RETURN public.accept_agreement_adenda(p_adenda_id, p_idempotency_key);
  END IF;

  RETURN public.reject_agreement_adenda(p_adenda_id, p_idempotency_key);
END;
$function$;

REVOKE ALL ON FUNCTION public.respond_agreement_adenda(uuid, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_agreement_adenda(uuid, boolean, uuid) TO authenticated;
