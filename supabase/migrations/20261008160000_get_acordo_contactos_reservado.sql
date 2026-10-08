-- get_acordo_contactos: passageiro reservado vê detalhe bloqueado (sem 400 P0001)
-- Alinha com terminate_agreement / reject_agreement_termination (activo + reservado).

CREATE OR REPLACE FUNCTION public.get_acordo_contactos(p_acordo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_acordo public.acordos%ROWTYPE;
  v_is_driver boolean;
  v_is_passenger boolean;
  v_my_pagamento public.pagamentos_acordo%ROWTYPE;
  v_motorista jsonb;
  v_passageiros jsonb := '[]'::jsonb;
  v_row record;
  v_bloqueado boolean := true;
  v_mes date := date_trunc('month', timezone('Africa/Luanda', now()))::date;
BEGIN
  IF v_uid IS NULL OR p_acordo_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT * INTO v_acordo FROM public.acordos WHERE id = p_acordo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  v_is_driver := v_uid = v_acordo.driver_id;
  SELECT EXISTS (
    SELECT 1 FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id
      AND ap.passenger_id = v_uid
      AND lower(ap.estado) IN ('activo', 'reservado')
  ) INTO v_is_passenger;

  IF NOT v_is_driver AND NOT v_is_passenger AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Sem permissão para ver contactos deste acordo.';
  END IF;

  IF v_is_passenger THEN
    SELECT * INTO v_my_pagamento
    FROM public.pagamentos_acordo
    WHERE acordo_id = p_acordo_id
      AND passenger_id = v_uid
      AND mes_referencia = v_mes
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND AND lower(v_my_pagamento.estado) IN ('em_custodia', 'liquidado') THEN
      v_bloqueado := false;
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'nome_completo', p.nome_completo,
    'telefone', CASE
      WHEN v_is_passenger AND NOT v_bloqueado THEN p.telefone
      WHEN v_is_driver THEN NULL
      ELSE NULL
    END
  ) INTO v_motorista
  FROM public.perfis p
  WHERE p.id = v_acordo.driver_id;

  FOR v_row IN
    SELECT ap.passenger_id, pf.nome_completo, pf.telefone, pg.estado AS pagamento_estado
    FROM public.acordos_passageiros ap
    JOIN public.perfis pf ON pf.id = ap.passenger_id
    LEFT JOIN public.pagamentos_acordo pg
      ON pg.acordo_passageiro_id = ap.id
      AND pg.mes_referencia = v_mes
    WHERE ap.acordo_id = p_acordo_id
      AND lower(ap.estado) = 'activo'
    ORDER BY ap.ordem_insercao ASC
  LOOP
    v_passageiros := v_passageiros || jsonb_build_array(jsonb_build_object(
      'passenger_id', v_row.passenger_id,
      'nome_completo', v_row.nome_completo,
      'telefone', CASE
        WHEN v_is_driver AND lower(COALESCE(v_row.pagamento_estado, '')) IN ('em_custodia', 'liquidado')
          THEN v_row.telefone
        WHEN v_is_passenger AND v_row.passenger_id = v_uid AND NOT v_bloqueado
          THEN v_row.telefone
        ELSE NULL
      END
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'bloqueado', CASE
      WHEN v_is_passenger THEN v_bloqueado
      WHEN v_is_driver THEN NOT EXISTS (
        SELECT 1 FROM public.pagamentos_acordo pg
        WHERE pg.acordo_id = p_acordo_id
          AND pg.mes_referencia = v_mes
          AND lower(pg.estado) IN ('em_custodia', 'liquidado')
      )
      ELSE false
    END,
    'motivo', CASE
      WHEN v_is_passenger AND v_bloqueado THEN 'Confirma o pagamento e aguarda validação para ver contactos.'
      WHEN v_is_driver AND NOT EXISTS (
        SELECT 1 FROM public.pagamentos_acordo pg
        WHERE pg.acordo_id = p_acordo_id
          AND pg.mes_referencia = v_mes
          AND lower(pg.estado) IN ('em_custodia', 'liquidado')
      ) THEN 'Contactos disponíveis após pagamento em custódia.'
      ELSE NULL
    END,
    'motorista', v_motorista,
    'passageiros', v_passageiros
  );
END;
$function$;
