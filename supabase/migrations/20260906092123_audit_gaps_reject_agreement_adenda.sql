-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260906092123 audit_gaps_reject_agreement_adenda
-- Do not rename; Supabase Preview CI requires exact version match.

DROP FUNCTION IF EXISTS public.reject_agreement_adenda(uuid);

CREATE OR REPLACE FUNCTION public.reject_agreement_adenda(
  p_adenda_id uuid
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
  v_is_pax boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_adenda_id IS NULL THEN
    RAISE EXCEPTION 'ID da adenda é obrigatório.';
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

  IF lower(v_adenda.estado) = 'rejeitada' THEN
    RETURN v_adenda.id;
  END IF;

  IF lower(v_adenda.estado) NOT IN ('pendente_passageiro', 'pendente_contraparte') THEN
    RAISE EXCEPTION 'Adenda não está pendente de decisão da contraparte.';
  END IF;

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = v_adenda.acordo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  IF v_uid = v_adenda.created_by THEN
    RAISE EXCEPTION 'Só a contraparte pode rejeitar esta adenda.';
  END IF;

  IF lower(v_adenda.estado) = 'pendente_passageiro' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = v_adenda.acordo_id
        AND ap.passenger_id = v_uid
        AND ap.estado = 'activo'
    ) INTO v_is_pax;

    IF NOT v_is_pax THEN
      RAISE EXCEPTION 'Só a contraparte pode rejeitar esta adenda.';
    END IF;
  ELSIF lower(v_adenda.estado) = 'pendente_contraparte' THEN
    IF v_uid IS DISTINCT FROM v_acordo.driver_id THEN
      RAISE EXCEPTION 'Só a contraparte pode rejeitar esta adenda.';
    END IF;
  END IF;

  UPDATE public.acordos_adendas
  SET estado = 'rejeitada'
  WHERE id = v_adenda.id;

  BEGIN
    INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
    VALUES (
      v_adenda.created_by,
      'A contraparte rejeitou a proposta de alteração de preço.',
      'warning',
      jsonb_build_object(
        'type', 'agreement_update',
        'acordo_id', v_adenda.acordo_id,
        'adenda_id', v_adenda.id,
        'adenda_estado', 'rejeitada'
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Falha ao notificar rejeição de adenda %: %', v_adenda.id, SQLERRM;
  END;

  RETURN v_adenda.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.reject_agreement_adenda(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_agreement_adenda(uuid) TO authenticated;
