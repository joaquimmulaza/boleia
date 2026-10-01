-- ENG#35 hotfix — accept/cancel adenda: autorização por created_by quando rejeitada
-- Não reescrever 20261001140321 (já aplicada no remoto como 20261001140321).

CREATE OR REPLACE FUNCTION public.accept_agreement_adenda(
  p_adenda_id uuid,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_adenda public.acordos_adendas%ROWTYPE;
  v_acordo public.acordos%ROWTYPE;
  v_estado text;
  v_is_pax boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF NOT public._preco_proxima_janela_aberta() THEN
    RAISE EXCEPTION 'A janela para mudar o preço do próximo mês está fechada.';
  END IF;

  IF p_adenda_id IS NULL THEN
    RAISE EXCEPTION 'ID da adenda é obrigatório.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      RETURN p_adenda_id;
    END IF;
  END IF;

  SELECT * INTO v_adenda
  FROM public.acordos_adendas
  WHERE id = p_adenda_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Adenda não encontrada.';
  END IF;

  IF v_adenda.superseded_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta adenda já foi substituída.';
  END IF;

  IF v_adenda.applied_at IS NOT NULL OR lower(v_adenda.estado) = 'em_vigor' THEN
    RAISE EXCEPTION 'Esta adenda já foi aplicada.';
  END IF;

  v_estado := lower(v_adenda.estado);

  IF v_estado IN ('aceite', 'aceite_agendada') THEN
    IF p_idempotency_key IS NOT NULL THEN
      INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
      VALUES (p_idempotency_key, 'accept_agreement_adenda', v_adenda.id, v_uid)
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
    RETURN v_adenda.id;
  END IF;

  IF v_estado NOT IN ('pendente_passageiro', 'pendente_contraparte', 'rejeitada') THEN
    RAISE EXCEPTION 'Adenda não está pendente de aceitação.';
  END IF;

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = v_adenda.acordo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  IF lower(v_acordo.estado) <> 'activo' THEN
    RAISE EXCEPTION 'Acordo não está activo.';
  END IF;

  IF v_uid = v_adenda.created_by THEN
    RAISE EXCEPTION 'Só a contraparte pode aceitar esta adenda.';
  END IF;

  IF v_estado = 'pendente_passageiro'
     OR (v_estado = 'rejeitada' AND v_adenda.created_by = v_acordo.driver_id) THEN
    IF v_uid = v_acordo.driver_id THEN
      RAISE EXCEPTION 'Apenas um passageiro activo do acordo pode aceitar a adenda.';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = v_adenda.acordo_id
        AND ap.passenger_id = v_uid
        AND lower(ap.estado) = 'activo'
    ) INTO v_is_pax;

    IF NOT v_is_pax THEN
      RAISE EXCEPTION 'Apenas um passageiro activo do acordo pode aceitar a adenda.';
    END IF;
  ELSE
    IF v_uid IS DISTINCT FROM v_acordo.driver_id THEN
      RAISE EXCEPTION 'Apenas o motorista do acordo pode aceitar esta adenda.';
    END IF;
  END IF;

  UPDATE public.acordos_adendas
  SET
    estado = 'aceite_agendada',
    aceite_em = now(),
    aceite_por = v_uid
  WHERE id = v_adenda.id;

  PERFORM public.apply_due_agreement_adendas(v_adenda.acordo_id);

  BEGIN
    INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
    VALUES (
      v_adenda.created_by,
      'A contraparte aceitou a proposta de preço para o próximo mês.',
      'success',
      jsonb_build_object(
        'type', 'agreement_update',
        'acordo_id', v_adenda.acordo_id,
        'adenda_id', v_adenda.id,
        'adenda_estado', 'aceite_agendada'
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Falha ao notificar aceite de adenda %: %', v_adenda.id, SQLERRM;
  END;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'accept_agreement_adenda', v_adenda.id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_adenda.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_agreement_adenda(
  p_adenda_id uuid,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_adenda public.acordos_adendas%ROWTYPE;
  v_estado text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_adenda_id IS NULL THEN
    RAISE EXCEPTION 'adenda_id é obrigatório.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      RETURN p_adenda_id;
    END IF;
  END IF;

  SELECT * INTO v_adenda
  FROM public.acordos_adendas
  WHERE id = p_adenda_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Adenda não encontrada.';
  END IF;

  v_estado := lower(v_adenda.estado);

  IF v_estado = 'cancelada_iniciador' THEN
    IF p_idempotency_key IS NOT NULL THEN
      INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
      VALUES (p_idempotency_key, 'cancel_agreement_adenda', v_adenda.id, v_uid)
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
    RETURN v_adenda.id;
  END IF;

  IF v_estado NOT IN ('pendente_passageiro', 'pendente_contraparte', 'rejeitada') THEN
    RAISE EXCEPTION 'Só podes anular uma renegociação ainda pendente.';
  END IF;

  IF v_uid IS DISTINCT FROM v_adenda.created_by THEN
    RAISE EXCEPTION 'Só quem iniciou a renegociação a pode anular.';
  END IF;

  IF v_estado = 'rejeitada' AND NOT public._preco_proxima_janela_aberta() THEN
    RAISE EXCEPTION 'A janela para mudar o preço do próximo mês está fechada.';
  END IF;

  UPDATE public.acordos_adendas
  SET
    estado = 'cancelada_iniciador',
    superseded_at = now()
  WHERE id = v_adenda.id;

  BEGIN
    INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
    SELECT
      t.user_id,
      'A renegociação de preço foi anulada por quem a propôs.',
      'info',
      jsonb_build_object(
        'type', 'agreement_update',
        'acordo_id', v_adenda.acordo_id,
        'adenda_id', v_adenda.id,
        'adenda_estado', 'cancelada_iniciador'
      )
    FROM (
      SELECT a.driver_id AS user_id
      FROM public.acordos a
      WHERE a.id = v_adenda.acordo_id
      UNION
      SELECT ap.passenger_id
      FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = v_adenda.acordo_id
        AND lower(ap.estado) = 'activo'
    ) t
    WHERE t.user_id IS DISTINCT FROM v_uid;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Falha ao notificar anulação de adenda %: %', v_adenda.id, SQLERRM;
  END;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'cancel_agreement_adenda', v_adenda.id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_adenda.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_agreement_adenda(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_agreement_adenda(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_agreement_adenda(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_agreement_adenda(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_agreement_adenda(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_agreement_adenda(uuid, uuid) TO authenticated;
