-- PACOTE ENG #14 — renovação explícita M0→M1 sem recriar acordo
-- Extends ENG #5 (pagamentos) + adendas em_vigor. Valores sempre do acordo/adenda — NUNCA defaults plataforma.

-- === 1. Pagamentos: um registo por lugar + mês ===
ALTER TABLE public.pagamentos_acordo
  DROP CONSTRAINT IF EXISTS pagamentos_acordo_acordo_passageiro_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_acordo_passageiro_mes_uniq
  ON public.pagamentos_acordo (acordo_passageiro_id, mes_referencia);

-- === 2. Acordos: estado de renovação explícita ===
ALTER TABLE public.acordos
  ADD COLUMN IF NOT EXISTS renovacao_estado text,
  ADD COLUMN IF NOT EXISTS renovacao_proximo_mes date,
  ADD COLUMN IF NOT EXISTS renovacao_por uuid,
  ADD COLUMN IF NOT EXISTS renovacao_em timestamptz;

ALTER TABLE public.acordos
  DROP CONSTRAINT IF EXISTS acordos_renovacao_estado_check;

ALTER TABLE public.acordos
  ADD CONSTRAINT acordos_renovacao_estado_check
  CHECK (
    renovacao_estado IS NULL
    OR lower(renovacao_estado) = ANY (ARRAY['renovado', 'nao_renovar'])
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'acordos_renovacao_por_fkey'
  ) THEN
    ALTER TABLE public.acordos
      ADD CONSTRAINT acordos_renovacao_por_fkey
      FOREIGN KEY (renovacao_por)
      REFERENCES public.perfis(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_acordos_renovacao_proximo_mes
  ON public.acordos (renovacao_proximo_mes)
  WHERE renovacao_estado IS NOT NULL;

-- === 3. Helper: termos vigentes (adenda em_vigor ou cabeçalho acordo) ===
CREATE OR REPLACE FUNCTION public._resolve_termos_vigentes_acordo(p_acordo_id uuid)
RETURNS TABLE (
  modo_preco text,
  n_passageiros_contrato integer,
  valor_mensal_total_kz integer,
  valor_mensal_por_passageiro_kz integer,
  adenda_origem_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_acordo public.acordos%ROWTYPE;
  v_adenda public.acordos_adendas%ROWTYPE;
BEGIN
  SELECT * INTO v_acordo FROM public.acordos WHERE id = p_acordo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  SELECT * INTO v_adenda
  FROM public.acordos_adendas ad
  WHERE ad.acordo_id = p_acordo_id
    AND lower(ad.estado) = 'em_vigor'
    AND ad.superseded_at IS NULL
  ORDER BY ad.applied_at DESC NULLS LAST, ad.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      v_adenda.modo_preco,
      v_adenda.n_passageiros_contrato,
      v_adenda.valor_mensal_total_kz,
      v_adenda.valor_mensal_por_passageiro_kz,
      v_adenda.id;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_acordo.modo_preco,
    v_acordo.n_passageiros_contrato,
    v_acordo.valor_mensal_total_kz,
    v_acordo.valor_mensal_por_passageiro_kz,
    NULL::uuid;
END;
$function$;

-- === 4. Helper: criar pagamentos de um período (quota congelada por passageiro) ===
CREATE OR REPLACE FUNCTION public._create_pagamentos_periodo(
  p_acordo_id uuid,
  p_mes_referencia date,
  p_driver_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_take_rate numeric := 0.10;
  v_count integer := 0;
  r record;
  v_new_id uuid;
BEGIN
  IF p_acordo_id IS NULL OR p_mes_referencia IS NULL OR p_driver_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT ap.id AS ap_id, ap.passenger_id, ap.quota_mensal_kz
    FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id
      AND lower(ap.estado) = 'activo'
    ORDER BY ap.ordem_insercao ASC, ap.passenger_id ASC
  LOOP
    v_new_id := NULL;
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
      p_acordo_id,
      r.ap_id,
      r.passenger_id,
      p_driver_id,
      r.quota_mensal_kz,
      v_take_rate,
      public.compute_payout_liquido_kz(r.quota_mensal_kz, v_take_rate),
      p_mes_referencia
    )
    ON CONFLICT (acordo_passageiro_id, mes_referencia) DO NOTHING
    RETURNING id INTO v_new_id;

    IF v_new_id IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- === 5. Trigger M0: ON CONFLICT por (passageiro, mês) ===
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
  IF lower(COALESCE(NEW.estado, '')) <> 'activo' THEN
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

-- === 6. RPC: renew_agreement_period (explícita) ===
CREATE OR REPLACE FUNCTION public.renew_agreement_period(
  p_acordo_id uuid,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_acordo public.acordos%ROWTYPE;
  v_hoje date := (timezone('Africa/Luanda', now()))::date;
  v_mes_atual date := date_trunc('month', v_hoje)::date;
  v_proximo_mes date := (date_trunc('month', v_hoje) + interval '1 month')::date;
  v_is_driver boolean;
  v_is_pax boolean;
  v_termos record;
  v_pagamentos_criados integer;
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
      RETURN jsonb_build_object('acordo_id', p_acordo_id, 'idempotent', true);
    END IF;
  END IF;

  PERFORM public.apply_due_agreement_adendas(p_acordo_id);
  PERFORM public.apply_due_agreement_terminations(p_acordo_id);
  PERFORM public.apply_due_agreement_non_renewals(p_acordo_id);

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = p_acordo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  IF lower(v_acordo.estado) <> 'activo' THEN
    RAISE EXCEPTION 'Só acordos activos podem ser renovados.';
  END IF;

  v_is_driver := (v_uid = v_acordo.driver_id);
  SELECT EXISTS (
    SELECT 1 FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id
      AND ap.passenger_id = v_uid
      AND lower(ap.estado) = 'activo'
  ) INTO v_is_pax;

  IF NOT v_is_driver AND NOT v_is_pax THEN
    RAISE EXCEPTION 'Sem permissão para renovar este acordo.';
  END IF;

  IF lower(COALESCE(v_acordo.renovacao_estado, '')) = 'renovado'
     AND v_acordo.renovacao_proximo_mes = v_proximo_mes THEN
    RETURN jsonb_build_object(
      'acordo_id', p_acordo_id,
      'mes_referencia', v_proximo_mes,
      'already_renewed', true
    );
  END IF;

  IF lower(COALESCE(v_acordo.renovacao_estado, '')) = 'nao_renovar' THEN
    RAISE EXCEPTION 'Renovação recusada — o acordo termina no fim deste ciclo.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pagamentos_acordo pg
    WHERE pg.acordo_id = p_acordo_id
      AND pg.mes_referencia = v_proximo_mes
  ) THEN
    RAISE EXCEPTION 'Pagamentos do próximo período já existem.';
  END IF;

  SELECT * INTO v_termos FROM public._resolve_termos_vigentes_acordo(p_acordo_id);

  v_pagamentos_criados := public._create_pagamentos_periodo(
    p_acordo_id,
    v_proximo_mes,
    v_acordo.driver_id
  );

  IF v_pagamentos_criados = 0 THEN
    RAISE EXCEPTION 'Não há passageiros activos para renovar.';
  END IF;

  UPDATE public.acordos
  SET
    renovacao_estado = 'renovado',
    renovacao_proximo_mes = v_proximo_mes,
    renovacao_por = v_uid,
    renovacao_em = now(),
    rescisao_modo = NULL,
    rescisao_solicitada_por = NULL,
    rescisao_justificativa = NULL,
    rescisao_effective_on = NULL
  WHERE id = p_acordo_id;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, entity_id, user_id)
    VALUES (p_idempotency_key, 'renew_agreement_period', p_acordo_id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'acordo_id', p_acordo_id,
    'mes_referencia', v_proximo_mes,
    'pagamentos_criados', v_pagamentos_criados,
    'modo_preco', v_termos.modo_preco,
    'n_passageiros_contrato', v_termos.n_passageiros_contrato,
    'valor_mensal_total_kz', v_termos.valor_mensal_total_kz,
    'valor_mensal_por_passageiro_kz', v_termos.valor_mensal_por_passageiro_kz,
    'adenda_origem_id', v_termos.adenda_origem_id
  );
END;
$function$;

-- === 7. RPC: decline_agreement_renewal ===
CREATE OR REPLACE FUNCTION public.decline_agreement_renewal(
  p_acordo_id uuid,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_acordo public.acordos%ROWTYPE;
  v_hoje date := (timezone('Africa/Luanda', now()))::date;
  v_effective date := (date_trunc('month', v_hoje) + interval '1 month')::date;
  v_is_driver boolean;
  v_is_pax boolean;
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
      RETURN jsonb_build_object('acordo_id', p_acordo_id, 'idempotent', true);
    END IF;
  END IF;

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = p_acordo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  IF lower(v_acordo.estado) <> 'activo' THEN
    RAISE EXCEPTION 'Só acordos activos podem recusar renovação.';
  END IF;

  v_is_driver := (v_uid = v_acordo.driver_id);
  SELECT EXISTS (
    SELECT 1 FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id
      AND ap.passenger_id = v_uid
      AND lower(ap.estado) = 'activo'
  ) INTO v_is_pax;

  IF NOT v_is_driver AND NOT v_is_pax THEN
    RAISE EXCEPTION 'Sem permissão para recusar renovação deste acordo.';
  END IF;

  IF lower(COALESCE(v_acordo.renovacao_estado, '')) = 'renovado' THEN
    RAISE EXCEPTION 'Período seguinte já renovado — não é possível recusar.';
  END IF;

  UPDATE public.acordos
  SET
    renovacao_estado = 'nao_renovar',
    renovacao_por = v_uid,
    renovacao_em = now(),
    renovacao_proximo_mes = v_effective,
    estado = 'cancelamento_pendente',
    rescisao_modo = 'nao_renovacao',
    rescisao_solicitada_por = v_uid,
    rescisao_justificativa = 'Renovação não solicitada — termina no fim do ciclo.',
    rescisao_effective_on = v_effective
  WHERE id = p_acordo_id;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, entity_id, user_id)
    VALUES (p_idempotency_key, 'decline_agreement_renewal', p_acordo_id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'acordo_id', p_acordo_id,
    'effective_on', v_effective,
    'renovacao_estado', 'nao_renovar'
  );
END;
$function$;

-- === 8. RPC: apply_due_agreement_non_renewals (lazy — fim de ciclo sem órfãos) ===
CREATE OR REPLACE FUNCTION public.apply_due_agreement_non_renewals(
  p_acordo_id uuid DEFAULT NULL::uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hoje date := (timezone('Africa/Luanda', now()))::date;
  v_mes_atual date := date_trunc('month', v_hoje)::date;
  v_acordo public.acordos%ROWTYPE;
  v_ultimo_mes date;
  v_applied integer := 0;
BEGIN
  PERFORM public.apply_due_agreement_terminations(p_acordo_id);

  FOR v_acordo IN
    SELECT a.*
    FROM public.acordos a
    WHERE lower(a.estado) = 'activo'
      AND (p_acordo_id IS NULL OR a.id = p_acordo_id)
      AND lower(COALESCE(a.renovacao_estado, '')) IS DISTINCT FROM 'renovado'
      AND lower(COALESCE(a.renovacao_estado, '')) IS DISTINCT FROM 'nao_renovar'
    ORDER BY a.created_at ASC
    FOR UPDATE
  LOOP
    SELECT COALESCE(MAX(pg.mes_referencia), date_trunc('month', v_acordo.created_at)::date)
    INTO v_ultimo_mes
    FROM public.pagamentos_acordo pg
    WHERE pg.acordo_id = v_acordo.id;

    IF v_mes_atual > v_ultimo_mes
       AND NOT EXISTS (
         SELECT 1 FROM public.pagamentos_acordo pg
         WHERE pg.acordo_id = v_acordo.id
           AND pg.mes_referencia = v_mes_atual
       ) THEN
      UPDATE public.acordos
      SET
        estado = 'cancelado',
        cancelado_em = now(),
        renovacao_estado = 'nao_renovar',
        rescisao_modo = 'nao_renovacao',
        rescisao_effective_on = v_mes_atual
      WHERE id = v_acordo.id;

      UPDATE public.acordos_passageiros
      SET estado = 'saiu'
      WHERE acordo_id = v_acordo.id
        AND lower(estado) = 'activo';

      PERFORM public.recount_oferta_vagas(v_acordo.oferta_id);

      BEGIN
        PERFORM public.promote_waitlist(v_acordo.oferta_id);
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Falha best-effort promote_waitlist na não-renovação %: %',
            v_acordo.id, SQLERRM;
      END;

      v_applied := v_applied + 1;
    END IF;
  END LOOP;

  FOR v_acordo IN
    SELECT a.*
    FROM public.acordos a
    WHERE lower(a.estado) = 'activo'
      AND lower(COALESCE(a.renovacao_estado, '')) = 'renovado'
      AND a.renovacao_proximo_mes IS NOT NULL
      AND a.renovacao_proximo_mes <= v_mes_atual
      AND (p_acordo_id IS NULL OR a.id = p_acordo_id)
    FOR UPDATE
  LOOP
    UPDATE public.acordos
    SET
      renovacao_estado = NULL,
      renovacao_proximo_mes = NULL,
      renovacao_por = NULL,
      renovacao_em = NULL
    WHERE id = v_acordo.id;

    v_applied := v_applied + 1;
  END LOOP;

  RETURN v_applied;
END;
$function$;

-- === 9. Gate pagamentos: mês corrente (multi-período) ===
CREATE OR REPLACE FUNCTION public.pagamento_em_custodia_para_falta(
  p_acordo_id uuid,
  p_tipo text,
  p_passenger_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo text := lower(btrim(COALESCE(p_tipo, '')));
  v_mes date := date_trunc('month', timezone('Africa/Luanda', now()))::date;
BEGIN
  IF p_acordo_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_tipo = 'passageiro' THEN
    IF p_passenger_id IS NULL THEN
      RETURN false;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.pagamentos_acordo pg
      WHERE pg.acordo_id = p_acordo_id
        AND pg.passenger_id = p_passenger_id
        AND pg.mes_referencia = v_mes
        AND lower(pg.estado) IN ('em_custodia', 'liquidado')
    );
  END IF;

  IF v_tipo = 'motorista' THEN
    RETURN NOT EXISTS (
      SELECT 1
      FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = p_acordo_id
        AND lower(ap.estado) = 'activo'
        AND NOT EXISTS (
          SELECT 1
          FROM public.pagamentos_acordo pg
          WHERE pg.acordo_passageiro_id = ap.id
            AND pg.mes_referencia = v_mes
            AND lower(pg.estado) IN ('em_custodia', 'liquidado')
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = p_acordo_id
        AND lower(ap.estado) = 'activo'
    );
  END IF;

  RETURN false;
END;
$function$;

-- === 10. get_acordo_contactos: pagamento do mês corrente ===
CREATE OR REPLACE FUNCTION public.get_acordo_contactos(p_acordo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_acordo public.acordos%ROWTYPE;
  v_is_driver boolean;
  v_is_passenger boolean;
  v_my_pagamento public.pagamentos_acordo%ROWTYPE;
  v_motorista jsonb;
  v_passageiros jsonb := '[]'::jsonb;
  v_row record;
  v_bloqueado boolean := true;
  v_mes date := date_trunc('month', timezone('Africa/Luanda', now()))::date;
BEGIN
  IF v_uid IS NULL OR p_acordo_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT * INTO v_acordo FROM public.acordos WHERE id = p_acordo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  v_is_driver := v_uid = v_acordo.driver_id;
  SELECT EXISTS (
    SELECT 1 FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id
      AND ap.passenger_id = v_uid
      AND lower(ap.estado) = 'activo'
  ) INTO v_is_passenger;

  IF NOT v_is_driver AND NOT v_is_passenger AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Sem permissão para ver contactos deste acordo.';
  END IF;

  IF v_is_passenger THEN
    SELECT * INTO v_my_pagamento
    FROM public.pagamentos_acordo
    WHERE acordo_id = p_acordo_id
      AND passenger_id = v_uid
      AND mes_referencia = v_mes
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND AND lower(v_my_pagamento.estado) IN ('em_custodia', 'liquidado') THEN
      v_bloqueado := false;
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'nome_completo', p.nome_completo,
    'telefone', CASE
      WHEN v_is_passenger AND NOT v_bloqueado THEN p.telefone
      WHEN v_is_driver THEN NULL
      ELSE NULL
    END
  ) INTO v_motorista
  FROM public.perfis p
  WHERE p.id = v_acordo.driver_id;

  FOR v_row IN
    SELECT ap.passenger_id, pf.nome_completo, pf.telefone, pg.estado AS pagamento_estado
    FROM public.acordos_passageiros ap
    JOIN public.perfis pf ON pf.id = ap.passenger_id
    LEFT JOIN public.pagamentos_acordo pg
      ON pg.acordo_passageiro_id = ap.id
      AND pg.mes_referencia = v_mes
    WHERE ap.acordo_id = p_acordo_id
      AND lower(ap.estado) = 'activo'
    ORDER BY ap.ordem_insercao ASC
  LOOP
    v_passageiros := v_passageiros || jsonb_build_array(jsonb_build_object(
      'passenger_id', v_row.passenger_id,
      'nome_completo', v_row.nome_completo,
      'telefone', CASE
        WHEN v_is_driver AND lower(COALESCE(v_row.pagamento_estado, '')) IN ('em_custodia', 'liquidado')
          THEN v_row.telefone
        WHEN v_is_passenger AND v_row.passenger_id = v_uid AND NOT v_bloqueado
          THEN v_row.telefone
        ELSE NULL
      END
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'bloqueado', CASE
      WHEN v_is_passenger THEN v_bloqueado
      WHEN v_is_driver THEN NOT EXISTS (
        SELECT 1 FROM public.pagamentos_acordo pg
        WHERE pg.acordo_id = p_acordo_id
          AND pg.mes_referencia = v_mes
          AND lower(pg.estado) IN ('em_custodia', 'liquidado')
      )
      ELSE false
    END,
    'motivo', CASE
      WHEN v_is_passenger AND v_bloqueado THEN 'Confirma o pagamento e aguarda validação para ver contactos.'
      WHEN v_is_driver AND NOT EXISTS (
        SELECT 1 FROM public.pagamentos_acordo pg
        WHERE pg.acordo_id = p_acordo_id
          AND pg.mes_referencia = v_mes
          AND lower(pg.estado) IN ('em_custodia', 'liquidado')
      ) THEN 'Contactos disponíveis após pagamento em custódia.'
      ELSE NULL
    END,
    'motorista', v_motorista,
    'passageiros', v_passageiros
  );
END;
$function$;

-- === 11. Grants ===
REVOKE ALL ON FUNCTION public._resolve_termos_vigentes_acordo(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._create_pagamentos_periodo(uuid, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.renew_agreement_period(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decline_agreement_renewal(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_due_agreement_non_renewals(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.renew_agreement_period(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_agreement_renewal(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_due_agreement_non_renewals(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.renew_agreement_period(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decline_agreement_renewal(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_due_agreement_non_renewals(uuid) FROM anon;

-- rescisao_modo check: incluir nao_renovacao
ALTER TABLE public.acordos
  DROP CONSTRAINT IF EXISTS acordos_rescisao_modo_check;

ALTER TABLE public.acordos
  ADD CONSTRAINT acordos_rescisao_modo_check
  CHECK (
    rescisao_modo IS NULL
    OR lower(rescisao_modo) = ANY (
      ARRAY[
        'aviso_previo'::text,
        'consensual'::text,
        'justa_causa'::text,
        'nao_renovacao'::text
      ]
    )
  );
