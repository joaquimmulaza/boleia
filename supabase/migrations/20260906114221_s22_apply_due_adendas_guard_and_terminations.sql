-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260906114221 s22_apply_due_adendas_guard_and_terminations
-- Do not rename; Supabase Preview CI requires exact version match.

CREATE OR REPLACE FUNCTION public.apply_due_agreement_adendas(
  p_acordo_id uuid DEFAULT NULL::uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (timezone('Africa/Luanda', now()))::date;
  v_adenda public.acordos_adendas%ROWTYPE;
  v_base integer;
  r record;
  v_applied integer := 0;
BEGIN
  FOR v_adenda IN
    SELECT ad.*
    FROM public.acordos_adendas ad
    WHERE ad.applied_at IS NULL
      AND ad.superseded_at IS NULL
      AND lower(ad.estado) = 'aceite'
      AND ad.effective_from <= v_today
      AND (p_acordo_id IS NULL OR ad.acordo_id = p_acordo_id)
      AND EXISTS (
        SELECT 1 FROM public.acordos a
        WHERE a.id = ad.acordo_id
          AND lower(a.estado) = 'activo'
      )
    ORDER BY ad.effective_from ASC, ad.created_at ASC
    FOR UPDATE
  LOOP
    UPDATE public.acordos
    SET
      modo_preco = v_adenda.modo_preco,
      n_passageiros_contrato = v_adenda.n_passageiros_contrato,
      valor_mensal_total_kz = v_adenda.valor_mensal_total_kz,
      valor_mensal_por_passageiro_kz = v_adenda.valor_mensal_por_passageiro_kz
    WHERE id = v_adenda.acordo_id;

    v_base := v_adenda.valor_mensal_por_passageiro_kz;

    FOR r IN
      SELECT id
      FROM public.acordos_passageiros
      WHERE acordo_id = v_adenda.acordo_id
        AND lower(estado) = 'activo'
      ORDER BY ordem_insercao ASC, passenger_id ASC
    LOOP
      UPDATE public.acordos_passageiros
      SET quota_mensal_kz = v_base
      WHERE id = r.id;
    END LOOP;

    UPDATE public.acordos_adendas
    SET
      applied_at = now(),
      estado = 'em_vigor'
    WHERE id = v_adenda.id;

    v_applied := v_applied + 1;
  END LOOP;

  RETURN v_applied;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_due_agreement_adendas(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_due_agreement_adendas(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_due_agreement_terminations(
  p_acordo_id uuid DEFAULT NULL::uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (timezone('Africa/Luanda', now()))::date;
  v_acordo public.acordos%ROWTYPE;
  v_applied integer := 0;
BEGIN
  FOR v_acordo IN
    SELECT *
    FROM public.acordos
    WHERE lower(estado) = 'cancelamento_pendente'
      AND rescisao_effective_on IS NOT NULL
      AND rescisao_effective_on <= v_today
      AND (p_acordo_id IS NULL OR id = p_acordo_id)
    ORDER BY rescisao_effective_on ASC, created_at ASC
    FOR UPDATE
  LOOP
    UPDATE public.acordos
    SET
      estado = 'cancelado',
      cancelado_em = now()
    WHERE id = v_acordo.id;

    UPDATE public.acordos_passageiros
    SET estado = 'saiu'
    WHERE acordo_id = v_acordo.id
      AND lower(estado) = 'activo';

    PERFORM public.recount_oferta_vagas(v_acordo.oferta_id);

    BEGIN
      PERFORM public.promote_waitlist(v_acordo.oferta_id);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Falha best-effort promote_waitlist na rescisão do acordo %: %',
          v_acordo.id, SQLERRM;
    END;

    v_applied := v_applied + 1;
  END LOOP;

  RETURN v_applied;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_due_agreement_terminations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_due_agreement_terminations(uuid) TO authenticated;
