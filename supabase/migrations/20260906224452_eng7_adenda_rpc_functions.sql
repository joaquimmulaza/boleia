-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260906224452 eng7_adenda_rpc_functions
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
  v_resto integer;
  v_quota integer;
  r record;
  i integer;
  v_applied integer := 0;
BEGIN
  FOR v_adenda IN
    SELECT *
    FROM public.acordos_adendas
    WHERE applied_at IS NULL
      AND superseded_at IS NULL
      AND lower(estado) IN ('aceite', 'aceite_agendada')
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

    IF v_adenda.modo_preco = 'POR_PASSAGEIRO' THEN
      v_base := v_adenda.valor_mensal_por_passageiro_kz;
      v_resto := 0;
    ELSE
      v_base := v_adenda.valor_mensal_por_passageiro_kz;
      v_resto := v_adenda.valor_mensal_total_kz
        - (v_base * v_adenda.n_passageiros_contrato);
      IF v_resto < 0 THEN
        v_resto := 0;
      END IF;
    END IF;

    i := 0;
    FOR r IN
      SELECT id
      FROM public.acordos_passageiros
      WHERE acordo_id = v_adenda.acordo_id
        AND lower(estado) = 'activo'
      ORDER BY ordem_insercao ASC, passenger_id ASC
    LOOP
      IF v_adenda.modo_preco = 'POR_PASSAGEIRO' THEN
        v_quota := v_base;
      ELSE
        v_quota := CASE WHEN i < v_resto THEN v_base + 1 ELSE v_base END;
      END IF;

      UPDATE public.acordos_passageiros
      SET quota_mensal_kz = v_quota
      WHERE id = r.id;

      i := i + 1;
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

CREATE OR REPLACE FUNCTION public.respond_agreement_adenda(
  p_adenda_id uuid,
  p_accept boolean,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_accept IS TRUE THEN
    RETURN public.accept_agreement_adenda(p_adenda_id, p_idempotency_key);
  END IF;

  RETURN public.reject_agreement_adenda(p_adenda_id, p_idempotency_key);
END;
$function$;

REVOKE ALL ON FUNCTION public.respond_agreement_adenda(uuid, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_agreement_adenda(uuid, boolean, uuid) TO authenticated;
