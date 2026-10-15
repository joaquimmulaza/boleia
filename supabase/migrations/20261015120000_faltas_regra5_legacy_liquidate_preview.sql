-- Regra 5 follow-up (B2/B3): remove overload legacy admin_liquidate_payment(uuid);
-- Auditoria callers (2026-10-15): src/ PaymentService + AdminPagamentos (rpc 2-arg com
-- p_idempotency_key); supabase/functions/ sem referências; scripts/ vazio; SQL provas
-- (id, NULL) = overload 2-arg; prod pg_proc prosrc: nenhuma função SQL chama esta RPC.
-- preview RPC alinhada a _desconto_faltas_pagamento.
-- S2: trigger on_falta_calc_desconto já cobre INSERT OR UPDATE (t7).
-- S3: GUC boleia.regra5_instant_override mantido em 20261015100000.

DROP FUNCTION IF EXISTS public.admin_liquidate_payment(uuid);

CREATE OR REPLACE FUNCTION public.get_desconto_faltas_preview(p_pagamento_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.pagamentos_acordo%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_pagamento_id IS NULL THEN
    RAISE EXCEPTION 'Pagamento é obrigatório.';
  END IF;

  SELECT * INTO v_row
  FROM public.pagamentos_acordo
  WHERE id = p_pagamento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado.';
  END IF;

  IF v_uid IS DISTINCT FROM v_row.passenger_id
    AND v_uid IS DISTINCT FROM v_row.driver_id THEN
    RAISE EXCEPTION 'Sem permissão para ver desconto deste pagamento.';
  END IF;

  RETURN public._desconto_faltas_pagamento(
    v_row.acordo_id,
    v_row.passenger_id,
    v_row.mes_referencia
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_desconto_faltas_preview(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_desconto_faltas_preview(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_desconto_faltas_preview(uuid) TO authenticated;
