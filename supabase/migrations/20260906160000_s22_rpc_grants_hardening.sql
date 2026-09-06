-- Epic §22 — follow-up de grants (code-reviewer REJECT a41e4d9e)
-- Spec: .specs/features/acordo-pos-acordo-s22/{spec,design,tasks}.md
--
-- Fecha 3 buracos deixados por s22_grants_hardening_revoke_anon:
--   1) REVOKE anon nas 4 RPCs de adenda que o default privilege do Supabase
--      reconcedeu (renegotiate / accept / reject / apply_due_adendas).
--   2) Guard auth.uid() nas lazy apply_due_* (listagens já correm com sessão).
--   3) recount_oferta_vagas deixa de ser executável pelo cliente
--      (authenticated/anon/PUBLIC); só owner / SECURITY DEFINER internas.
--
-- Aplicado remotamente via Supabase MCP (apply_migration) no projecto
-- boleia (fdclrbcgytnuqcrpsevw) em 2026-09-06:
--   s22_rpc_grants_hardening
-- Assinaturas verificadas no remoto antes do REVOKE
-- (pg_get_function_identity_arguments).

-- =============================================================================
-- 1) Guard de autenticação nas lazy apply_due_*
-- =============================================================================

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

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

    -- Unidade contratual congelada (N_contrato); não recalcular por N_activos.
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

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

-- =============================================================================
-- 2) REVOKE anon nas 4 RPCs de adenda + GRANT só authenticated
-- =============================================================================

REVOKE ALL ON FUNCTION public.renegotiate_agreement_pricing(uuid, text, integer, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.renegotiate_agreement_pricing(uuid, text, integer, integer, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.renegotiate_agreement_pricing(uuid, text, integer, integer, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.accept_agreement_adenda(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_agreement_adenda(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_agreement_adenda(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_agreement_adenda(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_agreement_adenda(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_agreement_adenda(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.apply_due_agreement_adendas(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_due_agreement_adendas(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_due_agreement_adendas(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.apply_due_agreement_terminations(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_due_agreement_terminations(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_due_agreement_terminations(uuid) TO authenticated;

-- =============================================================================
-- 3) recount_oferta_vagas — sem EXECUTE para clientes
-- =============================================================================

REVOKE ALL ON FUNCTION public.recount_oferta_vagas(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recount_oferta_vagas(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.recount_oferta_vagas(uuid) FROM authenticated;
