-- PACOTE ENG #9: promote_waitlist só notifica quando há vagas >= N da procura (N_actual sync).
-- Evita «vaga aberta» enganadora e qualquer atalho para acordo sem proposta/aceite.

CREATE OR REPLACE FUNCTION public.promote_waitlist(p_oferta_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_entry public.lista_espera%ROWTYPE;
  v_oferta public.ofertas_capacidade%ROWTYPE;
  v_procura public.procuras%ROWTYPE;
  v_allowed boolean := false;
  v_ocupadas integer;
  v_disponiveis integer;
  v_n_required integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_oferta_id IS NULL THEN
    RAISE EXCEPTION 'oferta_id é obrigatório.';
  END IF;

  SELECT * INTO v_oferta
  FROM public.ofertas_capacidade
  WHERE id = p_oferta_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta não encontrada.';
  END IF;

  IF v_uid = v_oferta.driver_id THEN
    v_allowed := true;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.acordos_passageiros ap
      JOIN public.acordos a ON a.id = ap.acordo_id
      WHERE a.oferta_id = p_oferta_id
        AND ap.passenger_id = v_uid
    ) INTO v_allowed;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Sem permissão para promover a lista de espera desta oferta.';
  END IF;

  SELECT * INTO v_entry
  FROM public.lista_espera
  WHERE oferta_id = p_oferta_id
    AND estado = 'activa'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_procura
  FROM public.procuras
  WHERE id = v_entry.procura_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Procura da lista de espera não encontrada.';
  END IF;

  v_n_required := GREATEST(COALESCE(v_procura.n_candidato, 1), 1);

  SELECT COALESCE(COUNT(*), 0)::integer INTO v_ocupadas
  FROM public.acordos_passageiros ap
  JOIN public.acordos a ON a.id = ap.acordo_id
  WHERE a.oferta_id = p_oferta_id
    AND lower(a.estado) = 'activo'
    AND lower(ap.estado) = 'activo';

  v_disponiveis := GREATEST(0, v_oferta.vagas_totais - v_ocupadas);

  -- ENG#9: capacidade insuficiente para N_proposto/N_actual → mantém activa (sem notificar)
  IF v_disponiveis < v_n_required THEN
    RETURN NULL;
  END IF;

  UPDATE public.lista_espera
  SET estado = 'notificada'
  WHERE id = v_entry.id;

  INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
  VALUES (
    v_procura.owner_id,
    'Abriu-se uma vaga numa oferta em que estás em lista de espera. Podes propor acordo — não foste aceite automaticamente.',
    'info',
    jsonb_build_object(
      'type', 'waitlist_promoted',
      'oferta_id', p_oferta_id,
      'procura_id', v_entry.procura_id,
      'lista_espera_id', v_entry.id
    )
  );

  RETURN v_entry.id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.promote_waitlist(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_waitlist(uuid) TO service_role;
