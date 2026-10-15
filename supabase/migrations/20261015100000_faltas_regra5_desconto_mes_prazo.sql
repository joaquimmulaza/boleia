-- Regra 5 faltas (PM 15/10/2026): prazo passageiro 22:00 Luanda véspera;
-- desconto no mês da falta; crédito no pagamento seguinte se já liquidado.
--
-- Redefinições partem do corpo actual em main (grep migrations):
--   handle_falta_desconto  ← 20260906230154_pacote_eng11_assiduidade_faltadesconto_gate.sql
--   log_falta              ← idem
--   _desconto_faltas_pagamento ← 20260906231204_pacote_eng13_liquidacao_periodo_repasse.sql
--   pagamento_em_custodia_para_falta — NÃO alterada (última: 20260907152236_pacote_eng14_renovacao_periodo.sql)
--   trg_pagamentos_acordo_notify — NÃO alterada (última: 20261012222000_pagamento_anulacao_v1_15.sql, PR #275)

ALTER TABLE public.faltas
  ADD COLUMN IF NOT EXISTS desconto_mes_referencia date;

COMMENT ON COLUMN public.faltas.desconto_mes_referencia IS
  'Primeiro dia do mês de pagamento onde o desconto se aplica (pode diferir do mês de data_falta se crédito).';

-- === Instant de referência (override só em provas PG via boleia.regra5_instant_override) ===
CREATE OR REPLACE FUNCTION public._falta_regra5_instant()
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('boleia.regra5_instant_override', true), '')::timestamptz,
    clock_timestamp()
  );
$$;

-- === Prazo: 22:00 Africa/Luanda no dia anterior à data_falta ===
CREATE OR REPLACE FUNCTION public._passageiro_falta_prazo_limite(p_data_falta date)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT ((p_data_falta - 1)::timestamp + time '22:00:00') AT TIME ZONE 'Africa/Luanda';
$$;

CREATE OR REPLACE FUNCTION public._passageiro_falta_aviso_valido(
  p_data_falta date,
  p_ref timestamptz DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT
    p_data_falta >= (COALESCE(p_ref, public._falta_regra5_instant()) AT TIME ZONE 'Africa/Luanda')::date
    AND COALESCE(p_ref, public._falta_regra5_instant()) <= public._passageiro_falta_prazo_limite(p_data_falta);
$$;

-- === Mês de pagamento onde o desconto da falta se liquida ===
CREATE OR REPLACE FUNCTION public._resolve_desconto_mes_falta(
  p_acordo_id uuid,
  p_passenger_id uuid,
  p_data_falta date,
  p_tipo text
)
RETURNS date
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_base date := date_trunc('month', p_data_falta)::date;
  v_mes date := v_base;
  v_tipo text := lower(btrim(COALESCE(p_tipo, '')));
  v_todos_liquidados boolean;
  v_proximo date;
  v_guard integer := 0;
BEGIN
  IF p_acordo_id IS NULL OR p_data_falta IS NULL THEN
    RETURN v_base;
  END IF;

  LOOP
    v_guard := v_guard + 1;
    IF v_guard > 48 THEN
      RETURN v_mes;
    END IF;

    IF v_tipo = 'passageiro' THEN
      IF p_passenger_id IS NULL THEN
        RETURN v_base;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM public.pagamentos_acordo pg
        WHERE pg.acordo_id = p_acordo_id
          AND pg.passenger_id = p_passenger_id
          AND pg.mes_referencia = v_mes
      ) THEN
        RETURN v_base;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.pagamentos_acordo pg
        WHERE pg.acordo_id = p_acordo_id
          AND pg.passenger_id = p_passenger_id
          AND pg.mes_referencia = v_mes
          AND lower(pg.estado) <> 'liquidado'
      ) THEN
        RETURN v_mes;
      END IF;

      SELECT pg.mes_referencia
      INTO v_proximo
      FROM public.pagamentos_acordo pg
      WHERE pg.acordo_id = p_acordo_id
        AND pg.passenger_id = p_passenger_id
        AND pg.mes_referencia > v_mes
      ORDER BY pg.mes_referencia ASC
      LIMIT 1;

      IF v_proximo IS NULL THEN
        RETURN (v_mes + interval '1 month')::date;
      END IF;

      v_mes := v_proximo;
      CONTINUE;
    END IF;

    IF v_tipo = 'motorista' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.pagamentos_acordo pg
        WHERE pg.acordo_id = p_acordo_id
          AND pg.mes_referencia = v_mes
      ) THEN
        RETURN v_base;
      END IF;

      SELECT NOT EXISTS (
        SELECT 1
        FROM public.pagamentos_acordo pg
        WHERE pg.acordo_id = p_acordo_id
          AND pg.mes_referencia = v_mes
          AND lower(pg.estado) <> 'liquidado'
      ) INTO v_todos_liquidados;

      IF NOT v_todos_liquidados THEN
        RETURN v_mes;
      END IF;

      SELECT pg.mes_referencia
      INTO v_proximo
      FROM public.pagamentos_acordo pg
      WHERE pg.acordo_id = p_acordo_id
        AND pg.mes_referencia > v_mes
      ORDER BY pg.mes_referencia ASC
      LIMIT 1;

      IF v_proximo IS NULL THEN
        RETURN (v_mes + interval '1 month')::date;
      END IF;

      v_mes := v_proximo;
      CONTINUE;
    END IF;

    RETURN v_base;
  END LOOP;
END;
$function$;

-- === Trigger desconto (base ENG#11) ===
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

  NEW.desconto_mes_referencia := public._resolve_desconto_mes_falta(
    NEW.id_acordo,
    v_passenger_id,
    NEW.data_falta,
    NEW.tipo
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

-- === RPC log_falta (base ENG#11 + prazo passageiro regra 5) ===
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
  v_hoje_luanda date;
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

    v_hoje_luanda := (public._falta_regra5_instant() AT TIME ZONE 'Africa/Luanda')::date;

    IF p_data_falta < v_hoje_luanda THEN
      RAISE EXCEPTION
        'A data da falta já passou.'
        USING ERRCODE = 'BCF01';
    END IF;

    IF NOT public._passageiro_falta_aviso_valido(p_data_falta, public._falta_regra5_instant()) THEN
      RAISE EXCEPTION
        'Já não é possível registar esta falta. Só podes avisar até às 22:00 do dia anterior.'
        USING ERRCODE = 'BCF02';
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

-- === Helper desconto faltas (base ENG#13 + desconto_mes_referencia) ===
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
    AND COALESCE(
      f.desconto_mes_referencia,
      date_trunc('month', f.data_falta)::date
    ) = p_mes_referencia
    AND (
      (lower(f.tipo) = 'passageiro' AND f.passenger_id = p_passenger_id)
      OR lower(f.tipo) = 'motorista'
    );
$$;

REVOKE ALL ON FUNCTION public._falta_regra5_instant() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._falta_regra5_instant() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._falta_regra5_instant() TO service_role;

REVOKE ALL ON FUNCTION public._passageiro_falta_prazo_limite(date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._passageiro_falta_prazo_limite(date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._passageiro_falta_prazo_limite(date) TO service_role;

GRANT EXECUTE ON FUNCTION public._passageiro_falta_aviso_valido(date, timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public._passageiro_falta_aviso_valido(date, timestamptz) FROM anon;

REVOKE ALL ON FUNCTION public._resolve_desconto_mes_falta(uuid, uuid, date, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._resolve_desconto_mes_falta(uuid, uuid, date, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._resolve_desconto_mes_falta(uuid, uuid, date, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.log_falta(uuid, date, text, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.log_falta(uuid, date, text, text, uuid, text) FROM anon;

GRANT EXECUTE ON FUNCTION public._desconto_faltas_pagamento(uuid, uuid, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public._desconto_faltas_pagamento(uuid, uuid, date) FROM anon;
