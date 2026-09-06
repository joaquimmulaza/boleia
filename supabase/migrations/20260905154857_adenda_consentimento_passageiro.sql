-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260905154857 adenda_consentimento_passageiro
-- Do not rename; Supabase Preview CI requires exact version match.

-- R3: consentimento do passageiro antes da adenda ficar aceite/agendada para apply

ALTER TABLE public.acordos_adendas
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'pendente_passageiro',
  ADD COLUMN IF NOT EXISTS aceite_em timestamptz,
  ADD COLUMN IF NOT EXISTS aceite_por uuid;

-- Adendas já existentes (modelo anterior sem consentimento) ficam 'aceite'
UPDATE public.acordos_adendas
SET estado = 'aceite'
WHERE estado = 'pendente_passageiro'
  AND aceite_em IS NULL
  AND created_at < now();

-- Garantir constraint (drop se re-aplicar)
ALTER TABLE public.acordos_adendas
  DROP CONSTRAINT IF EXISTS acordos_adendas_estado_check;

ALTER TABLE public.acordos_adendas
  ADD CONSTRAINT acordos_adendas_estado_check
  CHECK (estado IN ('pendente_passageiro', 'aceite'));

COMMENT ON COLUMN public.acordos_adendas.estado IS
  'pendente_passageiro = aguarda aceitação; aceite = consentida (apply só após effective_from)';

-- apply_due: só adendas já aceites pelo passageiro
CREATE OR REPLACE FUNCTION public.apply_due_agreement_adendas(p_acordo_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (timezone('Africa/Luanda', now()))::date;
  v_adenda public.acordos_adendas%ROWTYPE;
  v_base integer;
  v_resto integer;
  v_quota integer;
  r record;
  i integer;
  v_applied integer := 0;
BEGIN
  FOR v_adenda IN
    SELECT *
    FROM public.acordos_adendas
    WHERE applied_at IS NULL
      AND superseded_at IS NULL
      AND estado = 'aceite'
      AND effective_from <= v_today
      AND (p_acordo_id IS NULL OR acordo_id = p_acordo_id)
    ORDER BY effective_from ASC, created_at ASC
    FOR UPDATE
  LOOP
    UPDATE public.acordos
    SET
      modo_preco = v_adenda.modo_preco,
      n_passageiros_contrato = v_adenda.n_passageiros_contrato,
      valor_mensal_total_kz = v_adenda.valor_mensal_total_kz,
      valor_mensal_por_passageiro_kz = v_adenda.valor_mensal_por_passageiro_kz
    WHERE id = v_adenda.acordo_id;

    IF v_adenda.modo_preco = 'POR_PASSAGEIRO' THEN
      v_base := v_adenda.valor_mensal_por_passageiro_kz;
      v_resto := 0;
    ELSE
      v_base := v_adenda.valor_mensal_por_passageiro_kz;
      v_resto := v_adenda.valor_mensal_total_kz
        - (v_base * v_adenda.n_passageiros_contrato);
      IF v_resto < 0 THEN
        v_resto := 0;
      END IF;
    END IF;

    i := 0;
    FOR r IN
      SELECT id
      FROM public.acordos_passageiros
      WHERE acordo_id = v_adenda.acordo_id
        AND estado = 'activo'
      ORDER BY ordem_insercao ASC, passenger_id ASC
    LOOP
      IF v_adenda.modo_preco = 'POR_PASSAGEIRO' THEN
        v_quota := v_base;
      ELSE
        v_quota := CASE WHEN i < v_resto THEN v_base + 1 ELSE v_base END;
      END IF;

      UPDATE public.acordos_passageiros
      SET quota_mensal_kz = v_quota
      WHERE id = r.id;

      i := i + 1;
    END LOOP;

    UPDATE public.acordos_adendas
    SET applied_at = now()
    WHERE id = v_adenda.id;

    v_applied := v_applied + 1;
  END LOOP;

  RETURN v_applied;
END;
$function$;

-- renegotiate: agenda adenda em pendente_passageiro (sem mutar live)
CREATE OR REPLACE FUNCTION public.renegotiate_agreement_pricing(
  p_acordo_id uuid,
  p_modo_preco text,
  p_valor_ask_kz integer,
  p_n_passageiros integer DEFAULT NULL::integer
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

  RETURN p_acordo_id;
END;
$function$;

-- Aceitar adenda: só passageiro activo (não o motorista criador)
CREATE OR REPLACE FUNCTION public.accept_agreement_adenda(p_adenda_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_adenda public.acordos_adendas%ROWTYPE;
  v_acordo public.acordos%ROWTYPE;
  v_is_pax boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_adenda_id IS NULL THEN
    RAISE EXCEPTION 'ID da adenda é obrigatório.';
  END IF;

  SELECT * INTO v_adenda
  FROM public.acordos_adendas
  WHERE id = p_adenda_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Adenda não encontrada.';
  END IF;

  IF v_adenda.superseded_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta adenda já foi substituída.';
  END IF;

  IF v_adenda.applied_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta adenda já foi aplicada.';
  END IF;

  IF v_adenda.estado = 'aceite' THEN
    RETURN v_adenda.id;
  END IF;

  IF v_adenda.estado IS DISTINCT FROM 'pendente_passageiro' THEN
    RAISE EXCEPTION 'Adenda não está pendente de aceitação.';
  END IF;

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = v_adenda.acordo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  IF lower(v_acordo.estado) <> 'activo' THEN
    RAISE EXCEPTION 'Acordo não está activo.';
  END IF;

  -- Motorista criador NÃO pode aceitar
  IF v_uid = v_acordo.driver_id OR v_uid = v_adenda.created_by THEN
    RAISE EXCEPTION 'Apenas um passageiro activo do acordo pode aceitar a adenda.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = v_adenda.acordo_id
      AND ap.passenger_id = v_uid
      AND ap.estado = 'activo'
  ) INTO v_is_pax;

  IF NOT v_is_pax THEN
    RAISE EXCEPTION 'Apenas um passageiro activo do acordo pode aceitar a adenda.';
  END IF;

  UPDATE public.acordos_adendas
  SET
    estado = 'aceite',
    aceite_em = now(),
    aceite_por = v_uid
  WHERE id = v_adenda.id;

  -- Não aplica preços antes de effective_from; lazy apply trata disso.
  PERFORM public.apply_due_agreement_adendas(v_adenda.acordo_id);

  BEGIN
    INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
    VALUES (
      v_acordo.driver_id,
      'Um passageiro aceitou a adenda de preço do acordo.',
      'success',
      jsonb_build_object(
        'type', 'agreement_update',
        'acordo_id', v_adenda.acordo_id,
        'adenda_id', v_adenda.id,
        'adenda_estado', 'aceite'
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Falha ao notificar aceite de adenda %: %', v_adenda.id, SQLERRM;
  END;

  RETURN v_adenda.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_agreement_adenda(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_agreement_adenda(uuid) TO authenticated;
