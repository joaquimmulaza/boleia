-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260905113246 marketplace_cancel_proposal_by_creator
-- Do not rename; Supabase Preview CI requires exact version match.

-- Cancelamento pelo criador: SECURITY DEFINER only.
-- NÃO reabre UPDATE client em propostas (P0).

CREATE OR REPLACE FUNCTION public.cancel_proposal(p_proposta_id uuid)
RETURNS public.propostas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prop public.propostas%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT * INTO v_prop FROM public.propostas WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada.';
  END IF;

  IF v_prop.estado <> 'aberta' THEN
    RAISE EXCEPTION 'Proposta não está aberta.';
  END IF;

  -- Só o criador cancela (contraparte usa reject_proposal)
  IF v_uid IS DISTINCT FROM v_prop.created_by THEN
    RAISE EXCEPTION 'Só o criador pode cancelar esta proposta.';
  END IF;

  UPDATE public.propostas
  SET estado = 'cancelada', updated_at = now()
  WHERE id = v_prop.id
  RETURNING * INTO v_prop;

  RETURN v_prop;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_proposal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_proposal(uuid) TO authenticated;
-- anon sem EXECUTE (alinhado a accept/reject)
