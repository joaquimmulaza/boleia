-- Editar / cancelar procura activa.
-- Propostas: só estado invalidada|cancelada — nunca mutar snapshot (preço, N, oferta).
-- return_time e n_candidato não são escritos por update_procura.

CREATE OR REPLACE FUNCTION public._haversine_meters(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2))
    * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

CREATE OR REPLACE FUNCTION public.oferta_compativel_com_procura(
  p_oferta public.ofertas_capacidade,
  p_procura public.procuras
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_min_oferta integer;
  v_min_procura integer;
  v_flex boolean;
BEGIN
  IF p_oferta.departure_time IS NULL OR p_procura.preferred_time IS NULL THEN
    RETURN false;
  END IF;

  v_min_oferta := EXTRACT(HOUR FROM p_oferta.departure_time)::int * 60
    + EXTRACT(MINUTE FROM p_oferta.departure_time)::int;
  v_min_procura := EXTRACT(HOUR FROM p_procura.preferred_time)::int * 60
    + EXTRACT(MINUTE FROM p_procura.preferred_time)::int;
  IF abs(v_min_oferta - v_min_procura) > 15 THEN
    RETURN false;
  END IF;

  IF p_oferta.dias_semana IS NULL OR cardinality(p_oferta.dias_semana) = 0
     OR p_procura.dias_semana IS NULL OR cardinality(p_procura.dias_semana) = 0
     OR NOT (p_oferta.dias_semana && p_procura.dias_semana) THEN
    RETURN false;
  END IF;

  v_flex := COALESCE(p_oferta.flexibilidade_rota, false);
  IF NOT v_flex THEN
    IF p_oferta.origin_lat IS NULL OR p_oferta.origin_lng IS NULL
       OR p_oferta.destination_lat IS NULL OR p_oferta.destination_lng IS NULL
       OR p_procura.origin_lat IS NULL OR p_procura.origin_lng IS NULL
       OR p_procura.destination_lat IS NULL OR p_procura.destination_lng IS NULL THEN
      RETURN false;
    END IF;
    IF public._haversine_meters(
         p_oferta.origin_lat::double precision,
         p_oferta.origin_lng::double precision,
         p_procura.origin_lat::double precision,
         p_procura.origin_lng::double precision
       ) > 2500 THEN
      RETURN false;
    END IF;
    IF public._haversine_meters(
         p_oferta.destination_lat::double precision,
         p_oferta.destination_lng::double precision,
         p_procura.destination_lat::double precision,
         p_procura.destination_lng::double precision
       ) > 2500 THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public._assert_procura_editavel(p_procura public.procuras, p_uid uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF p_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_uid IS DISTINCT FROM p_procura.owner_id THEN
    RAISE EXCEPTION 'Só o dono pode alterar esta procura.';
  END IF;
  IF lower(p_procura.estado) NOT IN ('activa', 'em_negociacao') THEN
    RAISE EXCEPTION 'Não é possível editar esta procura.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.acordos a
    WHERE a.procura_id = p_procura.id
      AND lower(a.estado) IN ('activo', 'cancelamento_pendente')
  ) THEN
    RAISE EXCEPTION 'Já existe um acordo para esta procura.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._notify_proposta_driver_evento(
  p_prop public.propostas,
  p_type text,
  p_mensagem text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_oferta public.ofertas_capacidade%ROWTYPE;
BEGIN
  SELECT * INTO v_oferta FROM public.ofertas_capacidade WHERE id = p_prop.oferta_id;
  IF NOT FOUND OR v_oferta.driver_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
  VALUES (
    v_oferta.driver_id,
    p_mensagem,
    'info',
    jsonb_build_object(
      'type', p_type,
      'inbox', 'motorista',
      'proposta_id', p_prop.id,
      'oferta_id', p_prop.oferta_id,
      'procura_id', p_prop.procura_id
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_procura(
  p_procura_id uuid,
  p_preferred_time time without time zone,
  p_origin_name text DEFAULT NULL,
  p_origin_lat numeric DEFAULT NULL,
  p_origin_lng numeric DEFAULT NULL,
  p_destination_name text DEFAULT NULL,
  p_destination_lat numeric DEFAULT NULL,
  p_destination_lng numeric DEFAULT NULL,
  p_teto_mensal_kz integer DEFAULT NULL,
  p_dias_semana integer[] DEFAULT NULL
)
RETURNS public.procuras
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_procura public.procuras%ROWTYPE;
  v_prop public.propostas%ROWTYPE;
  v_oferta public.ofertas_capacidade%ROWTYPE;
  v_wait public.lista_espera%ROWTYPE;
  v_dias integer[];
BEGIN
  SELECT * INTO v_procura FROM public.procuras WHERE id = p_procura_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Procura não encontrada.';
  END IF;

  PERFORM public._assert_procura_editavel(v_procura, v_uid);

  IF p_preferred_time IS NULL THEN
    RAISE EXCEPTION 'Horário preferido é obrigatório.';
  END IF;

  IF p_teto_mensal_kz IS NOT NULL AND p_teto_mensal_kz <= 0 THEN
    RAISE EXCEPTION 'O teto mensal deve ser um valor maior que 0 Kz.';
  END IF;

  IF p_dias_semana IS NOT NULL AND cardinality(p_dias_semana) > 0 THEN
    v_dias := p_dias_semana;
  ELSE
    v_dias := ARRAY[1, 2, 3, 4, 5];
  END IF;

  UPDATE public.procuras
  SET
    preferred_time = p_preferred_time,
    origin_name = p_origin_name,
    origin_lat = p_origin_lat,
    origin_lng = p_origin_lng,
    destination_name = p_destination_name,
    destination_lat = p_destination_lat,
    destination_lng = p_destination_lng,
    teto_mensal_kz = p_teto_mensal_kz,
    dias_semana = v_dias,
    updated_at = now()
  WHERE id = p_procura_id
  RETURNING * INTO v_procura;

  FOR v_prop IN
    SELECT * FROM public.propostas
    WHERE procura_id = p_procura_id AND estado = 'aberta'
    FOR UPDATE
  LOOP
    SELECT * INTO v_oferta FROM public.ofertas_capacidade WHERE id = v_prop.oferta_id;
    IF FOUND AND NOT public.oferta_compativel_com_procura(v_oferta, v_procura) THEN
      UPDATE public.propostas
      SET estado = 'invalidada', updated_at = now()
      WHERE id = v_prop.id;
      v_prop.estado := 'invalidada';
      PERFORM public._notify_proposta_driver_evento(
        v_prop,
        'proposal_invalidated',
        'A procura foi actualizada. Esta proposta já não corresponde — o valor negociado não foi alterado.'
      );
    END IF;
  END LOOP;

  FOR v_wait IN
    SELECT * FROM public.lista_espera
    WHERE procura_id = p_procura_id
      AND estado IN ('activa', 'notificada')
    FOR UPDATE
  LOOP
    SELECT * INTO v_oferta FROM public.ofertas_capacidade WHERE id = v_wait.oferta_id;
    IF FOUND AND NOT public.oferta_compativel_com_procura(v_oferta, v_procura) THEN
      UPDATE public.lista_espera
      SET estado = 'cancelada'
      WHERE id = v_wait.id;
    END IF;
  END LOOP;

  RETURN v_procura;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_procura(p_procura_id uuid)
RETURNS public.procuras
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_procura public.procuras%ROWTYPE;
  v_prop public.propostas%ROWTYPE;
BEGIN
  SELECT * INTO v_procura FROM public.procuras WHERE id = p_procura_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Procura não encontrada.';
  END IF;

  PERFORM public._assert_procura_editavel(v_procura, v_uid);

  UPDATE public.procuras
  SET estado = 'cancelada', updated_at = now()
  WHERE id = p_procura_id
  RETURNING * INTO v_procura;

  FOR v_prop IN
    SELECT * FROM public.propostas
    WHERE procura_id = p_procura_id AND estado = 'aberta'
    FOR UPDATE
  LOOP
    UPDATE public.propostas
    SET estado = 'cancelada', updated_at = now()
    WHERE id = v_prop.id;
    v_prop.estado := 'cancelada';
    PERFORM public._notify_proposta_driver_evento(
      v_prop,
      'proposal_cancelled',
      'A procura foi cancelada. Esta proposta ficou sem efeito.'
    );
  END LOOP;

  UPDATE public.lista_espera
  SET estado = 'cancelada'
  WHERE procura_id = p_procura_id
    AND estado IN ('activa', 'notificada');

  RETURN v_procura;
END;
$$;

REVOKE ALL ON FUNCTION public.update_procura(
  uuid, time without time zone, text, numeric, numeric, text, numeric, numeric, integer, integer[]
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_procura(
  uuid, time without time zone, text, numeric, numeric, text, numeric, numeric, integer, integer[]
) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_procura(
  uuid, time without time zone, text, numeric, numeric, text, numeric, numeric, integer, integer[]
) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_procura(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_procura(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_procura(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public._haversine_meters(double precision, double precision, double precision, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.oferta_compativel_com_procura(public.ofertas_capacidade, public.procuras) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._assert_procura_editavel(public.procuras, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._notify_proposta_driver_evento(public.propostas, text, text) FROM PUBLIC;

REVOKE ALL ON FUNCTION public._haversine_meters(double precision, double precision, double precision, double precision) FROM anon;
REVOKE ALL ON FUNCTION public.oferta_compativel_com_procura(public.ofertas_capacidade, public.procuras) FROM anon;
REVOKE ALL ON FUNCTION public._assert_procura_editavel(public.procuras, uuid) FROM anon;
REVOKE ALL ON FUNCTION public._notify_proposta_driver_evento(public.propostas, text, text) FROM anon;

REVOKE ALL ON FUNCTION public._haversine_meters(double precision, double precision, double precision, double precision) FROM authenticated;
REVOKE ALL ON FUNCTION public.oferta_compativel_com_procura(public.ofertas_capacidade, public.procuras) FROM authenticated;
REVOKE ALL ON FUNCTION public._assert_procura_editavel(public.procuras, uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public._notify_proposta_driver_evento(public.propostas, text, text) FROM authenticated;
