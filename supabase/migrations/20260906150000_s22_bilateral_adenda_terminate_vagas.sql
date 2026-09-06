-- Epic §22 — Ciclo de Vida Pós-Acordo (Tasks 1a + 2a + 3)
-- Spec: .specs/features/acordo-pos-acordo-s22/{spec,design,tasks}.md
--
-- 1a) Adenda bilateral: motorista OU passageiro activo propõe;
--     estado inicial derivado do iniciador; alias propose_agreement_adenda;
--     accept bilateral (created_by nunca decide); reject com p_idempotency_key.
-- 2a) Rescisão: colunas rescisao_* em acordos, terminate_agreement (3 modos),
--     apply_due_agreement_terminations (lazy dia 1).
-- 3)  Hardening: trigger BEFORE UPDATE em ofertas_capacidade recalcula
--     vagas_disponiveis no servidor (UPDATE mentiroso do cliente não persiste).
--
-- Decisão A1 (Orquestrador, 2026-09-06): o pro-rata de quotas é uma EXCEPÇÃO
-- explícita à regra de quotas congeladas (AGENTS §7) e aplica-se APENAS ao modo
-- justa_causa. Saída normal / leave_passenger / aviso_previo / consensual não
-- recalculam quotas.
-- Decisão A2: não existe helper SQL de dias úteis no remoto — o cálculo vive
-- dentro de terminate_agreement, espelhando src/utils/faltaDesconto.js
-- (unidade diária = quota / acordos.dias_uteis_mes).
-- Decisão A5: uma única confirmação da contraparte (motorista ↔ qualquer
-- passageiro activo) basta para cancelar o acordo consensual de todos os N.
--
-- Aplicado remotamente via Supabase MCP (apply_migration) no projecto
-- boleia (fdclrbcgytnuqcrpsevw) em 2026-09-06, em 7 versões:
--   s22_acordos_rescisao_columns_and_estado_check
--   s22_recalc_vagas_disponiveis_trigger
--   s22_bilateral_adenda_propose
--   s22_bilateral_adenda_accept_reject
--   s22_apply_due_adendas_guard_and_terminations
--   s22_terminate_agreement
--   s22_grants_hardening_revoke_anon
-- Follow-up de grants (2026-09-06, code-reviewer REJECT):
--   supabase/migrations/20260906160000_s22_rpc_grants_hardening.sql
--   MCP: s22_rpc_grants_hardening
--   — REVOKE anon nas 4 RPCs de adenda; guard auth.uid() nas apply_due_*;
--     recount_oferta_vagas sem EXECUTE para clientes.
-- Fonte canónica local = este ficheiro + o follow-up 20260906160000.

-- =============================================================================
-- Task 2a.1 — Colunas de auditoria de rescisão + estados do acordo
-- =============================================================================

ALTER TABLE public.acordos
  ADD COLUMN IF NOT EXISTS rescisao_modo text,
  ADD COLUMN IF NOT EXISTS rescisao_solicitada_por uuid,
  ADD COLUMN IF NOT EXISTS rescisao_justificativa text,
  ADD COLUMN IF NOT EXISTS rescisao_effective_on date,
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'acordos_rescisao_solicitada_por_fkey'
      AND conrelid = 'public.acordos'::regclass
  ) THEN
    ALTER TABLE public.acordos
      ADD CONSTRAINT acordos_rescisao_solicitada_por_fkey
      FOREIGN KEY (rescisao_solicitada_por)
      REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END;
$$;

ALTER TABLE public.acordos
  DROP CONSTRAINT IF EXISTS acordos_rescisao_modo_check;

ALTER TABLE public.acordos
  ADD CONSTRAINT acordos_rescisao_modo_check
  CHECK (
    rescisao_modo IS NULL
    OR lower(rescisao_modo) = ANY (
      ARRAY['aviso_previo'::text, 'consensual'::text, 'justa_causa'::text]
    )
  );

-- Estados legados confirmados no remoto: activo | suspenso | cancelado | expirado
-- (SELECT estado, count(*) FROM acordos → só 'activo' em dados reais).
ALTER TABLE public.acordos
  DROP CONSTRAINT IF EXISTS acordos_estado_check;

ALTER TABLE public.acordos
  ADD CONSTRAINT acordos_estado_check
  CHECK (
    estado = ANY (
      ARRAY[
        'activo'::text,
        'suspenso'::text,
        'cancelamento_pendente'::text,
        'cancelado'::text,
        'cancelado_justificado'::text,
        'expirado'::text
      ]
    )
  );

CREATE INDEX IF NOT EXISTS idx_acordos_rescisao_pendente
  ON public.acordos (rescisao_effective_on)
  WHERE estado = 'cancelamento_pendente';

-- =============================================================================
-- Task 3 — Hardening de capacidade: vagas_disponiveis calculada no servidor
-- =============================================================================
-- Fórmula alinhada com accept_proposal (S22-CAP-04 / risco A6):
--   ocupadas = passageiros 'activo' em acordos 'activo' OU 'cancelamento_pendente'
--   vagas_disponiveis = vagas_totais - ocupadas
-- accept_proposal insere os acordos_passageiros ANTES do UPDATE da oferta, pelo
-- que o valor recalculado pelo trigger coincide com o que a RPC escreve.

CREATE OR REPLACE FUNCTION public.oferta_ocupacao(p_oferta_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(COUNT(*), 0)::integer
  FROM public.acordos_passageiros ap
  JOIN public.acordos a ON a.id = ap.acordo_id
  WHERE a.oferta_id = p_oferta_id
    AND lower(a.estado) IN ('activo', 'cancelamento_pendente')
    AND lower(ap.estado) = 'activo';
$function$;

REVOKE ALL ON FUNCTION public.oferta_ocupacao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.oferta_ocupacao(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.recalc_vagas_disponiveis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ocupadas integer;
  v_disponiveis integer;
BEGIN
  v_ocupadas := public.oferta_ocupacao(NEW.id);
  v_disponiveis := NEW.vagas_totais - v_ocupadas;

  IF v_disponiveis < 0 THEN
    RAISE EXCEPTION
      'Capacidade inconsistente: a oferta já tem mais passageiros (%) do que lugares (%).',
      v_ocupadas, NEW.vagas_totais;
  END IF;

  -- Valor enviado pelo cliente é ignorado: só o cálculo do servidor persiste.
  NEW.vagas_disponiveis := v_disponiveis;

  -- 'inactiva' é uma decisão do motorista e não deriva da ocupação.
  IF lower(COALESCE(NEW.estado, '')) <> 'inactiva' THEN
    NEW.estado := CASE
      WHEN v_disponiveis = 0 THEN 'cheia'
      WHEN v_disponiveis < NEW.vagas_totais THEN 'parcial'
      ELSE 'disponivel'
    END;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ofertas_recalc_vagas ON public.ofertas_capacidade;

CREATE TRIGGER trg_ofertas_recalc_vagas
  BEFORE UPDATE ON public.ofertas_capacidade
  FOR EACH ROW
  EXECUTE FUNCTION public.recalc_vagas_disponiveis();

-- Helper interno: força a recontagem via trigger depois de mutar acordos.
CREATE OR REPLACE FUNCTION public.recount_oferta_vagas(p_oferta_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_disponiveis integer;
BEGIN
  IF p_oferta_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.ofertas_capacidade
  SET updated_at = now()
  WHERE id = p_oferta_id
  RETURNING vagas_disponiveis INTO v_disponiveis;

  RETURN v_disponiveis;
END;
$function$;

REVOKE ALL ON FUNCTION public.recount_oferta_vagas(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recount_oferta_vagas(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.recount_oferta_vagas(uuid) FROM authenticated;
-- Sem GRANT a clientes: só owner / SECURITY DEFINER internas (terminate, apply_due).

-- =============================================================================
-- Task 1a.1 — renegotiate_agreement_pricing bilateral
-- =============================================================================

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
  v_is_driver boolean;
  v_is_pax boolean;
  v_estado_inicial text;
  v_n_activos integer;
  v_n integer;
  v_total integer;
  v_base integer;
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

  -- S22-AD-01/02: adenda bilateral — driver OU passageiro activo propõe.
  v_is_driver := (v_uid = v_acordo.driver_id);

  SELECT EXISTS (
    SELECT 1
    FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id
      AND ap.passenger_id = v_uid
      AND lower(ap.estado) = 'activo'
  ) INTO v_is_pax;

  IF NOT v_is_driver AND NOT v_is_pax THEN
    RAISE EXCEPTION 'Sem permissão para renegociar este acordo.';
  END IF;

  v_estado_inicial := CASE
    WHEN v_is_driver THEN 'pendente_passageiro'
    ELSE 'pendente_contraparte'
  END;

  SELECT COALESCE(COUNT(*), 0)::integer INTO v_n_activos
  FROM public.acordos_passageiros
  WHERE acordo_id = p_acordo_id
    AND lower(estado) = 'activo';

  IF v_n_activos < 1 THEN
    RAISE EXCEPTION 'O acordo não tem passageiros activos.';
  END IF;

  -- S22-AD-03: divisor congelado — sempre N_contrato, nunca N_activos.
  v_n := v_acordo.n_passageiros_contrato;

  IF v_n IS NULL OR v_n < 1 THEN
    RAISE EXCEPTION 'N_contrato inválido neste acordo.';
  END IF;

  IF p_n_passageiros IS NOT NULL AND p_n_passageiros IS DISTINCT FROM v_n THEN
    RAISE EXCEPTION
      'n_passageiros (%) deve coincidir com N_contrato (%); sem recálculo retroactivo.',
      p_n_passageiros, v_n;
  END IF;

  IF p_modo_preco = 'POR_PASSAGEIRO' THEN
    v_base := p_valor_ask_kz;
    v_total := v_base * v_n;
  ELSIF p_modo_preco = 'TOTAL_ACORDO' THEN
    v_total := p_valor_ask_kz;
    v_base := v_total / v_n;
  ELSE
    RAISE EXCEPTION 'Modo de preço desconhecido.';
  END IF;

  -- S22-AD-04: efeito só no 1.º dia do mês seguinte (Africa/Luanda).
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

  -- S22-AD-05: contraproposta = supersede da anterior não aplicada.
  UPDATE public.acordos_adendas
  SET superseded_at = now()
  WHERE acordo_id = p_acordo_id
    AND applied_at IS NULL
    AND superseded_at IS NULL
    AND lower(estado) IN ('pendente_passageiro', 'pendente_contraparte', 'aceite');

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
    v_estado_inicial
  );

  BEGIN
    IF v_is_driver THEN
      INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
      SELECT
        ap.passenger_id,
        'O motorista propôs um novo preço — aceita a adenda em Acordos.',
        'success',
        jsonb_build_object(
          'type', 'agreement_update',
          'acordo_id', p_acordo_id,
          'effective_from', v_effective,
          'adenda_estado', v_estado_inicial
        )
      FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = p_acordo_id
        AND lower(ap.estado) = 'activo';
    ELSE
      INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
      VALUES (
        v_acordo.driver_id,
        'Um passageiro propôs um novo preço — responde à adenda em Acordos.',
        'success',
        jsonb_build_object(
          'type', 'agreement_update',
          'acordo_id', p_acordo_id,
          'effective_from', v_effective,
          'adenda_estado', v_estado_inicial
        )
      );
    END IF;
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

-- =============================================================================
-- Task 1a.2 — propose_agreement_adenda (alias que delega; S22-AD-09)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.propose_agreement_adenda(
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
BEGIN
  RETURN public.renegotiate_agreement_pricing(
    p_acordo_id,
    p_modo_preco,
    p_valor_ask_kz,
    p_n_passageiros,
    p_idempotency_key
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.propose_agreement_adenda(uuid, text, integer, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.propose_agreement_adenda(uuid, text, integer, integer, uuid) TO authenticated;

-- =============================================================================
-- Task 1a.3 — accept_agreement_adenda bilateral (S22-AD-06 / S22-AD-07)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.accept_agreement_adenda(
  p_adenda_id uuid,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_adenda public.acordos_adendas%ROWTYPE;
  v_acordo public.acordos%ROWTYPE;
  v_estado text;
  v_is_pax boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_adenda_id IS NULL THEN
    RAISE EXCEPTION 'ID da adenda é obrigatório.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      RETURN p_adenda_id;
    END IF;
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

  IF v_adenda.applied_at IS NOT NULL OR lower(v_adenda.estado) = 'em_vigor' THEN
    RAISE EXCEPTION 'Esta adenda já foi aplicada.';
  END IF;

  v_estado := lower(v_adenda.estado);

  IF v_estado = 'aceite' THEN
    IF p_idempotency_key IS NOT NULL THEN
      INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
      VALUES (p_idempotency_key, 'accept_agreement_adenda', v_adenda.id, v_uid)
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
    RETURN v_adenda.id;
  END IF;

  IF v_estado NOT IN ('pendente_passageiro', 'pendente_contraparte') THEN
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

  -- S22-AD-07: o criador NUNCA decide a própria adenda.
  IF v_uid = v_adenda.created_by THEN
    RAISE EXCEPTION 'Só a contraparte pode aceitar esta adenda.';
  END IF;

  IF v_estado = 'pendente_passageiro' THEN
    IF v_uid = v_acordo.driver_id THEN
      RAISE EXCEPTION 'Apenas um passageiro activo do acordo pode aceitar a adenda.';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = v_adenda.acordo_id
        AND ap.passenger_id = v_uid
        AND lower(ap.estado) = 'activo'
    ) INTO v_is_pax;

    IF NOT v_is_pax THEN
      RAISE EXCEPTION 'Apenas um passageiro activo do acordo pode aceitar a adenda.';
    END IF;
  ELSE
    IF v_uid IS DISTINCT FROM v_acordo.driver_id THEN
      RAISE EXCEPTION 'Apenas o motorista do acordo pode aceitar esta adenda.';
    END IF;
  END IF;

  UPDATE public.acordos_adendas
  SET
    estado = 'aceite',
    aceite_em = now(),
    aceite_por = v_uid
  WHERE id = v_adenda.id;

  -- Não aplica preços antes de effective_from; o lazy apply trata disso.
  PERFORM public.apply_due_agreement_adendas(v_adenda.acordo_id);

  BEGIN
    INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
    VALUES (
      v_adenda.created_by,
      'A contraparte aceitou a adenda de preço do acordo.',
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

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'accept_agreement_adenda', v_adenda.id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_adenda.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_agreement_adenda(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_agreement_adenda(uuid, uuid) TO authenticated;

-- =============================================================================
-- Task 1a.4 — reject_agreement_adenda + p_idempotency_key (S22-AD-08 / A4)
-- =============================================================================

DROP FUNCTION IF EXISTS public.reject_agreement_adenda(uuid);

CREATE OR REPLACE FUNCTION public.reject_agreement_adenda(
  p_adenda_id uuid,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_adenda public.acordos_adendas%ROWTYPE;
  v_acordo public.acordos%ROWTYPE;
  v_estado text;
  v_is_pax boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_adenda_id IS NULL THEN
    RAISE EXCEPTION 'ID da adenda é obrigatório.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      RETURN p_adenda_id;
    END IF;
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

  IF v_adenda.applied_at IS NOT NULL OR lower(v_adenda.estado) = 'em_vigor' THEN
    RAISE EXCEPTION 'Esta adenda já foi aplicada.';
  END IF;

  v_estado := lower(v_adenda.estado);

  IF v_estado = 'rejeitada' THEN
    IF p_idempotency_key IS NOT NULL THEN
      INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
      VALUES (p_idempotency_key, 'reject_agreement_adenda', v_adenda.id, v_uid)
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
    RETURN v_adenda.id;
  END IF;

  IF v_estado NOT IN ('pendente_passageiro', 'pendente_contraparte') THEN
    RAISE EXCEPTION 'Adenda não está pendente de decisão da contraparte.';
  END IF;

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = v_adenda.acordo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  -- O criador nunca rejeita a própria proposta.
  IF v_uid = v_adenda.created_by THEN
    RAISE EXCEPTION 'Só a contraparte pode rejeitar esta adenda.';
  END IF;

  IF v_estado = 'pendente_passageiro' THEN
    IF v_uid = v_acordo.driver_id THEN
      RAISE EXCEPTION 'Só a contraparte pode rejeitar esta adenda.';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = v_adenda.acordo_id
        AND ap.passenger_id = v_uid
        AND lower(ap.estado) = 'activo'
    ) INTO v_is_pax;

    IF NOT v_is_pax THEN
      RAISE EXCEPTION 'Só a contraparte pode rejeitar esta adenda.';
    END IF;
  ELSE
    IF v_uid IS DISTINCT FROM v_acordo.driver_id THEN
      RAISE EXCEPTION 'Só a contraparte pode rejeitar esta adenda.';
    END IF;
  END IF;

  UPDATE public.acordos_adendas
  SET estado = 'rejeitada'
  WHERE id = v_adenda.id;
  -- Preços do acordo / quotas NÃO são alterados (sem recálculo retroactivo).

  BEGIN
    INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
    VALUES (
      v_adenda.created_by,
      'A contraparte rejeitou a proposta de alteração de preço.',
      'warning',
      jsonb_build_object(
        'type', 'agreement_update',
        'acordo_id', v_adenda.acordo_id,
        'adenda_id', v_adenda.id,
        'adenda_estado', 'rejeitada'
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Falha ao notificar rejeição de adenda %: %', v_adenda.id, SQLERRM;
  END;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'reject_agreement_adenda', v_adenda.id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_adenda.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.reject_agreement_adenda(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_agreement_adenda(uuid, uuid) TO authenticated;

-- =============================================================================
-- Task 1a.5 — apply_due_agreement_adendas: nunca aplicar a acordo não activo
-- (edge case da spec: adenda aceite + acordo cancelado antes de effective_from)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_due_agreement_adendas(
  p_acordo_id uuid DEFAULT NULL::uuid
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
  r record;
  v_applied integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  FOR v_adenda IN
    SELECT ad.*
    FROM public.acordos_adendas ad
    WHERE ad.applied_at IS NULL
      AND ad.superseded_at IS NULL
      AND lower(ad.estado) = 'aceite'
      AND ad.effective_from <= v_today
      AND (p_acordo_id IS NULL OR ad.acordo_id = p_acordo_id)
      AND EXISTS (
        SELECT 1 FROM public.acordos a
        WHERE a.id = ad.acordo_id
          AND lower(a.estado) = 'activo'
      )
    ORDER BY ad.effective_from ASC, ad.created_at ASC
    FOR UPDATE
  LOOP
    UPDATE public.acordos
    SET
      modo_preco = v_adenda.modo_preco,
      n_passageiros_contrato = v_adenda.n_passageiros_contrato,
      valor_mensal_total_kz = v_adenda.valor_mensal_total_kz,
      valor_mensal_por_passageiro_kz = v_adenda.valor_mensal_por_passageiro_kz
    WHERE id = v_adenda.acordo_id;

    -- Unidade contratual congelada (N_contrato); não recalcular por N_activos.
    v_base := v_adenda.valor_mensal_por_passageiro_kz;

    FOR r IN
      SELECT id
      FROM public.acordos_passageiros
      WHERE acordo_id = v_adenda.acordo_id
        AND lower(estado) = 'activo'
      ORDER BY ordem_insercao ASC, passenger_id ASC
    LOOP
      UPDATE public.acordos_passageiros
      SET quota_mensal_kz = v_base
      WHERE id = r.id;
    END LOOP;

    UPDATE public.acordos_adendas
    SET
      applied_at = now(),
      estado = 'em_vigor'
    WHERE id = v_adenda.id;

    v_applied := v_applied + 1;
  END LOOP;

  RETURN v_applied;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_due_agreement_adendas(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_due_agreement_adendas(uuid) TO authenticated;

-- =============================================================================
-- Task 2a.2 — apply_due_agreement_terminations (lazy dia 1; S22-TM-04)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_due_agreement_terminations(
  p_acordo_id uuid DEFAULT NULL::uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (timezone('Africa/Luanda', now()))::date;
  v_acordo public.acordos%ROWTYPE;
  v_applied integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  FOR v_acordo IN
    SELECT *
    FROM public.acordos
    WHERE lower(estado) = 'cancelamento_pendente'
      AND rescisao_effective_on IS NOT NULL
      AND rescisao_effective_on <= v_today
      AND (p_acordo_id IS NULL OR id = p_acordo_id)
    ORDER BY rescisao_effective_on ASC, created_at ASC
    FOR UPDATE
  LOOP
    UPDATE public.acordos
    SET
      estado = 'cancelado',
      cancelado_em = now()
    WHERE id = v_acordo.id;

    UPDATE public.acordos_passageiros
    SET estado = 'saiu'
    WHERE acordo_id = v_acordo.id
      AND lower(estado) = 'activo';

    PERFORM public.recount_oferta_vagas(v_acordo.oferta_id);

    BEGIN
      PERFORM public.promote_waitlist(v_acordo.oferta_id);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Falha best-effort promote_waitlist na rescisão do acordo %: %',
          v_acordo.id, SQLERRM;
    END;

    v_applied := v_applied + 1;
  END LOOP;

  RETURN v_applied;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_due_agreement_terminations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_due_agreement_terminations(uuid) TO authenticated;

-- =============================================================================
-- Task 2a.3 — terminate_agreement (3 modos; S22-TM-02…09)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.terminate_agreement(
  p_acordo_id uuid,
  p_modo text,
  p_justificativa text DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_acordo public.acordos%ROWTYPE;
  v_modo text;
  v_is_driver boolean;
  v_is_pax boolean;
  v_hoje date;
  v_mes_inicio date;
  v_effective date;
  v_dias_uteis integer;
  v_dias_decorridos integer;
  v_solicitante_is_driver boolean;
  v_confirma boolean := false;
  v_faltas_ok boolean := false;
  v_estado_final text;
  v_mensagem text;
  r record;
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

  v_modo := lower(COALESCE(p_modo, ''));

  IF v_modo NOT IN ('aviso_previo', 'consensual', 'justa_causa') THEN
    RAISE EXCEPTION
      'Modo de rescisão inválido. Use aviso_previo, consensual ou justa_causa.';
  END IF;

  -- Liquidar rescisões já vencidas antes de decidir sobre este acordo.
  PERFORM public.apply_due_agreement_terminations(p_acordo_id);

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = p_acordo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  -- S22-TM-09: só motorista ou passageiro activo rescinde.
  v_is_driver := (v_uid = v_acordo.driver_id);

  SELECT EXISTS (
    SELECT 1
    FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id
      AND ap.passenger_id = v_uid
      AND lower(ap.estado) = 'activo'
  ) INTO v_is_pax;

  IF NOT v_is_driver AND NOT v_is_pax THEN
    RAISE EXCEPTION 'Sem permissão para rescindir este acordo.';
  END IF;

  v_hoje := (timezone('Africa/Luanda', now()))::date;
  v_mes_inicio := date_trunc('month', v_hoje)::date;
  v_effective := (date_trunc('month', v_hoje) + interval '1 month')::date;

  -- ---------------------------------------------------------------------------
  -- Modo 1 — aviso prévio: diferido para o 1.º dia do mês seguinte.
  -- Vagas e membros mantêm-se ocupados até lá (S22-TM-02 / S22-TM-03).
  -- ---------------------------------------------------------------------------
  IF v_modo = 'aviso_previo' THEN
    IF lower(v_acordo.estado) <> 'activo' THEN
      RAISE EXCEPTION 'Este acordo já não está activo.';
    END IF;

    UPDATE public.acordos
    SET
      estado = 'cancelamento_pendente',
      rescisao_modo = 'aviso_previo',
      rescisao_solicitada_por = v_uid,
      rescisao_justificativa = NULLIF(btrim(COALESCE(p_justificativa, '')), ''),
      rescisao_effective_on = v_effective
    WHERE id = p_acordo_id;

    v_mensagem := 'A outra parte pediu a rescisão do acordo com aviso prévio; '
      || 'o acordo mantém-se activo até ao fim deste mês.';

  -- ---------------------------------------------------------------------------
  -- Modo 2 — consensual: 2 passos (S22-TM-05 / S22-TM-06 / A5).
  -- ---------------------------------------------------------------------------
  ELSIF v_modo = 'consensual' THEN
    IF lower(v_acordo.estado) <> 'activo' THEN
      RAISE EXCEPTION 'Este acordo já não está activo.';
    END IF;

    IF lower(COALESCE(v_acordo.rescisao_modo, '')) = 'consensual'
       AND v_acordo.rescisao_solicitada_por IS NOT NULL
       AND v_acordo.rescisao_solicitada_por IS DISTINCT FROM v_uid THEN
      -- A confirmação tem de vir do lado oposto: motorista ↔ passageiro activo.
      v_solicitante_is_driver :=
        (v_acordo.rescisao_solicitada_por = v_acordo.driver_id);

      v_confirma := (v_solicitante_is_driver AND v_is_pax)
        OR (NOT v_solicitante_is_driver AND v_is_driver);
    END IF;

    IF NOT v_confirma THEN
      -- 1.º passo (ou repetição do mesmo utilizador): grava o pedido e sai.
      -- Se já existe pedido consensual, o solicitante original é preservado.
      UPDATE public.acordos
      SET
        rescisao_modo = 'consensual',
        rescisao_solicitada_por = COALESCE(
          CASE
            WHEN lower(COALESCE(v_acordo.rescisao_modo, '')) = 'consensual'
              THEN v_acordo.rescisao_solicitada_por
          END,
          v_uid
        ),
        rescisao_justificativa = NULLIF(btrim(COALESCE(p_justificativa, '')), ''),
        rescisao_effective_on = NULL
      WHERE id = p_acordo_id;

      BEGIN
        INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
        SELECT
          t.user_id,
          'A outra parte pediu a rescisão consensual do acordo — confirma em Acordos.',
          'warning',
          jsonb_build_object(
            'type', 'agreement_update',
            'acordo_id', p_acordo_id,
            'rescisao_modo', 'consensual'
          )
        FROM (
          SELECT v_acordo.driver_id AS user_id
          UNION
          SELECT ap.passenger_id
          FROM public.acordos_passageiros ap
          WHERE ap.acordo_id = p_acordo_id
            AND lower(ap.estado) = 'activo'
        ) t
        WHERE t.user_id IS DISTINCT FROM v_uid;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Falha ao notificar pedido consensual do acordo %: %',
            p_acordo_id, SQLERRM;
      END;

      IF p_idempotency_key IS NOT NULL THEN
        INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
        VALUES (p_idempotency_key, 'terminate_agreement', p_acordo_id, v_uid)
        ON CONFLICT (idempotency_key) DO NOTHING;
      END IF;

      RETURN p_acordo_id;
    END IF;

    -- 2.º passo pela contraparte: fim imediato, sem pro-rata (quotas congeladas).
    UPDATE public.acordos
    SET
      estado = 'cancelado',
      rescisao_modo = 'consensual',
      rescisao_effective_on = v_hoje,
      cancelado_em = now()
    WHERE id = p_acordo_id;

    UPDATE public.acordos_passageiros
    SET estado = 'saiu'
    WHERE acordo_id = p_acordo_id
      AND lower(estado) = 'activo';

    PERFORM public.recount_oferta_vagas(v_acordo.oferta_id);

    BEGIN
      PERFORM public.promote_waitlist(v_acordo.oferta_id);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Falha best-effort promote_waitlist na rescisão do acordo %: %',
          p_acordo_id, SQLERRM;
    END;

    v_mensagem := 'A rescisão consensual foi confirmada; o acordo está encerrado.';

  -- ---------------------------------------------------------------------------
  -- Modo 3 — justa causa: fim imediato + pro-rata (excepção A1 a AGENTS §7).
  -- ---------------------------------------------------------------------------
  ELSE
    IF lower(v_acordo.estado) NOT IN ('activo', 'cancelamento_pendente') THEN
      RAISE EXCEPTION 'Este acordo já não está activo.';
    END IF;

    IF NULLIF(btrim(COALESCE(p_justificativa, '')), '') IS NULL THEN
      RAISE EXCEPTION 'A justa causa exige uma justificativa.';
    END IF;

    IF lower(btrim(p_justificativa)) NOT IN
       ('faltas_excessivas', 'avaria_veiculo', 'seguranca') THEN
      RAISE EXCEPTION
        'Justificativa inválida. Use faltas_excessivas, avaria_veiculo ou seguranca.';
    END IF;

    v_dias_uteis := COALESCE(v_acordo.dias_uteis_mes, 0);

    IF v_dias_uteis < 1 THEN
      RAISE EXCEPTION 'Dias úteis do acordo inválidos para calcular a rescisão.';
    END IF;

    IF lower(btrim(p_justificativa)) = 'faltas_excessivas' THEN
      -- S22-TM-07: validação no servidor (> 50% dos dias úteis do mês corrente).
      IF v_is_driver THEN
        SELECT EXISTS (
          SELECT 1
          FROM public.faltas f
          WHERE f.id_acordo = p_acordo_id
            AND f.tipo = 'Passageiro'
            AND f.data_falta >= v_mes_inicio
            AND f.data_falta <= v_hoje
          GROUP BY f.passenger_id
          HAVING COUNT(*)::numeric > (v_dias_uteis::numeric / 2.0)
        ) INTO v_faltas_ok;
      ELSE
        SELECT (COUNT(*)::numeric > (v_dias_uteis::numeric / 2.0))
        INTO v_faltas_ok
        FROM public.faltas f
        WHERE f.id_acordo = p_acordo_id
          AND f.tipo = 'Motorista'
          AND f.data_falta >= v_mes_inicio
          AND f.data_falta <= v_hoje;
      END IF;

      IF NOT v_faltas_ok THEN
        RAISE EXCEPTION
          'As faltas registadas neste mês não chegam para justa causa por faltas excessivas.';
      END IF;
    END IF;

    -- Dias úteis (Seg–Sex) já decorridos no mês, em Africa/Luanda.
    SELECT COUNT(*)::integer INTO v_dias_decorridos
    FROM generate_series(v_mes_inicio, v_hoje, interval '1 day') AS d
    WHERE EXTRACT(ISODOW FROM d) < 6;

    v_dias_decorridos := LEAST(GREATEST(v_dias_decorridos, 0), v_dias_uteis);

    -- Excepção A1: só a justa causa ajusta quotas pro-rata aos dias decorridos.
    -- Unidade diária = quota / dias_uteis_mes (espelha src/utils/faltaDesconto.js).
    FOR r IN
      SELECT id, quota_mensal_kz
      FROM public.acordos_passageiros
      WHERE acordo_id = p_acordo_id
        AND lower(estado) = 'activo'
      ORDER BY ordem_insercao ASC, passenger_id ASC
    LOOP
      UPDATE public.acordos_passageiros
      SET
        quota_mensal_kz = GREATEST(
          0,
          LEAST(
            r.quota_mensal_kz,
            ROUND(
              r.quota_mensal_kz::numeric * v_dias_decorridos::numeric
              / v_dias_uteis::numeric
            )::integer
          )
        ),
        estado = 'saiu'
      WHERE id = r.id;
    END LOOP;

    UPDATE public.acordos
    SET
      estado = 'cancelado_justificado',
      rescisao_modo = 'justa_causa',
      rescisao_solicitada_por = v_uid,
      rescisao_justificativa = lower(btrim(p_justificativa)),
      rescisao_effective_on = v_hoje,
      cancelado_em = now()
    WHERE id = p_acordo_id;

    PERFORM public.recount_oferta_vagas(v_acordo.oferta_id);

    BEGIN
      PERFORM public.promote_waitlist(v_acordo.oferta_id);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Falha best-effort promote_waitlist na rescisão do acordo %: %',
          p_acordo_id, SQLERRM;
    END;

    v_mensagem := 'A outra parte rescindiu o acordo por justa causa.';
  END IF;

  SELECT estado INTO v_estado_final FROM public.acordos WHERE id = p_acordo_id;

  BEGIN
    INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
    SELECT
      t.user_id,
      v_mensagem,
      'warning',
      jsonb_build_object(
        'type', 'agreement_update',
        'acordo_id', p_acordo_id,
        'rescisao_modo', v_modo,
        'acordo_estado', v_estado_final
      )
    FROM (
      SELECT v_acordo.driver_id AS user_id
      UNION
      SELECT ap.passenger_id
      FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = p_acordo_id
    ) t
    WHERE t.user_id IS DISTINCT FROM v_uid;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Falha ao notificar rescisão do acordo %: %', p_acordo_id, SQLERRM;
  END;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'terminate_agreement', p_acordo_id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN p_acordo_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.terminate_agreement(uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.terminate_agreement(uuid, text, text, uuid) TO authenticated;

-- =============================================================================
-- Hardening de GRANT — os default privileges do Supabase reconcedem EXECUTE a
-- `anon`; as funções novas ficam só para `authenticated`.
-- =============================================================================

REVOKE ALL ON FUNCTION public.recalc_vagas_disponiveis() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalc_vagas_disponiveis() FROM anon;
REVOKE ALL ON FUNCTION public.oferta_ocupacao(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.propose_agreement_adenda(uuid, text, integer, integer, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.terminate_agreement(uuid, text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.apply_due_agreement_terminations(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.renegotiate_agreement_pricing(uuid, text, integer, integer, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.accept_agreement_adenda(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.reject_agreement_adenda(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.apply_due_agreement_adendas(uuid) FROM anon;

-- recount_oferta_vagas: sem EXECUTE para clientes (só owner / DEFINER internas).
REVOKE ALL ON FUNCTION public.recount_oferta_vagas(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recount_oferta_vagas(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.recount_oferta_vagas(uuid) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.oferta_ocupacao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.propose_agreement_adenda(uuid, text, integer, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.terminate_agreement(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_due_agreement_terminations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.renegotiate_agreement_pricing(uuid, text, integer, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_agreement_adenda(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_agreement_adenda(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_due_agreement_adendas(uuid) TO authenticated;
