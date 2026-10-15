-- v1.15: anulação de pagamento — não manter «Pagamento mensal disponível…» no sino (sem push novo).
-- Base _anular_pagamento_sem_divida: 20261009180000_p0_acordo_pagamento_estados.sql
-- Base trg_pagamentos_acordo_notify: 20260907151936_pacote_eng16_domain_notifications.sql

CREATE OR REPLACE FUNCTION public._purge_pagamento_mensal_disponivel_notif(
  p_passenger_id uuid,
  p_pagamento_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_passenger_id IS NULL OR p_pagamento_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.notificacoes
  WHERE user_id = p_passenger_id
    AND mensagem = 'Pagamento mensal disponível — envia o comprovativo em Acordos.'
    AND lower(COALESCE(metadata->>'type', '')) = 'payment_update'
    AND (metadata->>'pagamento_id')::uuid = p_pagamento_id;
END;
$function$;

REVOKE ALL ON FUNCTION public._purge_pagamento_mensal_disponivel_notif(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._purge_pagamento_mensal_disponivel_notif(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._purge_pagamento_mensal_disponivel_notif(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._anular_pagamento_sem_divida(
  p_pagamento_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_passenger_id uuid;
BEGIN
  UPDATE public.pagamentos_acordo
  SET
    estado = 'anulado',
    anulado_em = now(),
    anulacao_motivo = NULLIF(left(btrim(COALESCE(p_motivo, '')), 60), ''),
    valor_kz = COALESCE(valor_quota_original_kz, valor_kz),
    valor_devido_kz = 0,
    updated_at = now()
  WHERE id = p_pagamento_id
    AND lower(estado) IN ('pendente_pagamento', 'comprovativo_enviado')
  RETURNING passenger_id INTO v_passenger_id;

  IF FOUND AND v_passenger_id IS NOT NULL THEN
    PERFORM public._purge_pagamento_mensal_disponivel_notif(v_passenger_id, p_pagamento_id);
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._anular_pagamento_sem_divida(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._anular_pagamento_sem_divida(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._anular_pagamento_sem_divida(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_pagamentos_acordo_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_meta jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF lower(COALESCE(NEW.estado, '')) <> 'anulado' THEN
      v_meta := jsonb_build_object(
        'type', 'payment_update',
        'acordo_id', NEW.acordo_id,
        'pagamento_id', NEW.id,
        'estado', NEW.estado,
        'mes_referencia', NEW.mes_referencia
      );

      PERFORM public.notify_domain_event(
        NEW.passenger_id,
        'Pagamento mensal disponível — envia o comprovativo em Acordos.',
        'info',
        v_meta
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    v_meta := jsonb_build_object(
      'type', 'payment_update',
      'acordo_id', NEW.acordo_id,
      'pagamento_id', NEW.id,
      'estado', NEW.estado,
      'mes_referencia', NEW.mes_referencia
    );

    IF lower(NEW.estado) = 'anulado'
       AND lower(COALESCE(OLD.estado, '')) <> 'anulado' THEN
      PERFORM public._purge_pagamento_mensal_disponivel_notif(NEW.passenger_id, NEW.id);
    ELSIF lower(NEW.estado) = 'em_custodia' THEN
      PERFORM public.notify_domain_event(
        NEW.passenger_id,
        'Pagamento validado — em custódia. Já podes ver os contactos.',
        'success',
        v_meta
      );

      PERFORM public.notify_domain_event(
        NEW.driver_id,
        'Pagamento de passageiro validado em custódia.',
        'info',
        v_meta
      );

      PERFORM public._maybe_notify_renewal_available(NEW.acordo_id);
    ELSIF lower(NEW.estado) = 'pendente_pagamento'
      AND lower(COALESCE(OLD.estado, '')) = 'comprovativo_enviado' THEN
      PERFORM public.notify_domain_event(
        NEW.passenger_id,
        'Comprovativo rejeitado — envia novamente em Acordos.',
        'warning',
        v_meta
      );
    ELSIF lower(NEW.estado) = 'liquidado'
      AND lower(COALESCE(OLD.estado, '')) = 'em_custodia' THEN
      PERFORM public.notify_domain_event(
        NEW.driver_id,
        'Pagamento liquidado — repasse registado.',
        'success',
        jsonb_build_object(
          'type', 'payout_liquidated',
          'acordo_id', NEW.acordo_id,
          'pagamento_id', NEW.id,
          'mes_referencia', NEW.mes_referencia
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
