-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260906004131 rpc_idempotency_wave4_renegotiate_agreement_pricing
-- Do not rename; Supabase Preview CI requires exact version match.

DROP FUNCTION IF EXISTS public.renegotiate_agreement_pricing(uuid, text, integer, integer);

CREATE OR REPLACE FUNCTION public.renegotiate_agreement_pricing(
  p_acordo_id uuid,
  p_modo_preco text,
  p_valor_ask_kz integer,
  p_n_passageiros integer DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_acordo public.acordos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_n_activos integer;
  v_n integer;
  v_total integer;
  v_base integer;
  v_resto integer;
  v_effective date;
  v_previo_quotas jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      RETURN p_acordo_id;
    END IF;
  END IF;

  IF p_modo_preco IS NULL OR p_valor_ask_kz IS NULL THEN
    RAISE EXCEPTION 'modo_preco e valor_ask_kz são obrigatórios.';
  END IF;

  IF p_valor_ask_kz < 0 THEN
    RAISE EXCEPTION 'Valor em Kz deve ser um inteiro não negativo.';
  END IF;

  PERFORM public.apply_due_agreement_adendas(p_acordo_id);

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = p_acordo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  IF lower(v_acordo.estado) <> 'activo' THEN
    RAISE EXCEPTION 'Acordo não está activo.';
  END IF;

  IF v_uid IS DISTINCT FROM v_acordo.driver_id THEN
    RAISE EXCEPTION 'Sem permissão para renegociar este acordo.';
  END IF;

  SELECT COALESCE(COUNT(*), 0)::integer INTO v_n_activos
  FROM public.acordos_passageiros
  WHERE acordo_id = p_acordo_id
    AND estado = 'activo';

  IF v_n_activos < 1 THEN
    RAISE EXCEPTION 'O acordo não tem passageiros activos.';
  END IF;

  v_n := COALESCE(p_n_passageiros, v_n_activos);

  IF v_n <> v_n_activos THEN
    RAISE EXCEPTION
      'n_passageiros (%) deve coincidir com o número de passageiros activos (%).',
      v_n, v_n_activos;
  END IF;

  IF p_modo_preco = 'POR_PASSAGEIRO' THEN
    v_base := p_valor_ask_kz;
    v_total := v_base * v_n;
    v_resto := 0;
  ELSIF p_modo_preco = 'TOTAL_ACORDO' THEN
    v_total := p_valor_ask_kz;
    v_base := v_total / v_n;
    v_resto := v_total % v_n;
  ELSE
    RAISE EXCEPTION 'Modo de preço desconhecido.';
  END IF;

  v_effective := (
    date_trunc('month', timezone('Africa/Luanda', now()))
    + interval '1 month'
  )::date;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'passenger_id', ap.passenger_id,
        'quota_mensal_kz', ap.quota_mensal_kz,
        'estado', ap.estado
      )
      ORDER BY ap.ordem_insercao ASC, ap.passenger_id ASC
    ),
    '[]'::jsonb
  )
  INTO v_previo_quotas
  FROM public.acordos_passageiros ap
  WHERE ap.acordo_id = p_acordo_id;

  UPDATE public.acordos_adendas
  SET superseded_at = now()
  WHERE acordo_id = p_acordo_id
    AND applied_at IS NULL
    AND superseded_at IS NULL;

  INSERT INTO public.acordos_adendas (
    acordo_id,
    effective_from,
    modo_preco,
    n_passageiros_contrato,
    valor_mensal_total_kz,
    valor_mensal_por_passageiro_kz,
    previo_modo_preco,
    previo_n_passageiros_contrato,
    previo_valor_mensal_total_kz,
    previo_valor_mensal_por_passageiro_kz,
    previo_quotas,
    created_by,
    estado
  ) VALUES (
    p_acordo_id,
    v_effective,
    p_modo_preco,
    v_n,
    v_total,
    v_base,
    v_acordo.modo_preco,
    v_acordo.n_passageiros_contrato,
    v_acordo.valor_mensal_total_kz,
    v_acordo.valor_mensal_por_passageiro_kz,
    v_previo_quotas,
    v_uid,
    'pendente_passageiro'
  );

  BEGIN
    INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
    SELECT
      ap.passenger_id,
      'O motorista propôs um novo preço — aceita a adenda em Acordos.',
      'success',
      jsonb_build_object(
        'type', 'agreement_update',
        'acordo_id', p_acordo_id,
        'effective_from', v_effective,
        'adenda_estado', 'pendente_passageiro'
      )
    FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id
      AND ap.estado = 'activo';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Falha ao notificar adenda do acordo %: %', p_acordo_id, SQLERRM;
  END;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'renegotiate_agreement_pricing', p_acordo_id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN p_acordo_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.renegotiate_agreement_pricing(uuid, text, integer, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.renegotiate_agreement_pricing(uuid, text, integer, integer, uuid) TO authenticated;
