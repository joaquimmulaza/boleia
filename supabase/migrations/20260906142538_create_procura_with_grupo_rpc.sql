-- Atomic create: procura + grupo + membro owner (SECURITY DEFINER).
-- Evita procura órfã quando createGrupo/addMembroGrupo falham após createProcura.

CREATE OR REPLACE FUNCTION public.create_procura_with_grupo(
  p_preferred_time time without time zone,
  p_return_time time without time zone DEFAULT NULL,
  p_origin_name text DEFAULT NULL,
  p_origin_lat numeric DEFAULT NULL,
  p_origin_lng numeric DEFAULT NULL,
  p_destination_name text DEFAULT NULL,
  p_destination_lat numeric DEFAULT NULL,
  p_destination_lng numeric DEFAULT NULL,
  p_teto_mensal_kz integer DEFAULT NULL,
  p_dias_semana integer[] DEFAULT ARRAY[1, 2, 3, 4, 5],
  p_grupo_nome text DEFAULT NULL,
  p_n_maximo integer DEFAULT 4,
  p_pickup_name text DEFAULT NULL,
  p_pickup_lat numeric DEFAULT NULL,
  p_pickup_lng numeric DEFAULT NULL,
  p_dropoff_name text DEFAULT NULL,
  p_dropoff_lat numeric DEFAULT NULL,
  p_dropoff_lng numeric DEFAULT NULL
)
RETURNS public.procuras
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_n_maximo integer;
  v_dias integer[];
  v_pickup_name text;
  v_pickup_lat numeric;
  v_pickup_lng numeric;
  v_dropoff_name text;
  v_dropoff_lat numeric;
  v_dropoff_lng numeric;
  v_procura public.procuras%ROWTYPE;
  v_grupo_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_preferred_time IS NULL THEN
    RAISE EXCEPTION 'Horário preferido é obrigatório.';
  END IF;

  v_n_maximo := COALESCE(p_n_maximo, 4);
  IF v_n_maximo < 2 OR v_n_maximo > 8 THEN
    RAISE EXCEPTION 'A capacidade pretendida deve ser entre 2 e 8 pessoas.';
  END IF;

  v_dias := COALESCE(p_dias_semana, ARRAY[1, 2, 3, 4, 5]);
  IF array_length(v_dias, 1) IS NULL OR array_length(v_dias, 1) < 1 THEN
    RAISE EXCEPTION 'Selecciona pelo menos um dia da semana.';
  END IF;

  v_pickup_name := NULLIF(btrim(COALESCE(p_pickup_name, '')), '');
  v_pickup_lat := CASE WHEN v_pickup_name IS NOT NULL THEN p_pickup_lat ELSE NULL END;
  v_pickup_lng := CASE WHEN v_pickup_name IS NOT NULL THEN p_pickup_lng ELSE NULL END;

  v_dropoff_name := NULLIF(btrim(COALESCE(p_dropoff_name, '')), '');
  v_dropoff_lat := CASE WHEN v_dropoff_name IS NOT NULL THEN p_dropoff_lat ELSE NULL END;
  v_dropoff_lng := CASE WHEN v_dropoff_name IS NOT NULL THEN p_dropoff_lng ELSE NULL END;

  INSERT INTO public.procuras (
    owner_id,
    preferred_time,
    return_time,
    origin_name,
    origin_lat,
    origin_lng,
    destination_name,
    destination_lat,
    destination_lng,
    n_candidato,
    teto_mensal_kz,
    dias_semana,
    estado
  )
  VALUES (
    v_uid,
    p_preferred_time,
    p_return_time,
    p_origin_name,
    p_origin_lat,
    p_origin_lng,
    p_destination_name,
    p_destination_lat,
    p_destination_lng,
    1,
    p_teto_mensal_kz,
    v_dias,
    'activa'
  )
  RETURNING * INTO v_procura;

  INSERT INTO public.grupos (procura_id, nome, n_maximo)
  VALUES (v_procura.id, NULLIF(btrim(COALESCE(p_grupo_nome, '')), ''), v_n_maximo)
  RETURNING id INTO v_grupo_id;

  INSERT INTO public.membros_grupo (
    grupo_id,
    passenger_id,
    pickup_name,
    pickup_lat,
    pickup_lng,
    dropoff_name,
    dropoff_lat,
    dropoff_lng,
    ordem_insercao,
    estado
  )
  VALUES (
    v_grupo_id,
    v_uid,
    v_pickup_name,
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_name,
    v_dropoff_lat,
    v_dropoff_lng,
    0,
    'activo'
  );

  -- N_actual = 1 (owner activo)
  UPDATE public.procuras
  SET n_candidato = 1, updated_at = now()
  WHERE id = v_procura.id
  RETURNING * INTO v_procura;

  RETURN v_procura;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_procura_with_grupo(
  time without time zone,
  time without time zone,
  text,
  numeric,
  numeric,
  text,
  numeric,
  numeric,
  integer,
  integer[],
  text,
  integer,
  text,
  numeric,
  numeric,
  text,
  numeric,
  numeric
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_procura_with_grupo(
  time without time zone,
  time without time zone,
  text,
  numeric,
  numeric,
  text,
  numeric,
  numeric,
  integer,
  integer[],
  text,
  integer,
  text,
  numeric,
  numeric,
  text,
  numeric,
  numeric
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_procura_with_grupo(
  time without time zone,
  time without time zone,
  text,
  numeric,
  numeric,
  text,
  numeric,
  numeric,
  integer,
  integer[],
  text,
  integer,
  text,
  numeric,
  numeric,
  text,
  numeric,
  numeric
) TO service_role;
