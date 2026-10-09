-- Reactivar oferta (motorista) — motivo inactiva + revoke UPDATE client.

ALTER TABLE public.ofertas_capacidade
  ADD COLUMN IF NOT EXISTS inactiva_motivo text
    CHECK (inactiva_motivo IS NULL OR inactiva_motivo IN ('motorista', 'admin'));

ALTER TABLE public.ofertas_capacidade
  DROP COLUMN IF EXISTS hidden_by_admin;

COMMENT ON COLUMN public.ofertas_capacidade.inactiva_motivo IS
  'Porque ficou inactiva: motorista (cancel_oferta) ou admin. NULL quando publicada.';

-- Cliente não faz UPDATE directo — só RPCs SECURITY DEFINER.
REVOKE UPDATE ON TABLE public.ofertas_capacidade FROM authenticated;
REVOKE UPDATE ON TABLE public.ofertas_capacidade FROM anon;

DROP POLICY IF EXISTS ofertas_update_proprio ON public.ofertas_capacidade;

-- cancel_oferta regista motivo motorista
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
  SET estado = 'inactiva',
      inactiva_motivo = 'motorista',
      updated_at = now()
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

CREATE OR REPLACE FUNCTION public.reactivate_oferta(p_oferta_id uuid)
RETURNS public.ofertas_capacidade
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_oferta public.ofertas_capacidade%ROWTYPE;
  v_vagas_veiculo integer;
  v_ocupadas integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT * INTO v_oferta FROM public.ofertas_capacidade WHERE id = p_oferta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta não encontrada.';
  END IF;

  IF v_uid IS DISTINCT FROM v_oferta.driver_id THEN
    RAISE EXCEPTION 'Só o dono pode reactivar esta oferta.';
  END IF;

  IF lower(v_oferta.estado) <> 'inactiva' THEN
    RAISE EXCEPTION 'Esta oferta já está publicada.';
  END IF;

  IF COALESCE(v_oferta.is_test, false) THEN
    RAISE EXCEPTION 'Oferta de teste não pode ser reactivada.';
  END IF;

  IF lower(COALESCE(v_oferta.inactiva_motivo, '')) = 'admin' THEN
    RAISE EXCEPTION 'Esta oferta foi retirada pela equipa.';
  END IF;

  IF lower(COALESCE(v_oferta.inactiva_motivo, '')) <> 'motorista' THEN
    RAISE EXCEPTION 'Só podes reactivar ofertas que despublicaste tu.';
  END IF;

  SELECT v.vagas_passageiros INTO v_vagas_veiculo
  FROM public.veiculos v
  WHERE v.id = v_oferta.veiculo_id;

  IF NOT FOUND OR v_vagas_veiculo IS NULL OR v_vagas_veiculo < 1 THEN
    RAISE EXCEPTION 'Regista o teu veículo antes de reactivar a oferta.';
  END IF;

  v_ocupadas := public.oferta_ocupacao(p_oferta_id);

  IF v_ocupadas > v_oferta.vagas_totais THEN
    RAISE EXCEPTION
      'Não há lugares suficientes na oferta (% lugares) para os acordos activos (% ocupados).',
      v_oferta.vagas_totais, v_ocupadas;
  END IF;

  IF v_oferta.vagas_totais > v_vagas_veiculo THEN
    RAISE EXCEPTION
      'O veículo só tem % lugares — a oferta tinha % publicados.',
      v_vagas_veiculo, v_oferta.vagas_totais;
  END IF;

  UPDATE public.ofertas_capacidade
  SET
    estado = 'disponivel',
    inactiva_motivo = NULL,
    updated_at = now()
  WHERE id = p_oferta_id
  RETURNING * INTO v_oferta;

  RETURN v_oferta;
END;
$$;

REVOKE ALL ON FUNCTION public.reactivate_oferta(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reactivate_oferta(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.reactivate_oferta(uuid) TO authenticated;
