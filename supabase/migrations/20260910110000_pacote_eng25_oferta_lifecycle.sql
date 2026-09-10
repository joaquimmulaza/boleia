-- PACOTE ENG #25 — editar / despublicar oferta (motorista).
-- Propostas: só estado invalidada|cancelada — nunca mutar snapshot.

CREATE OR REPLACE FUNCTION public._assert_oferta_editavel(
  p_oferta public.ofertas_capacidade,
  p_uid uuid,
  p_bloquear_se_acordo boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF p_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_uid IS DISTINCT FROM p_oferta.driver_id THEN
    RAISE EXCEPTION 'Só o dono pode alterar esta oferta.';
  END IF;
  IF lower(p_oferta.estado) = 'inactiva' THEN
    RAISE EXCEPTION 'Esta oferta já está despublicada.';
  END IF;
  IF p_bloquear_se_acordo AND EXISTS (
    SELECT 1
    FROM public.acordos a
    WHERE a.oferta_id = p_oferta.id
      AND lower(a.estado) IN ('activo', 'cancelamento_pendente')
  ) THEN
    RAISE EXCEPTION 'Já existe um acordo activo para esta oferta. Usa «Encerrar acordo» em Acordos.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._notify_proposta_contraparte_evento(
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
  v_procura public.procuras%ROWTYPE;
  v_recipient uuid;
  v_inbox text;
BEGIN
  SELECT * INTO v_oferta FROM public.ofertas_capacidade WHERE id = p_prop.oferta_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO v_procura FROM public.procuras WHERE id = p_prop.procura_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF p_prop.created_by = v_oferta.driver_id THEN
    v_recipient := v_procura.owner_id;
    v_inbox := 'passageiro';
  ELSE
    v_recipient := v_oferta.driver_id;
    v_inbox := 'motorista';
  END IF;

  IF v_recipient IS NULL OR v_recipient = p_prop.created_by THEN
    RETURN;
  END IF;

  INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
  VALUES (
    v_recipient,
    p_mensagem,
    'info',
    jsonb_build_object(
      'type', p_type,
      'inbox', v_inbox,
      'proposta_id', p_prop.id,
      'oferta_id', p_prop.oferta_id,
      'procura_id', p_prop.procura_id
    )
  );
END;
$$;

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
  p_dias_semana integer[] DEFAULT NULL
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
    vagas_totais = v_vagas_veiculo,
    updated_at = now()
  WHERE id = p_oferta_id
  RETURNING * INTO v_oferta;

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

CREATE OR REPLACE FUNCTION public.cancel_oferta(p_oferta_id uuid)
RETURNS public.ofertas_capacidade
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_oferta public.ofertas_capacidade%ROWTYPE;
  v_prop public.propostas%ROWTYPE;
BEGIN
  SELECT * INTO v_oferta FROM public.ofertas_capacidade WHERE id = p_oferta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta não encontrada.';
  END IF;

  PERFORM public._assert_oferta_editavel(v_oferta, v_uid, true);

  UPDATE public.ofertas_capacidade
  SET estado = 'inactiva', updated_at = now()
  WHERE id = p_oferta_id
  RETURNING * INTO v_oferta;

  FOR v_prop IN
    SELECT * FROM public.propostas
    WHERE oferta_id = p_oferta_id AND estado = 'aberta'
    FOR UPDATE
  LOOP
    UPDATE public.propostas
    SET estado = 'cancelada', updated_at = now()
    WHERE id = v_prop.id;
    v_prop.estado := 'cancelada';
    PERFORM public._notify_proposta_contraparte_evento(
      v_prop,
      'proposal_cancelled',
      'A oferta foi despublicada. Esta proposta ficou sem efeito.'
    );
  END LOOP;

  UPDATE public.lista_espera
  SET estado = 'cancelada'
  WHERE oferta_id = p_oferta_id
    AND estado IN ('activa', 'notificada');

  RETURN v_oferta;
END;
$$;

REVOKE ALL ON FUNCTION public._assert_oferta_editavel(public.ofertas_capacidade, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._notify_proposta_contraparte_evento(public.propostas, text, text) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.update_oferta(
  uuid, time without time zone, text, integer, boolean,
  time without time zone, text, numeric, numeric, text, numeric, numeric, integer[]
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_oferta(
  uuid, time without time zone, text, integer, boolean,
  time without time zone, text, numeric, numeric, text, numeric, numeric, integer[]
) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_oferta(
  uuid, time without time zone, text, integer, boolean,
  time without time zone, text, numeric, numeric, text, numeric, numeric, integer[]
) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_oferta(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_oferta(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_oferta(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public._assert_oferta_editavel(public.ofertas_capacidade, uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public._assert_oferta_editavel(public.ofertas_capacidade, uuid, boolean) FROM authenticated;
REVOKE ALL ON FUNCTION public._notify_proposta_contraparte_evento(public.propostas, text, text) FROM anon;
REVOKE ALL ON FUNCTION public._notify_proposta_contraparte_evento(public.propostas, text, text) FROM authenticated;
