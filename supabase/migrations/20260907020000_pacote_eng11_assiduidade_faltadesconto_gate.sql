-- PACOTE ENG #11 — assiduidade/faltaDesconto gate pagamento + liquidação on-platform
-- Sem em_custodia: sem desconto nem registo válido para repasse.

-- === Colunas liquidação em pagamentos_acordo ===
ALTER TABLE public.pagamentos_acordo
  ADD COLUMN IF NOT EXISTS desconto_faltas_kz integer NOT NULL DEFAULT 0
    CHECK (desconto_faltas_kz >= 0),
  ADD COLUMN IF NOT EXISTS valor_repasse_kz integer
    CHECK (valor_repasse_kz IS NULL OR valor_repasse_kz >= 0),
  ADD COLUMN IF NOT EXISTS liquidado_em timestamptz;

-- === Helper: pagamento em custódia para falta ===
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

-- === Trigger desconto: só aplica com pagamento em custódia ===
CREATE OR REPLACE FUNCTION public.handle_falta_desconto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_valor_mensal integer;
  v_dias integer;
  v_passenger_id uuid;
BEGIN
  v_passenger_id := COALESCE(
    NEW.passenger_id,
    CASE WHEN lower(COALESCE(NEW.tipo, '')) = 'passageiro' THEN auth.uid() ELSE NULL END
  );

  IF NOT public.pagamento_em_custodia_para_falta(NEW.id_acordo, NEW.tipo, v_passenger_id) THEN
    NEW.desconto_kz := 0;
    RETURN NEW;
  END IF;

  SELECT a.valor_mensal_por_passageiro_kz, a.dias_uteis_mes
  INTO v_valor_mensal, v_dias
  FROM public.acordos a
  WHERE a.id = NEW.id_acordo;

  IF v_valor_mensal IS NOT NULL AND v_dias IS NOT NULL AND v_dias > 0 THEN
    IF NEW.viagem = 'ambas' THEN
      NEW.desconto_kz := ROUND((v_valor_mensal::numeric / v_dias::numeric), 2);
    ELSE
      NEW.desconto_kz := ROUND((v_valor_mensal::numeric / v_dias::numeric / 2.0), 2);
    END IF;
  ELSE
    NEW.desconto_kz := 0;
  END IF;

  RETURN NEW;
END;
$function$;

-- === RPC: log_falta (gate pagamento + auth) ===
CREATE OR REPLACE FUNCTION public.log_falta(
  p_id_acordo uuid,
  p_data_falta date,
  p_tipo text,
  p_observacao text DEFAULT NULL,
  p_passenger_id uuid DEFAULT NULL,
  p_viagem text DEFAULT 'ambas'
)
RETURNS public.faltas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_tipo text := initcap(lower(btrim(COALESCE(p_tipo, ''))));
  v_viagem text := lower(btrim(COALESCE(p_viagem, 'ambas')));
  v_passenger_id uuid;
  v_is_driver boolean;
  v_is_passenger boolean;
  v_row public.faltas%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_id_acordo IS NULL OR p_data_falta IS NULL THEN
    RAISE EXCEPTION 'Acordo e data são obrigatórios.';
  END IF;

  IF v_tipo NOT IN ('Passageiro', 'Motorista') THEN
    RAISE EXCEPTION 'Tipo de falta inválido.';
  END IF;

  IF v_viagem NOT IN ('ida', 'regresso', 'ambas') THEN
    RAISE EXCEPTION 'Viagem inválida.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.acordos a
    WHERE a.id = p_id_acordo AND a.driver_id = v_uid
  ) INTO v_is_driver;

  SELECT EXISTS (
    SELECT 1 FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_id_acordo
      AND ap.passenger_id = v_uid
      AND lower(ap.estado) = 'activo'
  ) INTO v_is_passenger;

  IF NOT v_is_driver AND NOT v_is_passenger THEN
    RAISE EXCEPTION 'Sem permissão para registar faltas neste acordo.';
  END IF;

  IF v_tipo = 'Passageiro' THEN
    v_passenger_id := COALESCE(p_passenger_id, v_uid);

    IF v_passenger_id IS DISTINCT FROM v_uid AND NOT v_is_driver THEN
      RAISE EXCEPTION 'Só o motorista pode registar falta de outro passageiro.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = p_id_acordo
        AND ap.passenger_id = v_passenger_id
        AND lower(ap.estado) = 'activo'
    ) THEN
      RAISE EXCEPTION 'Passageiro não activo neste acordo.';
    END IF;
  ELSE
    v_passenger_id := NULL;

    IF NOT v_is_driver THEN
      RAISE EXCEPTION 'Só o motorista pode registar falta de motorista.';
    END IF;
  END IF;

  IF NOT public.pagamento_em_custodia_para_falta(p_id_acordo, v_tipo, v_passenger_id) THEN
    RAISE EXCEPTION
      'Registo de faltas disponível após pagamento validado em custódia.';
  END IF;

  INSERT INTO public.faltas (
    id_acordo,
    data_falta,
    tipo,
    observacao,
    passenger_id,
    viagem
  ) VALUES (
    p_id_acordo,
    p_data_falta,
    v_tipo,
    NULLIF(btrim(COALESCE(p_observacao, '')), ''),
    v_passenger_id,
    v_viagem
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- === RPC: admin_liquidate_payment (repasse com descontos on-platform) ===
CREATE OR REPLACE FUNCTION public.admin_liquidate_payment(p_pagamento_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.pagamentos_acordo%ROWTYPE;
  v_desconto numeric := 0;
  v_repasse integer;
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

  IF lower(v_row.estado) <> 'em_custodia' THEN
    RAISE EXCEPTION 'Só pagamentos em custódia podem ser liquidados.';
  END IF;

  SELECT COALESCE(SUM(f.desconto_kz), 0)
  INTO v_desconto
  FROM public.faltas f
  WHERE f.id_acordo = v_row.acordo_id
    AND f.desconto_kz > 0
    AND date_trunc('month', f.data_falta)::date = v_row.mes_referencia
    AND (
      (lower(f.tipo) = 'passageiro' AND f.passenger_id = v_row.passenger_id)
      OR lower(f.tipo) = 'motorista'
    );

  v_repasse := GREATEST(
    0,
    v_row.valor_payout_liquido_kz - floor(v_desconto)::integer
  );

  UPDATE public.pagamentos_acordo
  SET
    desconto_faltas_kz = floor(v_desconto)::integer,
    valor_repasse_kz = v_repasse,
    liquidado_em = now(),
    estado = 'liquidado',
    updated_at = now()
  WHERE id = p_pagamento_id;

  RETURN p_pagamento_id;
END;
$function$;

-- === RLS: revogar INSERT directo em faltas (só via RPC) ===
DROP POLICY IF EXISTS faltas_insert_envolvidos ON public.faltas;

GRANT EXECUTE ON FUNCTION public.pagamento_em_custodia_para_falta(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_falta(uuid, date, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_liquidate_payment(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.pagamento_em_custodia_para_falta(uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_falta(uuid, date, text, text, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_liquidate_payment(uuid) FROM anon;
