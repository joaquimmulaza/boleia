-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260906092134 audit_gaps_apply_due_em_vigor_v2
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
  v_quota integer;
  r record;
  v_applied integer := 0;
BEGIN
  FOR v_adenda IN
    SELECT *
    FROM public.acordos_adendas
    WHERE applied_at IS NULL
      AND superseded_at IS NULL
      AND lower(estado) = 'aceite'
      AND effective_from <= v_today
      AND (p_acordo_id IS NULL OR acordo_id = p_acordo_id)
    ORDER BY effective_from ASC, created_at ASC
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
        AND estado = 'activo'
      ORDER BY ordem_insercao ASC, passenger_id ASC
    LOOP
      v_quota := v_base;

      UPDATE public.acordos_passageiros
      SET quota_mensal_kz = v_quota
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
