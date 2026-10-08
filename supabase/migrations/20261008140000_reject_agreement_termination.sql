-- Recusa de pedido consensual de rescisão (contraparte, acordo activo).

CREATE OR REPLACE FUNCTION public.reject_agreement_termination(
  p_acordo_id uuid,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_acordo public.acordos%ROWTYPE;
  v_is_driver boolean;
  v_is_pax boolean;
  v_solicitante uuid;
  v_solicitante_is_driver boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_acordo_id IS NULL THEN
    RAISE EXCEPTION 'ID do acordo é obrigatório.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      RETURN p_acordo_id;
    END IF;
  END IF;

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = p_acordo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  IF lower(v_acordo.estado) <> 'activo' THEN
    RAISE EXCEPTION 'Este acordo já não está activo.';
  END IF;

  IF lower(COALESCE(v_acordo.rescisao_modo, '')) <> 'consensual' THEN
    RAISE EXCEPTION 'Não há pedido consensual pendente neste acordo.';
  END IF;

  v_solicitante := v_acordo.rescisao_solicitada_por;

  IF v_solicitante IS NULL THEN
    RAISE EXCEPTION 'Não há pedido consensual pendente neste acordo.';
  END IF;

  IF v_solicitante = v_uid THEN
    RAISE EXCEPTION 'Só a contraparte pode recusar este pedido.';
  END IF;

  v_is_driver := (v_uid = v_acordo.driver_id);

  SELECT EXISTS (
    SELECT 1
    FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id
      AND ap.passenger_id = v_uid
      AND lower(ap.estado) IN ('activo', 'reservado')
  ) INTO v_is_pax;

  v_solicitante_is_driver := (v_solicitante = v_acordo.driver_id);

  IF NOT (
    (v_solicitante_is_driver AND v_is_pax)
    OR (NOT v_solicitante_is_driver AND v_is_driver)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para recusar este pedido.';
  END IF;

  UPDATE public.acordos
  SET
    rescisao_modo = NULL,
    rescisao_solicitada_por = NULL,
    rescisao_vigencia = NULL,
    rescisao_justificativa = NULL,
    rescisao_effective_on = NULL
  WHERE id = p_acordo_id;

  BEGIN
    INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
    SELECT
      t.user_id,
      CASE
        WHEN t.user_id = v_solicitante THEN
          'A contraparte recusou o pedido de encerramento amigável.'
        ELSE
          'O pedido de encerramento amigável deste acordo foi recusado.'
      END,
      'warning',
      jsonb_build_object(
        'type', 'agreement_update',
        'acordo_id', p_acordo_id
      )
    FROM (
      SELECT v_acordo.driver_id AS user_id
      UNION
      SELECT ap.passenger_id
      FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = p_acordo_id
        AND lower(ap.estado) IN ('activo', 'reservado')
    ) t
    WHERE t.user_id IS DISTINCT FROM v_uid;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Falha ao notificar recusa consensual do acordo %: %',
        p_acordo_id, SQLERRM;
  END;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'reject_agreement_termination', p_acordo_id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN p_acordo_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.reject_agreement_termination(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_agreement_termination(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_agreement_termination(uuid, uuid) TO authenticated;
