-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260905113523 adenda_effective_from_next_month
-- Do not rename; Supabase Preview CI requires exact version match.

-- Adenda temporal: effective_from = 1.º dia do mês seguinte (Africa/Luanda).
-- Não muta preços/quotas live no mês corrente; preserva contrato original em previo_*.

CREATE TABLE IF NOT EXISTS public.acordos_adendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acordo_id uuid NOT NULL REFERENCES public.acordos(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  modo_preco text NOT NULL,
  n_passageiros_contrato integer NOT NULL CHECK (n_passageiros_contrato >= 1),
  valor_mensal_total_kz integer NOT NULL CHECK (valor_mensal_total_kz >= 0),
  valor_mensal_por_passageiro_kz integer NOT NULL CHECK (valor_mensal_por_passageiro_kz >= 0),
  previo_modo_preco text NOT NULL,
  previo_n_passageiros_contrato integer NOT NULL,
  previo_valor_mensal_total_kz integer NOT NULL,
  previo_valor_mensal_por_passageiro_kz integer NOT NULL,
  previo_quotas jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz NULL,
  superseded_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS acordos_adendas_acordo_id_idx
  ON public.acordos_adendas (acordo_id);

CREATE INDEX IF NOT EXISTS acordos_adendas_pending_due_idx
  ON public.acordos_adendas (effective_from)
  WHERE applied_at IS NULL AND superseded_at IS NULL;

-- Uma adenda pendente activa por acordo
CREATE UNIQUE INDEX IF NOT EXISTS acordos_adendas_one_pending_per_acordo
  ON public.acordos_adendas (acordo_id)
  WHERE applied_at IS NULL AND superseded_at IS NULL;

ALTER TABLE public.acordos_adendas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS acordos_adendas_select_envolvidos ON public.acordos_adendas;
CREATE POLICY acordos_adendas_select_envolvidos
  ON public.acordos_adendas
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.acordos a
      WHERE a.id = acordos_adendas.acordo_id
        AND (
          a.driver_id = auth.uid()
          OR public.is_acordo_passenger(a.id)
        )
    )
  );

REVOKE ALL ON public.acordos_adendas FROM anon;
GRANT SELECT ON public.acordos_adendas TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.acordos_adendas FROM authenticated;

-- Aplica adendas cujo effective_from já chegou (lazy apply; leave NÃO recalcula).
CREATE OR REPLACE FUNCTION public.apply_due_agreement_adendas(
  p_acordo_id uuid DEFAULT NULL
)
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

REVOKE ALL ON FUNCTION public.apply_due_agreement_adendas(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_due_agreement_adendas(uuid) TO authenticated;

-- Adenda: agenda para o mês seguinte; NÃO muta live no mês corrente.
CREATE OR REPLACE FUNCTION public.renegotiate_agreement_pricing(
  p_acordo_id uuid,
  p_modo_preco text,
  p_valor_ask_kz integer,
  p_n_passageiros integer DEFAULT NULL
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

  -- Aplicar adendas já devidas antes de agendar nova (lazy apply).
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

  -- 1.º dia do mês seguinte em Africa/Luanda
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

  -- Substituir adenda pendente futura (se existir)
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
    created_by
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
    v_uid
  );

  -- Live NÃO é mutado — mês corrente mantém quotas congeladas.

  BEGIN
    INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
    SELECT
      ap.passenger_id,
      'Novo preço do acordo agendado para o próximo mês (adenda).',
      'success',
      jsonb_build_object(
        'type', 'agreement_update',
        'acordo_id', p_acordo_id,
        'effective_from', v_effective
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

REVOKE ALL ON FUNCTION public.renegotiate_agreement_pricing(uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.renegotiate_agreement_pricing(uuid, text, integer, integer) TO authenticated;
