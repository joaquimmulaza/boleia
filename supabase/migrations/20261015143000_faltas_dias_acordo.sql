-- P0 Regra 5 (dias de viagem): falta só conta em dia de acordo (oferta.dias_semana).
-- Base: log_falta + handle_falta_desconto ← 20261015100000_faltas_regra5_desconto_mes_prazo.sql
-- Divisor desconto: count_dias_viagem_mes(mês da falta, dias_semana) — não acordos.dias_uteis_mes.

-- dias_semana: 1=Seg … 7=Dom (ISO). NULL/vazio → Seg–Sex (fallback documentado).

CREATE OR REPLACE FUNCTION public._dias_semana_acordo_efetivos(p_dias_semana integer[])
RETURNS integer[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_dias_semana IS NULL OR cardinality(p_dias_semana) = 0 THEN ARRAY[1, 2, 3, 4, 5]::integer[]
    ELSE p_dias_semana
  END;
$$;

CREATE OR REPLACE FUNCTION public._is_dia_viagem_acordo(p_data date, p_dias_semana integer[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT EXTRACT(ISODOW FROM p_data)::integer = ANY(public._dias_semana_acordo_efetivos(p_dias_semana));
$$;

CREATE OR REPLACE FUNCTION public.count_dias_viagem_mes(p_mes_inicio date, p_dias_semana integer[])
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM generate_series(
    p_mes_inicio,
    (p_mes_inicio + interval '1 month' - interval '1 day')::date,
    interval '1 day'
  ) AS d
  WHERE EXTRACT(ISODOW FROM d)::integer = ANY(public._dias_semana_acordo_efetivos(p_dias_semana));
$$;

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
  v_dias_semana integer[];
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

  SELECT oc.dias_semana
  INTO v_dias_semana
  FROM public.acordos a
  JOIN public.ofertas_capacidade oc ON oc.id = a.oferta_id
  WHERE a.id = NEW.id_acordo;

  IF NOT public._is_dia_viagem_acordo(NEW.data_falta, v_dias_semana) THEN
    NEW.desconto_kz := 0;
    RETURN NEW;
  END IF;

  IF NOT public.pagamento_em_custodia_para_falta(NEW.id_acordo, NEW.tipo, v_passenger_id) THEN
    NEW.desconto_kz := 0;
    RETURN NEW;
  END IF;

  SELECT a.valor_mensal_por_passageiro_kz
  INTO v_valor_mensal
  FROM public.acordos a
  WHERE a.id = NEW.id_acordo;

  v_dias := public.count_dias_viagem_mes(
    date_trunc(
      'month',
      (NEW.data_falta::timestamp AT TIME ZONE 'Africa/Luanda')::date
    )::date,
    v_dias_semana
  );

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
  v_dias_semana integer[];
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

  SELECT oc.dias_semana
  INTO v_dias_semana
  FROM public.acordos a
  JOIN public.ofertas_capacidade oc ON oc.id = a.oferta_id
  WHERE a.id = p_id_acordo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  IF NOT public._is_dia_viagem_acordo(p_data_falta, v_dias_semana) THEN
    RAISE EXCEPTION 'Esta data não é dia de viagem neste acordo.'
      USING ERRCODE = 'BCF03';
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

    IF v_passenger_id = v_uid
      AND NOT public._passageiro_falta_aviso_valido(p_data_falta, public._falta_regra5_instant()) THEN
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

REVOKE ALL ON FUNCTION public._dias_semana_acordo_efetivos(integer[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._dias_semana_acordo_efetivos(integer[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._dias_semana_acordo_efetivos(integer[]) TO service_role;

REVOKE ALL ON FUNCTION public._is_dia_viagem_acordo(date, integer[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._is_dia_viagem_acordo(date, integer[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._is_dia_viagem_acordo(date, integer[]) TO service_role;

GRANT EXECUTE ON FUNCTION public.count_dias_viagem_mes(date, integer[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.count_dias_viagem_mes(date, integer[]) FROM anon;

GRANT EXECUTE ON FUNCTION public.log_falta(uuid, date, text, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.log_falta(uuid, date, text, text, uuid, text) FROM anon;
