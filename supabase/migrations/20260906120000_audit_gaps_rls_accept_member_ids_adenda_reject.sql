-- Audit gaps DB/Segurança (prompts-and-audit.md §1 / Prompt 1)
-- Task 2: RLS membros_grupo — self-insert só estado='pendente'
-- Task 3/4: accept_proposal(..., p_member_ids uuid[], p_idempotency_key)
-- Task 6: estados adenda alargados + reject_agreement_adenda + divisor N_contrato
--
-- Aplicado remotamente via Supabase MCP (project fdclrbcgytnuqcrpsevw) em 2026-09-06:
--   audit_gaps_rls_membros_and_adenda_estados
--   audit_gaps_accept_proposal_member_ids
--   audit_gaps_renegotiate_n_contrato
--   audit_gaps_reject_agreement_adenda
--   audit_gaps_apply_due_em_vigor_v2
-- Fonte canónica local (ficheiro único); remoto ficou em 5 versões MCP.

-- =============================================================================
-- Task 2 — RLS membros_grupo: self-insert força pendente
-- =============================================================================
DROP POLICY IF EXISTS membros_insert_envolvidos ON public.membros_grupo;

CREATE POLICY membros_insert_envolvidos
  ON public.membros_grupo
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      -- Owner do grupo (via procura): pode inserir com qualquer estado (ex. activo)
      auth.uid() = (
        SELECT p.owner_id
        FROM public.grupos g
        JOIN public.procuras p ON p.id = g.procura_id
        WHERE g.id = membros_grupo.grupo_id
      )
    )
    OR (
      -- Self-join: só pedido pendente — impossível bypass para 'activo'
      auth.uid() = passenger_id
      AND lower(estado) = 'pendente'
    )
  );

-- =============================================================================
-- Task 6a — Estados adenda (PT snake_case; UI case-insensitive)
-- PENDENTE_CONTRAPARTE → pendente_passageiro | pendente_contraparte
-- ACEITE_AGENDADA → aceite
-- REJEITADA / CANCELADA_INICIADOR / EM_VIGOR
-- =============================================================================
ALTER TABLE public.acordos_adendas
  DROP CONSTRAINT IF EXISTS acordos_adendas_estado_check;

ALTER TABLE public.acordos_adendas
  ADD CONSTRAINT acordos_adendas_estado_check
  CHECK (
    lower(estado) = ANY (
      ARRAY[
        'pendente_passageiro'::text,
        'pendente_contraparte'::text,
        'rejeitada'::text,
        'cancelada_iniciador'::text,
        'aceite'::text,
        'em_vigor'::text
      ]
    )
  );

-- =============================================================================
-- Task 3/4 — accept_proposal com composição explícita (p_member_ids)
-- =============================================================================
DROP FUNCTION IF EXISTS public.accept_proposal(uuid, uuid);
DROP FUNCTION IF EXISTS public.accept_proposal(uuid, uuid[], uuid);

CREATE OR REPLACE FUNCTION public.accept_proposal(
  p_proposta_id uuid,
  p_member_ids uuid[] DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prop public.propostas%ROWTYPE;
  v_oferta public.ofertas_capacidade%ROWTYPE;
  v_procura public.procuras%ROWTYPE;
  v_ocupadas integer;
  v_disponiveis integer;
  v_n integer;
  v_total integer;
  v_base integer;
  v_resto integer;
  v_acordo_id uuid;
  v_uid uuid := auth.uid();
  v_member_id uuid;
  v_membro public.membros_grupo%ROWTYPE;
  v_ids uuid[];
  v_seen uuid[] := ARRAY[]::uuid[];
  i integer := 0;
  v_quota integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      SELECT subject_id INTO v_acordo_id
      FROM public.rpc_idempotency
      WHERE idempotency_key = p_idempotency_key;
      RETURN v_acordo_id;
    END IF;
  END IF;

  SELECT * INTO v_prop FROM public.propostas WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada.';
  END IF;
  IF v_prop.estado <> 'aberta' THEN
    RAISE EXCEPTION 'Proposta não está aberta.';
  END IF;

  -- Contraparte: criador NÃO pode aceitar
  IF v_uid = v_prop.created_by THEN
    RAISE EXCEPTION 'Só a contraparte pode aceitar ou rejeitar esta proposta.';
  END IF;

  SELECT * INTO v_oferta FROM public.ofertas_capacidade WHERE id = v_prop.oferta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta não encontrada.';
  END IF;

  SELECT * INTO v_procura FROM public.procuras WHERE id = v_prop.procura_id;
  IF v_uid IS DISTINCT FROM v_oferta.driver_id AND v_uid IS DISTINCT FROM v_procura.owner_id THEN
    RAISE EXCEPTION 'Sem permissão para aceitar esta proposta.';
  END IF;

  SELECT COALESCE(COUNT(*), 0) INTO v_ocupadas
  FROM public.acordos_passageiros ap
  JOIN public.acordos a ON a.id = ap.acordo_id
  WHERE a.oferta_id = v_oferta.id
    AND a.estado = 'activo'
    AND ap.estado = 'activo';

  v_disponiveis := v_oferta.vagas_totais - v_ocupadas;
  v_n := v_prop.n_passageiros_propostos;

  IF v_n > v_disponiveis THEN
    RAISE EXCEPTION 'Vagas insuficientes para este grupo. Use lista de espera.';
  END IF;

  IF v_prop.modo_preco = 'POR_PASSAGEIRO' THEN
    v_base := v_prop.valor_mensal_ask_kz;
    v_total := v_base * v_n;
    v_resto := 0;
  ELSIF v_prop.modo_preco = 'TOTAL_ACORDO' THEN
    v_total := v_prop.valor_mensal_ask_kz;
    v_base := v_total / v_n;
    v_resto := v_total % v_n;
  ELSE
    RAISE EXCEPTION 'Modo de preço desconhecido.';
  END IF;

  INSERT INTO public.acordos (
    oferta_id, procura_id, grupo_id, driver_id,
    modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz,
    estado
  ) VALUES (
    v_prop.oferta_id, v_prop.procura_id, v_prop.grupo_id, v_oferta.driver_id,
    v_prop.modo_preco, v_n,
    v_total, v_base,
    'activo'
  ) RETURNING id INTO v_acordo_id;

  IF v_prop.grupo_id IS NOT NULL THEN
    v_ids := COALESCE(p_member_ids, ARRAY[]::uuid[]);

    IF cardinality(v_ids) IS DISTINCT FROM v_n THEN
      RAISE EXCEPTION 'Capacidade inconsistente com proposta';
    END IF;

    FOREACH v_member_id IN ARRAY v_ids
    LOOP
      IF v_member_id = ANY (v_seen) THEN
        RAISE EXCEPTION 'Capacidade inconsistente com proposta';
      END IF;
      v_seen := array_append(v_seen, v_member_id);

      SELECT *
      INTO v_membro
      FROM public.membros_grupo
      WHERE grupo_id = v_prop.grupo_id
        AND passenger_id = v_member_id
        AND lower(estado) = 'activo';

      IF NOT FOUND THEN
        RAISE EXCEPTION
          'Membro % não está activo no grupo da proposta.',
          v_member_id;
      END IF;

      IF v_prop.modo_preco = 'POR_PASSAGEIRO' THEN
        v_quota := v_base;
      ELSE
        v_quota := CASE WHEN i < v_resto THEN v_base + 1 ELSE v_base END;
      END IF;

      INSERT INTO public.acordos_passageiros (
        acordo_id, passenger_id, quota_mensal_kz, ordem_insercao,
        pickup_name, pickup_lat, pickup_lng,
        dropoff_name, dropoff_lat, dropoff_lng,
        estado
      ) VALUES (
        v_acordo_id, v_membro.passenger_id, v_quota, i,
        v_membro.pickup_name, v_membro.pickup_lat, v_membro.pickup_lng,
        v_membro.dropoff_name, v_membro.dropoff_lat, v_membro.dropoff_lng,
        'activo'
      );
      i := i + 1;
    END LOOP;
  ELSE
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'Proposta sem grupo exige n_passageiros_propostos = 1.';
    END IF;

    -- Solo: p_member_ids opcional; se presente deve ser exactamente o owner
    IF p_member_ids IS NOT NULL AND cardinality(p_member_ids) > 0 THEN
      IF cardinality(p_member_ids) <> 1 OR p_member_ids[1] IS DISTINCT FROM v_procura.owner_id THEN
        RAISE EXCEPTION 'Capacidade inconsistente com proposta';
      END IF;
    END IF;

    INSERT INTO public.acordos_passageiros (
      acordo_id, passenger_id, quota_mensal_kz, ordem_insercao, estado
    ) VALUES (
      v_acordo_id, v_procura.owner_id, v_base, 0, 'activo'
    );
  END IF;

  INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
  SELECT
    ap.passenger_id,
    'O teu acordo de boleia foi confirmado.',
    'success',
    jsonb_build_object('type', 'agreement_update', 'acordo_id', v_acordo_id)
  FROM public.acordos_passageiros ap
  WHERE ap.acordo_id = v_acordo_id AND ap.estado = 'activo';

  v_disponiveis := v_oferta.vagas_totais - (v_ocupadas + v_n);
  UPDATE public.ofertas_capacidade
  SET
    vagas_disponiveis = v_disponiveis,
    estado = CASE
      WHEN v_disponiveis = 0 THEN 'cheia'
      WHEN v_disponiveis < vagas_totais THEN 'parcial'
      ELSE 'disponivel'
    END,
    updated_at = now()
  WHERE id = v_oferta.id;

  UPDATE public.propostas
  SET
    estado = 'aceite',
    valor_mensal_por_passageiro_resolvido_kz = v_base,
    valor_mensal_total_resolvido_kz = v_total,
    updated_at = now()
  WHERE id = v_prop.id;

  UPDATE public.propostas
  SET estado = 'cancelada', updated_at = now()
  WHERE procura_id = v_prop.procura_id
    AND id <> v_prop.id
    AND estado = 'aberta';

  UPDATE public.procuras
  SET estado = 'fechada', updated_at = now()
  WHERE id = v_prop.procura_id;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'accept_proposal', v_acordo_id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_acordo_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_proposal(uuid, uuid[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_proposal(uuid, uuid[], uuid) TO authenticated;

-- =============================================================================
-- Task 6b — renegotiate: divisor sempre N_contrato (sem recálculo por N_activos)
-- =============================================================================
DROP FUNCTION IF EXISTS public.renegotiate_agreement_pricing(uuid, text, integer, integer, uuid);

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

  -- Divisor congelado: sempre N_contrato (nunca N_activos)
  v_n := v_acordo.n_passageiros_contrato;

  IF v_n < 1 THEN
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

-- =============================================================================
-- Task 6c — apply_due: marcar em_vigor; quotas por N_contrato (sem redistribuir
-- o total pelos N_activos — cada activo recebe a unidade contratual)
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
  v_quota integer;
  r record;
  v_applied integer := 0;
BEGIN
  FOR v_adenda IN
    SELECT *
    FROM public.acordos_adendas
    WHERE applied_at IS NULL
      AND superseded_at IS NULL
      AND lower(estado) = 'aceite'
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

    -- Unidade contratual congelada (N_contrato); não recalcular por N_activos
    v_base := v_adenda.valor_mensal_por_passageiro_kz;

    FOR r IN
      SELECT id
      FROM public.acordos_passageiros
      WHERE acordo_id = v_adenda.acordo_id
        AND estado = 'activo'
      ORDER BY ordem_insercao ASC, passenger_id ASC
    LOOP
      v_quota := v_base;

      UPDATE public.acordos_passageiros
      SET quota_mensal_kz = v_quota
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

-- =============================================================================
-- Task 6d — reject_agreement_adenda (contraparte → rejeitada; preços intactos)
-- =============================================================================
DROP FUNCTION IF EXISTS public.reject_agreement_adenda(uuid);

CREATE OR REPLACE FUNCTION public.reject_agreement_adenda(
  p_adenda_id uuid
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

  IF v_adenda.applied_at IS NOT NULL OR lower(v_adenda.estado) = 'em_vigor' THEN
    RAISE EXCEPTION 'Esta adenda já foi aplicada.';
  END IF;

  IF lower(v_adenda.estado) = 'rejeitada' THEN
    RETURN v_adenda.id;
  END IF;

  IF lower(v_adenda.estado) NOT IN ('pendente_passageiro', 'pendente_contraparte') THEN
    RAISE EXCEPTION 'Adenda não está pendente de decisão da contraparte.';
  END IF;

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = v_adenda.acordo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  -- Iniciador não rejeita a própria proposta
  IF v_uid = v_adenda.created_by THEN
    RAISE EXCEPTION 'Só a contraparte pode rejeitar esta adenda.';
  END IF;

  IF lower(v_adenda.estado) = 'pendente_passageiro' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = v_adenda.acordo_id
        AND ap.passenger_id = v_uid
        AND ap.estado = 'activo'
    ) INTO v_is_pax;

    IF NOT v_is_pax THEN
      RAISE EXCEPTION 'Só a contraparte pode rejeitar esta adenda.';
    END IF;
  ELSIF lower(v_adenda.estado) = 'pendente_contraparte' THEN
    IF v_uid IS DISTINCT FROM v_acordo.driver_id THEN
      RAISE EXCEPTION 'Só a contraparte pode rejeitar esta adenda.';
    END IF;
  END IF;

  UPDATE public.acordos_adendas
  SET estado = 'rejeitada'
  WHERE id = v_adenda.id;
  -- Preços do acordo / quotas NÃO são alterados (sem recálculo retroactivo)

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

  RETURN v_adenda.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.reject_agreement_adenda(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_agreement_adenda(uuid) TO authenticated;
