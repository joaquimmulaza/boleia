-- Contexto estreito para chips de lugar (anulacao_motivo) — motorista e participantes.

CREATE OR REPLACE FUNCTION public.list_anulacao_motivo_lugar_acordos(p_acordo_ids uuid[])
RETURNS TABLE (
  acordo_id uuid,
  acordo_passageiro_id uuid,
  passenger_id uuid,
  pagamento_estado text,
  anulacao_motivo text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_mes date := date_trunc('month', timezone('Africa/Luanda', now()))::date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_acordo_ids IS NULL OR cardinality(p_acordo_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.id AS acordo_id,
    ap.id AS acordo_passageiro_id,
    ap.passenger_id,
    pg.estado AS pagamento_estado,
    pg.anulacao_motivo
  FROM public.acordos a
  JOIN public.acordos_passageiros ap ON ap.acordo_id = a.id
  LEFT JOIN public.pagamentos_acordo pg
    ON pg.acordo_passageiro_id = ap.id
    AND pg.mes_referencia = v_mes
  WHERE a.id = ANY (p_acordo_ids)
    AND (
      a.driver_id = v_uid
      OR EXISTS (
        SELECT 1 FROM public.acordos_passageiros ap_self
        WHERE ap_self.acordo_id = a.id
          AND ap_self.passenger_id = v_uid
      )
      OR public.is_platform_admin()
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.list_anulacao_motivo_lugar_acordos(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_anulacao_motivo_lugar_acordos(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_anulacao_motivo_lugar_acordos(uuid[]) TO authenticated;
