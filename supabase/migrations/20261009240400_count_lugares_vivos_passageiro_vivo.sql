-- RPC contagem: só passageiro com lugar vivo (activo|reservado); devolve inteiro, sem PII.

CREATE OR REPLACE FUNCTION public.count_lugares_vivos_acordo(p_acordo_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_acordo public.acordos%ROWTYPE;
  v_is_live_passenger boolean;
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_acordo_id IS NULL THEN
    RAISE EXCEPTION 'acordo_id é obrigatório.';
  END IF;

  SELECT * INTO v_acordo FROM public.acordos WHERE id = p_acordo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id
      AND ap.passenger_id = v_uid
      AND lower(ap.estado) IN ('activo', 'reservado')
  ) INTO v_is_live_passenger;

  IF NOT v_is_live_passenger THEN
    RAISE EXCEPTION 'Sem permissão para contar lugares deste acordo.';
  END IF;

  SELECT COUNT(*)::integer INTO v_count
  FROM public.acordos_passageiros ap
  WHERE ap.acordo_id = p_acordo_id
    AND lower(ap.estado) IN ('activo', 'reservado');

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.count_lugares_vivos_acordo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_lugares_vivos_acordo(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.count_lugares_vivos_acordo(uuid) FROM anon;
