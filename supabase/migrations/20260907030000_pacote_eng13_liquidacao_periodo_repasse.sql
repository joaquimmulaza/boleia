-- PACOTE ENG #13 — liquidação período + registo repasse motorista + idempotência
-- Extende ENG #5 (escrow) e ENG #11 (assiduidade gate). Valores sempre do acordo.

-- === Registo de repasse por motorista + período ===
CREATE TABLE IF NOT EXISTS public.repasses_motorista (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE RESTRICT,
  mes_referencia date NOT NULL,
  iban_destino text NOT NULL,
  iban_titular text,
  gmv_kz integer NOT NULL CHECK (gmv_kz >= 0),
  take_rate_pct numeric(5,4) NOT NULL CHECK (take_rate_pct >= 0 AND take_rate_pct < 1),
  valor_plataforma_kz integer NOT NULL CHECK (valor_plataforma_kz >= 0),
  valor_payout_bruto_kz integer NOT NULL CHECK (valor_payout_bruto_kz >= 0),
  desconto_faltas_kz integer NOT NULL DEFAULT 0 CHECK (desconto_faltas_kz >= 0),
  valor_repasse_liquido_kz integer NOT NULL CHECK (valor_repasse_liquido_kz >= 0),
  num_pagamentos integer NOT NULL DEFAULT 0 CHECK (num_pagamentos >= 0),
  liquidado_por uuid REFERENCES public.perfis(id),
  liquidado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_repasses_motorista_driver ON public.repasses_motorista (driver_id);
CREATE INDEX IF NOT EXISTS idx_repasses_motorista_mes ON public.repasses_motorista (mes_referencia);

ALTER TABLE public.repasses_motorista ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS repasses_select_driver_admin ON public.repasses_motorista;
CREATE POLICY repasses_select_driver_admin ON public.repasses_motorista
  FOR SELECT TO authenticated
  USING (
    auth.uid() = driver_id
    OR public.is_platform_admin()
  );

-- === Ligação pagamento → repasse ===
ALTER TABLE public.pagamentos_acordo
  ADD COLUMN IF NOT EXISTS repasse_id uuid REFERENCES public.repasses_motorista(id);

CREATE INDEX IF NOT EXISTS idx_pagamentos_acordo_repasse ON public.pagamentos_acordo (repasse_id);

-- === Helper: desconto faltas para um pagamento (mês + passageiro) ===
CREATE OR REPLACE FUNCTION public._desconto_faltas_pagamento(
  p_acordo_id uuid,
  p_passenger_id uuid,
  p_mes_referencia date
)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(floor(COALESCE(SUM(f.desconto_kz), 0))::integer, 0)
  FROM public.faltas f
  WHERE f.id_acordo = p_acordo_id
    AND f.desconto_kz > 0
    AND date_trunc('month', f.data_falta)::date = p_mes_referencia
    AND (
      (lower(f.tipo) = 'passageiro' AND f.passenger_id = p_passenger_id)
      OR lower(f.tipo) = 'motorista'
    );
$$;

-- === Helper: refresh agregado repasse a partir de pagamentos liquidados ===
CREATE OR REPLACE FUNCTION public._refresh_repasse_motorista(
  p_driver_id uuid,
  p_mes_referencia date,
  p_liquidado_por uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_iban text;
  v_titular text;
  v_repasse_id uuid;
  v_gmv integer := 0;
  v_payout integer := 0;
  v_desconto integer := 0;
  v_repasse integer := 0;
  v_take_rate numeric := 0.10;
  v_count integer := 0;
  v_plataforma integer := 0;
BEGIN
  SELECT NULLIF(btrim(COALESCE(p.iban, '')), ''), NULLIF(btrim(COALESCE(p.iban_titular, '')), '')
  INTO v_iban, v_titular
  FROM public.perfis p
  WHERE p.id = p_driver_id;

  SELECT
    COALESCE(SUM(pg.valor_kz), 0)::integer,
    COALESCE(SUM(pg.valor_payout_liquido_kz), 0)::integer,
    COALESCE(SUM(pg.desconto_faltas_kz), 0)::integer,
    COALESCE(SUM(pg.valor_repasse_kz), 0)::integer,
    COUNT(*)::integer,
    COALESCE(MAX(pg.take_rate_pct), 0.10)
  INTO v_gmv, v_payout, v_desconto, v_repasse, v_count, v_take_rate
  FROM public.pagamentos_acordo pg
  WHERE pg.driver_id = p_driver_id
    AND pg.mes_referencia = p_mes_referencia
    AND lower(pg.estado) = 'liquidado';

  IF v_count = 0 THEN
    RETURN NULL;
  END IF;

  IF v_iban IS NULL THEN
    RAISE EXCEPTION 'Motorista sem IBAN configurado no perfil.';
  END IF;

  v_plataforma := GREATEST(0, v_gmv - v_payout);

  INSERT INTO public.repasses_motorista (
    driver_id,
    mes_referencia,
    iban_destino,
    iban_titular,
    gmv_kz,
    take_rate_pct,
    valor_plataforma_kz,
    valor_payout_bruto_kz,
    desconto_faltas_kz,
    valor_repasse_liquido_kz,
    num_pagamentos,
    liquidado_por,
    liquidado_em,
    updated_at
  ) VALUES (
    p_driver_id,
    p_mes_referencia,
    v_iban,
    v_titular,
    v_gmv,
    v_take_rate,
    v_plataforma,
    v_payout,
    v_desconto,
    v_repasse,
    v_count,
    p_liquidado_por,
    now(),
    now()
  )
  ON CONFLICT (driver_id, mes_referencia) DO UPDATE SET
    iban_destino = EXCLUDED.iban_destino,
    iban_titular = EXCLUDED.iban_titular,
    gmv_kz = EXCLUDED.gmv_kz,
    take_rate_pct = EXCLUDED.take_rate_pct,
    valor_plataforma_kz = EXCLUDED.valor_plataforma_kz,
    valor_payout_bruto_kz = EXCLUDED.valor_payout_bruto_kz,
    desconto_faltas_kz = EXCLUDED.desconto_faltas_kz,
    valor_repasse_liquido_kz = EXCLUDED.valor_repasse_liquido_kz,
    num_pagamentos = EXCLUDED.num_pagamentos,
    liquidado_por = EXCLUDED.liquidado_por,
    liquidado_em = EXCLUDED.liquidado_em,
    updated_at = now()
  RETURNING id INTO v_repasse_id;

  UPDATE public.pagamentos_acordo
  SET repasse_id = v_repasse_id, updated_at = now()
  WHERE driver_id = p_driver_id
    AND mes_referencia = p_mes_referencia
    AND lower(estado) = 'liquidado'
    AND repasse_id IS DISTINCT FROM v_repasse_id;

  RETURN v_repasse_id;
END;
$function$;

-- === Helper: liquidar uma linha em custódia ===
CREATE OR REPLACE FUNCTION public._liquidate_pagamento_row(
  p_row public.pagamentos_acordo,
  p_liquidado_por uuid
)
RETURNS public.pagamentos_acordo
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_desconto integer;
  v_repasse integer;
  v_updated public.pagamentos_acordo%ROWTYPE;
BEGIN
  IF lower(p_row.estado) = 'liquidado' THEN
    RETURN p_row;
  END IF;

  IF lower(p_row.estado) <> 'em_custodia' THEN
    RAISE EXCEPTION 'Só pagamentos em custódia podem ser liquidados.';
  END IF;

  v_desconto := public._desconto_faltas_pagamento(
    p_row.acordo_id,
    p_row.passenger_id,
    p_row.mes_referencia
  );

  v_repasse := GREATEST(0, p_row.valor_payout_liquido_kz - v_desconto);

  UPDATE public.pagamentos_acordo
  SET
    desconto_faltas_kz = v_desconto,
    valor_repasse_kz = v_repasse,
    liquidado_em = now(),
    estado = 'liquidado',
    updated_at = now()
  WHERE id = p_row.id
  RETURNING * INTO v_updated;

  PERFORM public._refresh_repasse_motorista(
    v_updated.driver_id,
    v_updated.mes_referencia,
    p_liquidado_por
  );

  RETURN v_updated;
END;
$function$;

-- === RPC: admin_liquidate_payment (idempotente + repasse) ===
CREATE OR REPLACE FUNCTION public.admin_liquidate_payment(
  p_pagamento_id uuid,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.pagamentos_acordo%ROWTYPE;
  v_result public.pagamentos_acordo%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso reservado a administradores.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      SELECT subject_id INTO p_pagamento_id
      FROM public.rpc_idempotency
      WHERE idempotency_key = p_idempotency_key;
      RETURN p_pagamento_id;
    END IF;
  END IF;

  SELECT * INTO v_row
  FROM public.pagamentos_acordo
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado.';
  END IF;

  v_result := public._liquidate_pagamento_row(v_row, v_uid);

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'admin_liquidate_payment', v_result.id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_result.id;
END;
$function$;

-- === RPC: admin_liquidate_period (batch por mês, opcional motorista) ===
CREATE OR REPLACE FUNCTION public.admin_liquidate_period(
  p_mes_referencia date,
  p_driver_id uuid DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_mes date := date_trunc('month', COALESCE(p_mes_referencia, CURRENT_DATE))::date;
  v_row public.pagamentos_acordo%ROWTYPE;
  v_repasse_id uuid;
  v_repasse_ids uuid[] := '{}';
  v_count integer := 0;
  v_driver_ids uuid[];
  v_driver uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso reservado a administradores.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      RETURN jsonb_build_object(
        'mes_referencia', v_mes,
        'pagamentos_liquidados', 0,
        'repasses', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', rm.id,
            'driver_id', rm.driver_id,
            'valor_repasse_liquido_kz', rm.valor_repasse_liquido_kz,
            'num_pagamentos', rm.num_pagamentos
          ))
          FROM public.repasses_motorista rm
          WHERE rm.mes_referencia = v_mes
            AND (p_driver_id IS NULL OR rm.driver_id = p_driver_id)
        ), '[]'::jsonb),
        'idempotent_replay', true
      );
    END IF;
  END IF;

  IF p_driver_id IS NOT NULL THEN
    v_driver_ids := ARRAY[p_driver_id];
  ELSE
    SELECT ARRAY_AGG(DISTINCT pg.driver_id ORDER BY pg.driver_id)
    INTO v_driver_ids
    FROM public.pagamentos_acordo pg
    WHERE pg.mes_referencia = v_mes
      AND lower(pg.estado) = 'em_custodia';
  END IF;

  IF v_driver_ids IS NULL OR array_length(v_driver_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'mes_referencia', v_mes,
      'pagamentos_liquidados', 0,
      'repasses', '[]'::jsonb
    );
  END IF;

  FOREACH v_driver IN ARRAY v_driver_ids LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.perfis p
      WHERE p.id = v_driver
        AND NULLIF(btrim(COALESCE(p.iban, '')), '') IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Motorista % sem IBAN configurado no perfil.', v_driver;
    END IF;

    FOR v_row IN
      SELECT * FROM public.pagamentos_acordo pg
      WHERE pg.driver_id = v_driver
        AND pg.mes_referencia = v_mes
        AND lower(pg.estado) = 'em_custodia'
      ORDER BY pg.created_at ASC
      FOR UPDATE
    LOOP
      PERFORM public._liquidate_pagamento_row(v_row, v_uid);
      v_count := v_count + 1;
    END LOOP;

    v_repasse_id := public._refresh_repasse_motorista(v_driver, v_mes, v_uid);
    IF v_repasse_id IS NOT NULL THEN
      v_repasse_ids := array_append(v_repasse_ids, v_repasse_id);
    END IF;
  END LOOP;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'admin_liquidate_period', v_mes, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'mes_referencia', v_mes,
    'pagamentos_liquidados', v_count,
    'repasses', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', rm.id,
        'driver_id', rm.driver_id,
        'iban_destino', rm.iban_destino,
        'gmv_kz', rm.gmv_kz,
        'valor_plataforma_kz', rm.valor_plataforma_kz,
        'valor_repasse_liquido_kz', rm.valor_repasse_liquido_kz,
        'num_pagamentos', rm.num_pagamentos
      ) ORDER BY rm.driver_id)
      FROM public.repasses_motorista rm
      WHERE rm.id = ANY(v_repasse_ids)
    ), '[]'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public._desconto_faltas_pagamento(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public._refresh_repasse_motorista(uuid, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._liquidate_pagamento_row(public.pagamentos_acordo, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_liquidate_period(date, uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public._desconto_faltas_pagamento(uuid, uuid, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public._refresh_repasse_motorista(uuid, date, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public._liquidate_pagamento_row(public.pagamentos_acordo, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_liquidate_period(date, uuid, uuid) FROM anon;
