-- PACOTE ENG #16 — notificações domínio (pagamento, renovação, liquidação) + deep-links
-- Reutiliza webhook notificacoes → send-push. Metadata sem OD.

-- === Helper: inserir notificação (skip actor, best-effort) ===
CREATE OR REPLACE FUNCTION public.notify_domain_event(
  p_user_id uuid,
  p_mensagem text,
  p_tipo text DEFAULT 'info',
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_actor_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  IF p_actor_id IS NOT NULL AND p_user_id = p_actor_id THEN
    RETURN;
  END IF;

  IF length(trim(COALESCE(p_mensagem, ''))) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
  VALUES (
    p_user_id,
    p_mensagem,
    COALESCE(NULLIF(trim(p_tipo), ''), 'info'),
    COALESCE(p_metadata, '{}'::jsonb)
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'notify_domain_event falhou user=% type=%: %',
      p_user_id, p_metadata->>'type', SQLERRM;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_domain_event(uuid, text, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_domain_event(uuid, text, text, jsonb, uuid) TO authenticated;

-- === Helper: avisar renovação quando todos pagamentos do mês corrente estão OK ===
CREATE OR REPLACE FUNCTION public._maybe_notify_renewal_available(p_acordo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_acordo public.acordos%ROWTYPE;
  v_mes date := date_trunc('month', timezone('Africa/Luanda', now()))::date;
  v_proximo_mes date := (date_trunc('month', timezone('Africa/Luanda', now())) + interval '1 month')::date;
  v_total_activos integer := 0;
  v_pagos_ok integer := 0;
  r record;
BEGIN
  IF p_acordo_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = p_acordo_id;

  IF NOT FOUND OR lower(v_acordo.estado) <> 'activo' THEN
    RETURN;
  END IF;

  IF lower(COALESCE(v_acordo.renovacao_estado, '')) IN ('renovado', 'nao_renovar') THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pagamentos_acordo pg
    WHERE pg.acordo_id = p_acordo_id
      AND pg.mes_referencia = v_proximo_mes
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_total_activos
  FROM public.acordos_passageiros ap
  WHERE ap.acordo_id = p_acordo_id
    AND lower(ap.estado) = 'activo';

  IF v_total_activos = 0 THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_pagos_ok
  FROM public.pagamentos_acordo pg
  JOIN public.acordos_passageiros ap
    ON ap.id = pg.acordo_passageiro_id
   AND lower(ap.estado) = 'activo'
  WHERE pg.acordo_id = p_acordo_id
    AND pg.mes_referencia = v_mes
    AND lower(pg.estado) IN ('em_custodia', 'liquidado');

  IF v_pagos_ok < v_total_activos THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT v_acordo.driver_id AS user_id
    UNION
    SELECT ap.passenger_id AS user_id
    FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id
      AND lower(ap.estado) = 'activo'
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.notificacoes n
      WHERE n.user_id = r.user_id
        AND n.metadata->>'type' = 'renewal_available'
        AND n.metadata->>'acordo_id' = p_acordo_id::text
        AND n.created_at > now() - interval '7 days'
    ) THEN
      PERFORM public.notify_domain_event(
        r.user_id,
        'Renovação disponível — confirma o próximo período em Acordos.',
        'info',
        jsonb_build_object(
          'type', 'renewal_available',
          'acordo_id', p_acordo_id,
          'mes_referencia', v_proximo_mes
        )
      );
    END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public._maybe_notify_renewal_available(uuid) FROM PUBLIC;

-- === Trigger: pagamentos → notificações domínio ===
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

    IF lower(NEW.estado) = 'em_custodia' THEN
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

DROP TRIGGER IF EXISTS pagamentos_acordo_notify ON public.pagamentos_acordo;

CREATE TRIGGER pagamentos_acordo_notify
  AFTER INSERT OR UPDATE OF estado ON public.pagamentos_acordo
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_pagamentos_acordo_notify();
