-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260904210345 promote_waitlist_rpc
-- Do not rename; Supabase Preview CI requires exact version match.

-- T26: promoção waitlist = notificação (sem auto-aceitar).
-- SECURITY DEFINER: precisa de actualizar lista_espera alheia + INSERT notificacoes (sem policy INSERT no client).

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

  UPDATE public.lista_espera
  SET estado = 'notificada'
  WHERE id = v_entry.id;

  SELECT * INTO v_procura
  FROM public.procuras
  WHERE id = v_entry.procura_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Procura da lista de espera não encontrada.';
  END IF;

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
