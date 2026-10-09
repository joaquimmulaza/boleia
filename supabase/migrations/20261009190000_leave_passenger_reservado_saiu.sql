-- Saída voluntária com lugar reservado: estado saiu (não expirado TTL).
-- Anulação de pagamento mantém motivo «Saíste antes da activação do lugar».

CREATE OR REPLACE FUNCTION public.leave_passenger(
  p_acordo_id uuid,
  p_passenger_id uuid DEFAULT NULL::uuid,
  p_idempotency_key uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_target uuid;
  v_acordo public.acordos%ROWTYPE;
  v_row public.acordos_passageiros%ROWTYPE;
  v_hoje date := (timezone('Africa/Luanda', now()))::date;
  v_estado_antes text;
  v_pg_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_acordo_id IS NULL THEN
    RAISE EXCEPTION 'acordo_id é obrigatório.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      RETURN p_acordo_id;
    END IF;
  END IF;

  v_target := COALESCE(p_passenger_id, v_uid);

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = p_acordo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  IF v_uid IS DISTINCT FROM v_target AND v_uid IS DISTINCT FROM v_acordo.driver_id THEN
    RAISE EXCEPTION 'Sem permissão para sair deste acordo.';
  END IF;

  SELECT * INTO v_row
  FROM public.acordos_passageiros
  WHERE acordo_id = p_acordo_id
    AND passenger_id = v_target
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Passageiro não pertence a este acordo.';
  END IF;

  IF lower(v_row.estado) NOT IN ('activo', 'reservado') THEN
    RAISE EXCEPTION 'Passageiro não está activo neste acordo.';
  END IF;

  v_estado_antes := lower(v_row.estado);

  IF v_estado_antes = 'reservado' THEN
    UPDATE public.acordos_passageiros
    SET
      estado = 'saiu',
      reservado_expira_em = NULL
    WHERE id = v_row.id
      AND lower(estado) = 'reservado';

    SELECT id INTO v_pg_id
    FROM public.pagamentos_acordo
    WHERE acordo_passageiro_id = v_row.id
      AND mes_referencia = date_trunc('month', timezone('Africa/Luanda', now()))::date
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_pg_id IS NOT NULL THEN
      PERFORM public._anular_pagamento_sem_divida(
        v_pg_id,
        'Saíste antes da activação do lugar'
      );
    END IF;
  ELSE
    UPDATE public.acordos_passageiros SET estado = 'saiu' WHERE id = v_row.id;
    PERFORM public.ajustar_obrigacao_pagamento_mes(v_row.id, v_hoje, false);
  END IF;

  PERFORM public._maybe_fechar_acordo_sem_lugares_vivos(p_acordo_id);
  PERFORM public.recount_oferta_vagas(v_acordo.oferta_id);

  BEGIN
    PERFORM public.promote_waitlist(v_acordo.oferta_id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Falha best-effort promote_waitlist na saída do acordo %: %',
        p_acordo_id, SQLERRM;
  END;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'leave_passenger', p_acordo_id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN p_acordo_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.leave_passenger(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_passenger(uuid, uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.leave_passenger(uuid, uuid, uuid) FROM anon;
