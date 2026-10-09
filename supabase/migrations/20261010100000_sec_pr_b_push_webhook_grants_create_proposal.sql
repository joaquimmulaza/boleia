-- Security PR B: webhook push secret, revoke anon push_subscriptions, create_proposal grupo guard

-- =============================================================================
-- push_subscriptions — fechar anon/PUBLIC (prova 42501 em INSERT directo)
-- =============================================================================
REVOKE ALL ON TABLE public.push_subscriptions FROM anon, PUBLIC;

GRANT INSERT (user_id, subscription) ON TABLE public.push_subscriptions TO authenticated;
GRANT DELETE ON TABLE public.push_subscriptions TO authenticated;
GRANT SELECT ON TABLE public.push_subscriptions TO authenticated;

-- =============================================================================
-- handle_new_notification_push — Vault secret + header (tolerante a secret em falta)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'vault', 'extensions'
AS $function$
DECLARE
  v_push_secret text;
  v_headers jsonb;
BEGIN
  SELECT ds.decrypted_secret
  INTO v_push_secret
  FROM vault.decrypted_secrets AS ds
  WHERE ds.name = 'push_webhook_secret'
  LIMIT 1;

  IF v_push_secret IS NULL OR length(trim(v_push_secret)) = 0 THEN
    RAISE LOG 'handle_new_notification_push: push_webhook_secret em falta — send-push legado (sem header secret)';
    v_headers := jsonb_build_object('Content-Type', 'application/json');
  ELSE
    v_headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-boleia-push-secret', v_push_secret
    );
  END IF;

  PERFORM net.http_post(
    url := 'https://fdclrbcgytnuqcrpsevw.supabase.co/functions/v1/send-push',
    headers := v_headers,
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', row_to_json(NEW),
      'old_record', NULL
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_notification_push: erro ao invocar send-push (%) — notificação mantida', SQLERRM;
    RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_notification_push() FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- create_proposal — validar grupo da procura e N vs membros activos
-- (corpo base: 20260929233345_pacote_eng29_proposta_idempotency.sql)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_proposal(
  p_oferta_id uuid,
  p_procura_id uuid,
  p_grupo_id uuid,
  p_modo_preco text,
  p_valor_mensal_ask_kz integer,
  p_n_passageiros_propostos integer
)
RETURNS public.propostas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_existing public.propostas%ROWTYPE;
  v_oferta public.ofertas_capacidade%ROWTYPE;
  v_procura public.procuras%ROWTYPE;
  v_n_membros_activos integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_n_passageiros_propostos IS NULL OR p_n_passageiros_propostos < 1 THEN
    RAISE EXCEPTION 'Número de passageiros inválido.';
  END IF;

  IF p_n_passageiros_propostos > 1 AND p_grupo_id IS NULL THEN
    RAISE EXCEPTION 'Para propor com mais de uma pessoa é necessário um grupo ligado à procura.';
  END IF;

  IF p_modo_preco NOT IN ('POR_PASSAGEIRO', 'TOTAL_ACORDO') THEN
    RAISE EXCEPTION 'Modo de preço inválido.';
  END IF;

  IF p_valor_mensal_ask_kz IS NULL OR p_valor_mensal_ask_kz < 0 THEN
    RAISE EXCEPTION 'Valor mensal em Kz inválido.';
  END IF;

  SELECT * INTO v_oferta FROM public.ofertas_capacidade WHERE id = p_oferta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta não encontrada.';
  END IF;

  SELECT * INTO v_procura FROM public.procuras WHERE id = p_procura_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Procura não encontrada.';
  END IF;

  IF v_uid IS DISTINCT FROM v_oferta.driver_id AND v_uid IS DISTINCT FROM v_procura.owner_id THEN
    RAISE EXCEPTION 'Sem permissão para propor neste par oferta/procura.';
  END IF;

  IF p_grupo_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.grupos g
      WHERE g.id = p_grupo_id
        AND g.procura_id = p_procura_id
    ) THEN
      RAISE EXCEPTION 'Grupo não pertence a esta procura.';
    END IF;

    IF v_uid = v_procura.owner_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.membros_grupo mg
        WHERE mg.grupo_id = p_grupo_id
          AND mg.passenger_id = v_uid
          AND mg.estado = 'activo'
      )
    THEN
      RAISE EXCEPTION 'Tem de ser membro activo do grupo para propor com este grupo.';
    END IF;

    SELECT COUNT(*)::integer
    INTO v_n_membros_activos
    FROM public.membros_grupo mg
    WHERE mg.grupo_id = p_grupo_id
      AND mg.estado = 'activo';

    IF p_n_passageiros_propostos > v_n_membros_activos THEN
      RAISE EXCEPTION 'Número de passageiros propostos excede os membros activos do grupo.';
    END IF;
  END IF;

  SELECT * INTO v_existing
  FROM public.propostas
  WHERE oferta_id = p_oferta_id
    AND procura_id = p_procura_id
    AND created_by = v_uid
    AND estado = 'aberta'
  LIMIT 1;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  BEGIN
    INSERT INTO public.propostas (
      oferta_id,
      procura_id,
      grupo_id,
      modo_preco,
      valor_mensal_ask_kz,
      n_passageiros_propostos,
      estado,
      created_by
    )
    VALUES (
      p_oferta_id,
      p_procura_id,
      p_grupo_id,
      p_modo_preco,
      p_valor_mensal_ask_kz,
      p_n_passageiros_propostos,
      'aberta',
      v_uid
    )
    RETURNING * INTO v_existing;

    RETURN v_existing;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT * INTO v_existing
      FROM public.propostas
      WHERE oferta_id = p_oferta_id
        AND procura_id = p_procura_id
        AND created_by = v_uid
        AND estado = 'aberta'
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE;
      END IF;

      RETURN v_existing;
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_proposal(uuid, uuid, uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_proposal(uuid, uuid, uuid, text, integer, integer) TO authenticated;
