-- Smoke #3a — item 5: editar lugares totais da oferta (stepper) com validação backend.
-- Min = oferta_ocupacao (acordos activo|cancelamento_pendente, passageiros activo|reservado).
-- Max = veiculos.vagas_passageiros (capacidade_total inclui motorista).

DROP FUNCTION IF EXISTS public.update_oferta(
  uuid,
  time without time zone,
  text,
  integer,
  boolean,
  time without time zone,
  text,
  numeric,
  numeric,
  text,
  numeric,
  numeric,
  integer[]
);

CREATE OR REPLACE FUNCTION public.update_oferta(
  p_oferta_id uuid,
  p_departure_time time without time zone,
  p_modo_preco text,
  p_valor_mensal_ask_kz integer,
  p_flexibilidade_rota boolean DEFAULT false,
  p_return_time time without time zone DEFAULT NULL,
  p_origin_name text DEFAULT NULL,
  p_origin_lat numeric DEFAULT NULL,
  p_origin_lng numeric DEFAULT NULL,
  p_destination_name text DEFAULT NULL,
  p_destination_lat numeric DEFAULT NULL,
  p_destination_lng numeric DEFAULT NULL,
  p_dias_semana integer[] DEFAULT NULL,
  p_vagas_totais integer DEFAULT NULL
)
RETURNS public.ofertas_capacidade
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_oferta public.ofertas_capacidade%ROWTYPE;
  v_prop public.propostas%ROWTYPE;
  v_procura public.procuras%ROWTYPE;
  v_dias integer[];
  v_flex boolean;
  v_vagas_veiculo integer;
  v_ocupadas integer;
  v_vagas_alvo integer;
  v_wait public.lista_espera%ROWTYPE;
BEGIN
  SELECT * INTO v_oferta FROM public.ofertas_capacidade WHERE id = p_oferta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta não encontrada.';
  END IF;

  PERFORM public._assert_oferta_editavel(v_oferta, v_uid, false);

  IF p_departure_time IS NULL THEN
    RAISE EXCEPTION 'Horário de partida é obrigatório.';
  END IF;
  IF p_modo_preco IS NULL OR p_modo_preco NOT IN ('POR_PASSAGEIRO', 'TOTAL_ACORDO') THEN
    RAISE EXCEPTION 'Modo de preço inválido.';
  END IF;
  IF p_valor_mensal_ask_kz IS NULL OR p_valor_mensal_ask_kz < 0 THEN
    RAISE EXCEPTION 'Valor mensal em Kz inválido.';
  END IF;

  v_flex := COALESCE(p_flexibilidade_rota, false);
  IF NOT v_flex THEN
    IF p_origin_lat IS NULL OR p_origin_lng IS NULL
       OR p_destination_lat IS NULL OR p_destination_lng IS NULL THEN
      RAISE EXCEPTION 'Oferta fixa exige origem e destino com coordenadas.';
    END IF;
  END IF;

  IF p_dias_semana IS NOT NULL AND cardinality(p_dias_semana) > 0 THEN
    v_dias := p_dias_semana;
  ELSE
    v_dias := ARRAY[1, 2, 3, 4, 5];
  END IF;

  SELECT v.vagas_passageiros INTO v_vagas_veiculo
  FROM public.veiculos v
  WHERE v.id = v_oferta.veiculo_id;

  IF NOT FOUND OR v_vagas_veiculo IS NULL OR v_vagas_veiculo < 1 THEN
    RAISE EXCEPTION 'Veículo da oferta inválido.';
  END IF;

  v_ocupadas := public.oferta_ocupacao(p_oferta_id);
  v_vagas_alvo := COALESCE(p_vagas_totais, v_oferta.vagas_totais);

  IF v_vagas_alvo IS NULL OR v_vagas_alvo < 1 THEN
    RAISE EXCEPTION 'Número de lugares inválido.';
  END IF;

  IF v_vagas_alvo < v_ocupadas THEN
    RAISE EXCEPTION
      'Não podes reduzir abaixo de % lugares — já tens % ocupados por acordos activos.',
      v_ocupadas, v_ocupadas;
  END IF;

  IF v_vagas_alvo > v_vagas_veiculo THEN
    RAISE EXCEPTION
      'O veículo só tem % lugares para passageiros (capacidade total menos o motorista).',
      v_vagas_veiculo;
  END IF;

  UPDATE public.ofertas_capacidade
  SET
    departure_time = p_departure_time,
    return_time = p_return_time,
    modo_preco = p_modo_preco,
    valor_mensal_ask_kz = p_valor_mensal_ask_kz,
    flexibilidade_rota = v_flex,
    origin_name = CASE WHEN v_flex THEN NULL ELSE p_origin_name END,
    origin_lat = CASE WHEN v_flex THEN NULL ELSE p_origin_lat END,
    origin_lng = CASE WHEN v_flex THEN NULL ELSE p_origin_lng END,
    destination_name = CASE WHEN v_flex THEN NULL ELSE p_destination_name END,
    destination_lat = CASE WHEN v_flex THEN NULL ELSE p_destination_lat END,
    destination_lng = CASE WHEN v_flex THEN NULL ELSE p_destination_lng END,
    dias_semana = v_dias,
    vagas_totais = v_vagas_alvo,
    updated_at = now()
  WHERE id = p_oferta_id
  RETURNING * INTO v_oferta;

  PERFORM public.recount_oferta_vagas(p_oferta_id);

  SELECT * INTO v_oferta FROM public.ofertas_capacidade WHERE id = p_oferta_id;

  FOR v_prop IN
    SELECT * FROM public.propostas
    WHERE oferta_id = p_oferta_id AND estado = 'aberta'
    FOR UPDATE
  LOOP
    SELECT * INTO v_procura FROM public.procuras WHERE id = v_prop.procura_id;
    IF FOUND AND NOT public.oferta_compativel_com_procura(v_oferta, v_procura) THEN
      UPDATE public.propostas
      SET estado = 'invalidada', updated_at = now()
      WHERE id = v_prop.id;
      v_prop.estado := 'invalidada';
      PERFORM public._notify_proposta_contraparte_evento(
        v_prop,
        'proposal_invalidated',
        'A oferta foi actualizada. Esta proposta já não corresponde — o valor negociado não foi alterado.'
      );
    END IF;
  END LOOP;

  FOR v_wait IN
    SELECT * FROM public.lista_espera
    WHERE oferta_id = p_oferta_id
      AND estado IN ('activa', 'notificada')
    FOR UPDATE
  LOOP
    SELECT * INTO v_procura FROM public.procuras WHERE id = v_wait.procura_id;
    IF FOUND AND NOT public.oferta_compativel_com_procura(v_oferta, v_procura) THEN
      UPDATE public.lista_espera
      SET estado = 'cancelada'
      WHERE id = v_wait.id;
    END IF;
  END LOOP;

  RETURN v_oferta;
END;
$$;

REVOKE ALL ON FUNCTION public.update_oferta(
  uuid, time without time zone, text, integer, boolean,
  time without time zone, text, numeric, numeric, text, numeric, numeric, integer[], integer
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_oferta(
  uuid, time without time zone, text, integer, boolean,
  time without time zone, text, numeric, numeric, text, numeric, numeric, integer[], integer
) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_oferta(
  uuid, time without time zone, text, integer, boolean,
  time without time zone, text, numeric, numeric, text, numeric, numeric, integer[], integer
) TO authenticated;
