-- PACOTE ENG #18 — TTL reservas (B1) + gate IBAN liquidação (B4)

-- === B1: schema reserva com TTL ===
ALTER TABLE public.acordos_passageiros
  ADD COLUMN IF NOT EXISTS reservado_expira_em timestamptz;

ALTER TABLE public.acordos_passageiros
  DROP CONSTRAINT IF EXISTS acordos_passageiros_estado_check;

ALTER TABLE public.acordos_passageiros
  ADD CONSTRAINT acordos_passageiros_estado_check
  CHECK (estado = ANY (ARRAY['activo'::text, 'reservado'::text, 'saiu'::text, 'expirado'::text]));

COMMENT ON COLUMN public.acordos_passageiros.reservado_expira_em IS
  'Prazo limite do soft-hold reservado (72h piloto). NULL fora de reservado.';

-- Backfill reservas activas sem prazo
UPDATE public.acordos_passageiros
SET reservado_expira_em = created_at + INTERVAL '72 hours'
WHERE lower(estado) = 'reservado'
  AND reservado_expira_em IS NULL;

CREATE OR REPLACE FUNCTION public.reserva_ttl_hours()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 72;
$$;

-- oferta_ocupacao: só activo + reservado (expirado não ocupa)
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
    AND lower(ap.estado) IN ('activo', 'reservado');
$function$;

-- === B1: lazy expiry (espelha apply_due_agreement_terminations) ===
CREATE OR REPLACE FUNCTION public.apply_due_reserva_expiry(p_acordo_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row RECORD;
  v_oferta_ids uuid[] := ARRAY[]::uuid[];
  v_oferta_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT ap.id, ap.acordo_id, ap.passenger_id, a.oferta_id
    FROM public.acordos_passageiros ap
    JOIN public.acordos a ON a.id = ap.acordo_id
    WHERE lower(ap.estado) = 'reservado'
      AND ap.reservado_expira_em IS NOT NULL
      AND ap.reservado_expira_em <= now()
      AND (p_acordo_id IS NULL OR ap.acordo_id = p_acordo_id)
      AND lower(a.estado) IN ('activo', 'cancelamento_pendente')
      AND NOT EXISTS (
        SELECT 1
        FROM public.pagamentos_acordo pg
        WHERE pg.acordo_passageiro_id = ap.id
          AND lower(pg.estado) IN ('comprovativo_enviado', 'em_custodia', 'liquidado')
      )
    FOR UPDATE OF ap
  LOOP
    UPDATE public.acordos_passageiros
    SET
      estado = 'expirado',
      reservado_expira_em = NULL
    WHERE id = v_row.id;

    UPDATE public.pagamentos_acordo
    SET
      estado = 'reembolsado',
      updated_at = now()
    WHERE acordo_passageiro_id = v_row.id
      AND lower(estado) = 'pendente_pagamento';

    INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
    VALUES (
      v_row.passenger_id,
      'A tua reserva expirou por falta de pagamento a tempo. A vaga foi libertada.',
      'warning',
      jsonb_build_object(
        'type', 'reserva_expirada',
        'acordo_id', v_row.acordo_id,
        'inbox', 'passageiro'
      )
    );

    IF v_row.oferta_id IS NOT NULL AND NOT (v_row.oferta_id = ANY (v_oferta_ids)) THEN
      v_oferta_ids := array_append(v_oferta_ids, v_row.oferta_id);
    END IF;

    v_count := v_count + 1;
  END LOOP;

  FOREACH v_oferta_id IN ARRAY v_oferta_ids
  LOOP
    PERFORM public.recount_oferta_vagas(v_oferta_id);
    BEGIN
      PERFORM public.promote_waitlist(v_oferta_id);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Falha best-effort promote_waitlist após expiry oferta %: %',
          v_oferta_id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- accept_proposal: define reservado_expira_em no insert
CREATE OR REPLACE FUNCTION public.accept_proposal(
  p_proposta_id uuid,
  p_member_ids uuid[] DEFAULT NULL::uuid[],
  p_idempotency_key uuid DEFAULT NULL::uuid
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
  v_expira timestamptz := now() + (public.reserva_ttl_hours() || ' hours')::interval;
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
    AND lower(a.estado) IN ('activo', 'cancelamento_pendente')
    AND lower(ap.estado) IN ('activo', 'reservado');

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
        estado, reservado_expira_em
      ) VALUES (
        v_acordo_id, v_membro.passenger_id, v_quota, i,
        v_membro.pickup_name, v_membro.pickup_lat, v_membro.pickup_lng,
        v_membro.dropoff_name, v_membro.dropoff_lat, v_membro.dropoff_lng,
        'reservado', v_expira
      );
      i := i + 1;
    END LOOP;
  ELSE
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'Proposta sem grupo exige n_passageiros_propostos = 1.';
    END IF;

    IF p_member_ids IS NOT NULL AND cardinality(p_member_ids) > 0 THEN
      IF cardinality(p_member_ids) <> 1 OR p_member_ids[1] IS DISTINCT FROM v_procura.owner_id THEN
        RAISE EXCEPTION 'Capacidade inconsistente com proposta';
      END IF;
    END IF;

    INSERT INTO public.acordos_passageiros (
      acordo_id, passenger_id, quota_mensal_kz, ordem_insercao, estado, reservado_expira_em
    ) VALUES (
      v_acordo_id, v_procura.owner_id, v_base, 0, 'reservado', v_expira
    );
  END IF;

  INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
  SELECT
    ap.passenger_id,
    'Acordo formado: o teu lugar está reservado. Confirma o pagamento em '
      || public.reserva_ttl_hours()::text
      || ' horas para activar o lugar.',
    'success',
    jsonb_build_object(
      'type', 'agreement_update',
      'acordo_id', v_acordo_id,
      'reserva_expira_em', v_expira
    )
  FROM public.acordos_passageiros ap
  WHERE ap.acordo_id = v_acordo_id AND lower(ap.estado) = 'reservado';

  PERFORM public.recount_oferta_vagas(v_oferta.id);

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

-- admin_validate_payment: limpa reservado_expira_em ao promover activo
CREATE OR REPLACE FUNCTION public.admin_validate_payment(
  p_pagamento_id uuid,
  p_aprovar boolean,
  p_motivo text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.pagamentos_acordo%ROWTYPE;
  v_ap public.acordos_passageiros%ROWTYPE;
  v_oferta_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso reservado a administradores.';
  END IF;

  SELECT * INTO v_row
  FROM public.pagamentos_acordo
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado.';
  END IF;

  IF lower(v_row.estado) <> 'comprovativo_enviado' THEN
    RAISE EXCEPTION 'Só comprovativos enviados podem ser validados.';
  END IF;

  IF p_aprovar THEN
    UPDATE public.pagamentos_acordo
    SET
      estado = 'em_custodia',
      validado_por = v_uid,
      validado_em = now(),
      rejeicao_motivo = NULL,
      updated_at = now()
    WHERE id = p_pagamento_id;

    SELECT * INTO v_ap
    FROM public.acordos_passageiros
    WHERE id = v_row.acordo_passageiro_id
    FOR UPDATE;

    IF FOUND AND lower(v_ap.estado) = 'reservado' THEN
      UPDATE public.acordos_passageiros
      SET estado = 'activo', reservado_expira_em = NULL
      WHERE id = v_ap.id;

      SELECT oferta_id INTO v_oferta_id
      FROM public.acordos
      WHERE id = v_ap.acordo_id;

      IF v_oferta_id IS NOT NULL THEN
        PERFORM public.recount_oferta_vagas(v_oferta_id);
      END IF;
    END IF;
  ELSE
    UPDATE public.pagamentos_acordo
    SET
      estado = 'pendente_pagamento',
      comprovativo_path = NULL,
      comprovativo_enviado_em = NULL,
      validado_por = v_uid,
      validado_em = now(),
      rejeicao_motivo = NULLIF(trim(p_motivo), ''),
      updated_at = now()
    WHERE id = p_pagamento_id;
  END IF;

  RETURN p_pagamento_id;
END;
$function$;

-- === B4: gate IBAN + titular na liquidação ===
CREATE OR REPLACE FUNCTION public._refresh_repasse_motorista(
  p_driver_id uuid,
  p_mes_referencia date,
  p_liquidado_por uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_iban text;
  v_titular text;
  v_repasse_id uuid;
  v_gmv integer := 0;
  v_payout integer := 0;
  v_desconto integer := 0;
  v_repasse integer := 0;
  v_take_rate numeric := 0.10;
  v_count integer := 0;
  v_plataforma integer := 0;
BEGIN
  SELECT NULLIF(btrim(COALESCE(p.iban, '')), ''), NULLIF(btrim(COALESCE(p.iban_titular, '')), '')
  INTO v_iban, v_titular
  FROM public.perfis p
  WHERE p.id = p_driver_id;

  SELECT
    COALESCE(SUM(pg.valor_kz), 0)::integer,
    COALESCE(SUM(pg.valor_payout_liquido_kz), 0)::integer,
    COALESCE(SUM(pg.desconto_faltas_kz), 0)::integer,
    COALESCE(SUM(pg.valor_repasse_kz), 0)::integer,
    COUNT(*)::integer,
    COALESCE(MAX(pg.take_rate_pct), 0.10)
  INTO v_gmv, v_payout, v_desconto, v_repasse, v_count, v_take_rate
  FROM public.pagamentos_acordo pg
  WHERE pg.driver_id = p_driver_id
    AND pg.mes_referencia = p_mes_referencia
    AND lower(pg.estado) = 'liquidado';

  IF v_count = 0 THEN
    RETURN NULL;
  END IF;

  IF v_iban IS NULL OR v_titular IS NULL THEN
    RAISE EXCEPTION 'Motorista sem IBAN ou titular configurado no perfil.';
  END IF;

  v_plataforma := GREATEST(0, v_gmv - v_payout);

  INSERT INTO public.repasses_motorista (
    driver_id,
    mes_referencia,
    iban_destino,
    iban_titular,
    gmv_kz,
    take_rate_pct,
    valor_plataforma_kz,
    valor_payout_bruto_kz,
    desconto_faltas_kz,
    valor_repasse_liquido_kz,
    num_pagamentos,
    liquidado_por,
    liquidado_em,
    updated_at
  ) VALUES (
    p_driver_id,
    p_mes_referencia,
    v_iban,
    v_titular,
    v_gmv,
    v_take_rate,
    v_plataforma,
    v_payout,
    v_desconto,
    v_repasse,
    v_count,
    p_liquidado_por,
    now(),
    now()
  )
  ON CONFLICT (driver_id, mes_referencia) DO UPDATE SET
    iban_destino = EXCLUDED.iban_destino,
    iban_titular = EXCLUDED.iban_titular,
    gmv_kz = EXCLUDED.gmv_kz,
    take_rate_pct = EXCLUDED.take_rate_pct,
    valor_plataforma_kz = EXCLUDED.valor_plataforma_kz,
    valor_payout_bruto_kz = EXCLUDED.valor_payout_bruto_kz,
    desconto_faltas_kz = EXCLUDED.desconto_faltas_kz,
    valor_repasse_liquido_kz = EXCLUDED.valor_repasse_liquido_kz,
    num_pagamentos = EXCLUDED.num_pagamentos,
    liquidado_por = EXCLUDED.liquidado_por,
    liquidado_em = EXCLUDED.liquidado_em,
    updated_at = now()
  RETURNING id INTO v_repasse_id;

  UPDATE public.pagamentos_acordo
  SET repasse_id = v_repasse_id, updated_at = now()
  WHERE driver_id = p_driver_id
    AND mes_referencia = p_mes_referencia
    AND lower(estado) = 'liquidado'
    AND repasse_id IS DISTINCT FROM v_repasse_id;

  RETURN v_repasse_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_liquidate_payment(
  p_pagamento_id uuid,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.pagamentos_acordo%ROWTYPE;
  v_result public.pagamentos_acordo%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso reservado a administradores.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      SELECT subject_id INTO p_pagamento_id
      FROM public.rpc_idempotency
      WHERE idempotency_key = p_idempotency_key;
      RETURN p_pagamento_id;
    END IF;
  END IF;

  SELECT * INTO v_row
  FROM public.pagamentos_acordo
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.perfis p
    WHERE p.id = v_row.driver_id
      AND NULLIF(btrim(COALESCE(p.iban, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(p.iban_titular, '')), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Motorista sem IBAN ou titular configurado no perfil.';
  END IF;

  v_result := public._liquidate_pagamento_row(v_row, v_uid);

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'admin_liquidate_payment', v_result.id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_result.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_liquidate_period(
  p_mes_referencia date,
  p_driver_id uuid DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_mes date := date_trunc('month', COALESCE(p_mes_referencia, CURRENT_DATE))::date;
  v_row public.pagamentos_acordo%ROWTYPE;
  v_repasse_id uuid;
  v_repasse_ids uuid[] := '{}';
  v_count integer := 0;
  v_driver_ids uuid[];
  v_driver uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso reservado a administradores.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      RETURN jsonb_build_object(
        'mes_referencia', v_mes,
        'pagamentos_liquidados', 0,
        'repasses', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', rm.id,
            'driver_id', rm.driver_id,
            'valor_repasse_liquido_kz', rm.valor_repasse_liquido_kz,
            'num_pagamentos', rm.num_pagamentos
          ))
          FROM public.repasses_motorista rm
          WHERE rm.mes_referencia = v_mes
            AND (p_driver_id IS NULL OR rm.driver_id = p_driver_id)
        ), '[]'::jsonb),
        'idempotent_replay', true
      );
    END IF;
  END IF;

  IF p_driver_id IS NOT NULL THEN
    v_driver_ids := ARRAY[p_driver_id];
  ELSE
    SELECT ARRAY_AGG(DISTINCT pg.driver_id ORDER BY pg.driver_id)
    INTO v_driver_ids
    FROM public.pagamentos_acordo pg
    WHERE pg.mes_referencia = v_mes
      AND lower(pg.estado) = 'em_custodia';
  END IF;

  IF v_driver_ids IS NULL OR array_length(v_driver_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'mes_referencia', v_mes,
      'pagamentos_liquidados', 0,
      'repasses', '[]'::jsonb
    );
  END IF;

  FOREACH v_driver IN ARRAY v_driver_ids LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.perfis p
      WHERE p.id = v_driver
        AND NULLIF(btrim(COALESCE(p.iban, '')), '') IS NOT NULL
        AND NULLIF(btrim(COALESCE(p.iban_titular, '')), '') IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Motorista % sem IBAN ou titular configurado no perfil.', v_driver;
    END IF;

    FOR v_row IN
      SELECT * FROM public.pagamentos_acordo pg
      WHERE pg.driver_id = v_driver
        AND pg.mes_referencia = v_mes
        AND lower(pg.estado) = 'em_custodia'
      ORDER BY pg.created_at ASC
      FOR UPDATE
    LOOP
      PERFORM public._liquidate_pagamento_row(v_row, v_uid);
      v_count := v_count + 1;
    END LOOP;

    v_repasse_id := public._refresh_repasse_motorista(v_driver, v_mes, v_uid);
    IF v_repasse_id IS NOT NULL THEN
      v_repasse_ids := array_append(v_repasse_ids, v_repasse_id);
    END IF;
  END LOOP;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'admin_liquidate_period', v_mes, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'mes_referencia', v_mes,
    'pagamentos_liquidados', v_count,
    'repasses', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', rm.id,
        'driver_id', rm.driver_id,
        'iban_destino', rm.iban_destino,
        'gmv_kz', rm.gmv_kz,
        'valor_plataforma_kz', rm.valor_plataforma_kz,
        'valor_repasse_liquido_kz', rm.valor_repasse_liquido_kz,
        'num_pagamentos', rm.num_pagamentos
      ) ORDER BY rm.driver_id)
      FROM public.repasses_motorista rm
      WHERE rm.id = ANY(v_repasse_ids)
    ), '[]'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_due_reserva_expiry(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_due_reserva_expiry(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_due_reserva_expiry(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.reserva_ttl_hours() TO authenticated;
