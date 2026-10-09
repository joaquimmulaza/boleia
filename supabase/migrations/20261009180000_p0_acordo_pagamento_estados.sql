-- P0 — acordo × lugar × pagamento: estados, proporcional, anulado, prazo, idempotência confirmação

-- === Schema ===
ALTER TABLE public.pagamentos_acordo
  ADD COLUMN IF NOT EXISTS valor_quota_original_kz integer,
  ADD COLUMN IF NOT EXISTS valor_devido_kz integer,
  ADD COLUMN IF NOT EXISTS valor_pago_confirmado_kz integer,
  ADD COLUMN IF NOT EXISTS prazo_pagamento_em timestamptz,
  ADD COLUMN IF NOT EXISTS anulado_em timestamptz,
  ADD COLUMN IF NOT EXISTS anulacao_motivo text,
  ADD COLUMN IF NOT EXISTS requer_resolucao_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolucao_admin_motivo text;

ALTER TABLE public.acordos
  ADD COLUMN IF NOT EXISTS rescisao_confirmada_por uuid,
  ADD COLUMN IF NOT EXISTS rescisao_confirmada_em timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'acordos_rescisao_confirmada_por_fkey'
  ) THEN
    ALTER TABLE public.acordos
      ADD CONSTRAINT acordos_rescisao_confirmada_por_fkey
      FOREIGN KEY (rescisao_confirmada_por)
      REFERENCES public.perfis(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.pagamentos_acordo
  DROP CONSTRAINT IF EXISTS pagamentos_acordo_estado_check;

ALTER TABLE public.pagamentos_acordo
  ADD CONSTRAINT pagamentos_acordo_estado_check
  CHECK (
    lower(estado) = ANY (
      ARRAY[
        'pendente_pagamento'::text,
        'comprovativo_enviado'::text,
        'em_custodia'::text,
        'liquidado'::text,
        'reembolsado'::text,
        'anulado'::text
      ]
    )
  );

-- Backfill colunas novas (sem alterar valores históricos de quota no lugar)
UPDATE public.pagamentos_acordo pg
SET
  valor_quota_original_kz = COALESCE(pg.valor_quota_original_kz, pg.valor_kz),
  valor_devido_kz = COALESCE(pg.valor_devido_kz, pg.valor_kz)
WHERE pg.valor_quota_original_kz IS NULL OR pg.valor_devido_kz IS NULL;

UPDATE public.pagamentos_acordo pg
SET prazo_pagamento_em = ap.reservado_expira_em
FROM public.acordos_passageiros ap
WHERE ap.id = pg.acordo_passageiro_id
  AND pg.prazo_pagamento_em IS NULL
  AND ap.reservado_expira_em IS NOT NULL
  AND lower(ap.estado) IN ('reservado', 'expirado');

-- === Helpers proporcional (única fonte) ===
CREATE OR REPLACE FUNCTION public.count_dias_uteis_decorridos_mes(
  p_mes_inicio date,
  p_data_fim date
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM generate_series(p_mes_inicio, p_data_fim, interval '1 day') AS d
  WHERE EXTRACT(ISODOW FROM d) < 6;
$$;

CREATE OR REPLACE FUNCTION public.calc_quota_proporcional_kz(
  p_quota_original integer,
  p_dias_uteis_mes integer,
  p_data_fecho date
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_mes_inicio date;
  v_dias integer;
BEGIN
  IF p_quota_original IS NULL OR p_quota_original < 0 THEN
    RETURN 0;
  END IF;
  IF p_dias_uteis_mes IS NULL OR p_dias_uteis_mes < 1 THEN
    RAISE EXCEPTION 'Dias úteis do acordo inválidos.';
  END IF;

  v_mes_inicio := date_trunc('month', p_data_fecho)::date;
  v_dias := public.count_dias_uteis_decorridos_mes(v_mes_inicio, p_data_fecho);
  v_dias := LEAST(GREATEST(v_dias, 0), p_dias_uteis_mes);

  RETURN (
    ROUND(
      p_quota_original::numeric * v_dias::numeric / p_dias_uteis_mes::numeric,
      0
    )
  )::integer;
END;
$function$;

CREATE OR REPLACE FUNCTION public._valor_pago_efectivo_kz(p_pg public.pagamentos_acordo)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_estado text := lower(COALESCE(p_pg.estado, ''));
BEGIN
  IF v_estado IN ('em_custodia', 'liquidado') THEN
    RETURN COALESCE(
      p_pg.valor_pago_confirmado_kz,
      p_pg.valor_quota_original_kz,
      p_pg.valor_kz,
      0
    );
  END IF;
  IF v_estado = 'comprovativo_enviado' THEN
    RETURN COALESCE(p_pg.valor_kz, 0);
  END IF;
  RETURN 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public._anular_pagamento_sem_divida(
  p_pagamento_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    AND lower(estado) IN ('pendente_pagamento', 'comprovativo_enviado');
END;
$function$;

CREATE OR REPLACE FUNCTION public._expirar_lugar_reservado_sem_divida(
  p_acordo_passageiro_id uuid,
  p_motivo_anulacao text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pg_id uuid;
BEGIN
  UPDATE public.acordos_passageiros
  SET
    estado = 'expirado',
    reservado_expira_em = NULL
  WHERE id = p_acordo_passageiro_id
    AND lower(estado) = 'reservado';

  SELECT id INTO v_pg_id
  FROM public.pagamentos_acordo
  WHERE acordo_passageiro_id = p_acordo_passageiro_id
    AND mes_referencia = date_trunc('month', timezone('Africa/Luanda', now()))::date
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_pg_id IS NOT NULL THEN
    PERFORM public._anular_pagamento_sem_divida(v_pg_id, p_motivo_anulacao);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ajustar_obrigacao_pagamento_mes(
  p_acordo_passageiro_id uuid,
  p_data_fecho date,
  p_forcar_reservado_expirado boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ap public.acordos_passageiros%ROWTYPE;
  v_acordo public.acordos%ROWTYPE;
  v_pg public.pagamentos_acordo%ROWTYPE;
  v_mes date;
  v_quota_orig integer;
  v_devido integer;
  v_pago integer;
  v_restante integer;
  v_excesso integer;
BEGIN
  SELECT * INTO v_ap
  FROM public.acordos_passageiros
  WHERE id = p_acordo_passageiro_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO v_acordo FROM public.acordos WHERE id = v_ap.acordo_id;

  v_mes := date_trunc('month', p_data_fecho)::date;

  SELECT * INTO v_pg
  FROM public.pagamentos_acordo
  WHERE acordo_passageiro_id = p_acordo_passageiro_id
    AND mes_referencia = v_mes
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF lower(v_ap.estado) = 'reservado' AND p_forcar_reservado_expirado THEN
    PERFORM public._expirar_lugar_reservado_sem_divida(
      p_acordo_passageiro_id,
      'Reserva terminada sem activação'
    );
    RETURN;
  END IF;

  IF lower(v_ap.estado) = 'expirado'
     OR (lower(v_ap.estado) = 'reservado' AND NOT p_forcar_reservado_expirado) THEN
    RETURN;
  END IF;

  v_quota_orig := COALESCE(
    v_pg.valor_quota_original_kz,
    v_ap.quota_mensal_kz,
    v_pg.valor_kz
  );

  v_devido := public.calc_quota_proporcional_kz(
    v_quota_orig,
    COALESCE(v_acordo.dias_uteis_mes, 0),
    p_data_fecho
  );

  v_pago := public._valor_pago_efectivo_kz(v_pg);
  v_restante := GREATEST(0, v_devido - v_pago);
  v_excesso := GREATEST(0, v_pago - v_devido);

  UPDATE public.pagamentos_acordo
  SET
    valor_quota_original_kz = COALESCE(valor_quota_original_kz, v_quota_orig),
    valor_devido_kz = v_devido,
    valor_kz = CASE
      WHEN lower(estado) = 'anulado' THEN valor_kz
      WHEN v_excesso > 0 AND lower(estado) IN ('em_custodia', 'liquidado', 'comprovativo_enviado') THEN
        GREATEST(0, v_devido)
      ELSE v_restante
    END,
    requer_resolucao_admin = (
      v_excesso > 0
      AND lower(estado) IN ('em_custodia', 'liquidado', 'comprovativo_enviado')
    ),
    resolucao_admin_motivo = CASE
      WHEN v_excesso > 0 THEN
        COALESCE(
          resolucao_admin_motivo,
          'Excesso de ' || v_excesso::text || ' Kz após fim do acordo'
        )
      ELSE resolucao_admin_motivo
    END,
    updated_at = now()
  WHERE id = v_pg.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public._maybe_fechar_acordo_sem_lugares_vivos(p_acordo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_acordo public.acordos%ROWTYPE;
  v_vivos integer;
BEGIN
  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = p_acordo_id
  FOR UPDATE;

  IF NOT FOUND OR lower(v_acordo.estado) NOT IN ('activo', 'cancelamento_pendente') THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::integer INTO v_vivos
  FROM public.acordos_passageiros ap
  WHERE ap.acordo_id = p_acordo_id
    AND lower(ap.estado) IN ('activo', 'reservado');

  IF v_vivos = 0 THEN
    UPDATE public.acordos
    SET
      estado = 'cancelado',
      cancelado_em = COALESCE(cancelado_em, now())
    WHERE id = p_acordo_id
      AND lower(estado) IN ('activo', 'cancelamento_pendente');
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.build_ui_obrigacao_snapshot(p_pagamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pg public.pagamentos_acordo%ROWTYPE;
  v_ap public.acordos_passageiros%ROWTYPE;
  v_acordo public.acordos%ROWTYPE;
  v_mes date;
  v_hoje date := (timezone('Africa/Luanda', now()))::date;
  v_data_fecho date;
  v_dias integer;
  v_dias_mes integer;
  v_quota integer;
  v_proporcional integer;
  v_pago integer;
  v_valor integer;
BEGIN
  SELECT * INTO v_pg FROM public.pagamentos_acordo WHERE id = p_pagamento_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_ap FROM public.acordos_passageiros WHERE id = v_pg.acordo_passageiro_id;
  SELECT * INTO v_acordo FROM public.acordos WHERE id = v_pg.acordo_id;

  v_mes := COALESCE(v_pg.mes_referencia, date_trunc('month', v_hoje)::date);
  v_dias_mes := GREATEST(COALESCE(v_acordo.dias_uteis_mes, 0), 0);
  v_quota := COALESCE(v_pg.valor_quota_original_kz, v_ap.quota_mensal_kz, v_pg.valor_kz, 0);

  v_data_fecho := COALESCE(v_acordo.rescisao_effective_on, v_hoje);
  IF v_data_fecho < v_mes THEN
    v_data_fecho := v_hoje;
  END IF;

  IF v_dias_mes >= 1 THEN
    v_dias := public.count_dias_uteis_decorridos_mes(v_mes, v_data_fecho);
    v_dias := LEAST(GREATEST(v_dias, 0), v_dias_mes);
    v_proporcional := COALESCE(
      v_pg.valor_devido_kz,
      public.calc_quota_proporcional_kz(v_quota, v_dias_mes, v_data_fecho)
    );
  ELSE
    v_dias := 0;
    v_proporcional := COALESCE(v_pg.valor_devido_kz, v_quota);
  END IF;

  v_pago := public._valor_pago_efectivo_kz(v_pg);
  v_valor := GREATEST(0, v_proporcional - v_pago);

  IF lower(v_pg.estado) IN ('pendente_pagamento', 'comprovativo_enviado') THEN
    v_valor := GREATEST(0, COALESCE(v_pg.valor_kz, v_valor));
  END IF;

  RETURN jsonb_build_object(
    'dias', v_dias,
    'dias_mes', v_dias_mes,
    'mes', to_char(v_mes, 'YYYY-MM-DD'),
    'quota', v_quota,
    'proporcional', v_proporcional,
    'pago', v_pago,
    'valor', v_valor,
    'valor_em_divida', v_valor,
    'prazo', v_pg.prazo_pagamento_em
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_obrigacao_pagamento_passageiro(p_acordo_passageiro_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ap public.acordos_passageiros%ROWTYPE;
  v_pg public.pagamentos_acordo%ROWTYPE;
  v_mes date := date_trunc('month', timezone('Africa/Luanda', now()))::date;
  v_snap jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT * INTO v_ap FROM public.acordos_passageiros WHERE id = p_acordo_passageiro_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lugar não encontrado.';
  END IF;

  IF v_uid IS DISTINCT FROM v_ap.passenger_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.acordos a
      WHERE a.id = v_ap.acordo_id AND a.driver_id = v_uid
    ) AND NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'Sem permissão.';
    END IF;
  END IF;

  SELECT * INTO v_pg
  FROM public.pagamentos_acordo
  WHERE acordo_passageiro_id = p_acordo_passageiro_id
    AND mes_referencia = v_mes
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'pagamento', NULL,
      'lugar_estado', v_ap.estado,
      'obrigacao', NULL
    );
  END IF;

  v_snap := public.build_ui_obrigacao_snapshot(v_pg.id);

  RETURN jsonb_build_object(
    'pagamento', to_jsonb(v_pg),
    'lugar_estado', v_ap.estado,
    'obrigacao', v_snap
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_pagamentos_pendentes_motorista_acordo(p_acordo_id uuid)
RETURNS TABLE (
  passenger_id uuid,
  passenger_nome text,
  pagamento_id uuid,
  estado text,
  dias integer,
  dias_mes integer,
  mes date,
  quota integer,
  proporcional integer,
  pago integer,
  valor integer,
  valor_em_divida integer,
  prazo timestamptz,
  valor_comprovativo integer,
  excesso_kz integer,
  requer_resolucao_admin boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_driver uuid;
  v_mes date := date_trunc('month', timezone('Africa/Luanda', now()))::date;
  r record;
  v_snap jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT driver_id INTO v_driver FROM public.acordos WHERE id = p_acordo_id;
  IF v_driver IS NULL OR v_uid IS DISTINCT FROM v_driver THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;

  FOR r IN
    SELECT
      pg.id AS pagamento_id,
      pg.passenger_id,
      COALESCE(p.nome_completo, 'Passageiro') AS passenger_nome,
      pg.estado,
      pg.valor_kz,
      pg.requer_resolucao_admin
    FROM public.pagamentos_acordo pg
    JOIN public.acordos_passageiros ap ON ap.id = pg.acordo_passageiro_id
    LEFT JOIN public.perfis p ON p.id = pg.passenger_id
    WHERE pg.acordo_id = p_acordo_id
      AND pg.mes_referencia = v_mes
      AND lower(ap.estado) IN ('activo', 'saiu', 'reservado', 'expirado')
      AND lower(pg.estado) IN ('pendente_pagamento', 'comprovativo_enviado', 'em_custodia')
      AND (
        lower(pg.estado) <> 'em_custodia'
        OR pg.requer_resolucao_admin
      )
  LOOP
    v_snap := public.build_ui_obrigacao_snapshot(r.pagamento_id);
    passenger_id := r.passenger_id;
    passenger_nome := r.passenger_nome;
    pagamento_id := r.pagamento_id;
    estado := r.estado;
    dias := COALESCE((v_snap->>'dias')::integer, 0);
    dias_mes := COALESCE((v_snap->>'dias_mes')::integer, 0);
    mes := COALESCE((v_snap->>'mes')::date, v_mes);
    quota := COALESCE((v_snap->>'quota')::integer, 0);
    proporcional := COALESCE((v_snap->>'proporcional')::integer, 0);
    pago := COALESCE((v_snap->>'pago')::integer, 0);
    valor_em_divida := COALESCE((v_snap->>'valor_em_divida')::integer, (v_snap->>'valor')::integer, 0);
    valor := valor_em_divida;
    prazo := (v_snap->>'prazo')::timestamptz;
    valor_comprovativo := CASE
      WHEN lower(r.estado) = 'comprovativo_enviado' THEN COALESCE(r.valor_kz, 0)
      ELSE NULL
    END;
    requer_resolucao_admin := COALESCE(r.requer_resolucao_admin, false);
    excesso_kz := CASE
      WHEN COALESCE(r.requer_resolucao_admin, false) THEN GREATEST(
        0,
        COALESCE((v_snap->>'pago')::integer, 0) - COALESCE((v_snap->>'proporcional')::integer, 0)
      )
      ELSE NULL
    END;
    RETURN NEXT;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_pagamentos_resolucao_admin()
RETURNS SETOF public.pagamentos_acordo
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso reservado a administradores.';
  END IF;

  RETURN QUERY
  SELECT pg.*
  FROM public.pagamentos_acordo pg
  WHERE pg.requer_resolucao_admin = true
  ORDER BY pg.updated_at DESC;
END;
$function$;

-- === Trigger pagamento: quota original + prazo ===
CREATE OR REPLACE FUNCTION public.trg_acordos_passageiros_create_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_driver_id uuid;
  v_take_rate numeric := 0.10;
  v_mes date := date_trunc('month', timezone('Africa/Luanda', now()))::date;
BEGIN
  IF lower(COALESCE(NEW.estado, '')) NOT IN ('activo', 'reservado') THEN
    RETURN NEW;
  END IF;

  SELECT driver_id INTO v_driver_id
  FROM public.acordos
  WHERE id = NEW.acordo_id;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Acordo não encontrado para pagamento.';
  END IF;

  INSERT INTO public.pagamentos_acordo (
    acordo_id,
    acordo_passageiro_id,
    passenger_id,
    driver_id,
    valor_kz,
    valor_quota_original_kz,
    valor_devido_kz,
    take_rate_pct,
    valor_payout_liquido_kz,
    mes_referencia,
    prazo_pagamento_em
  ) VALUES (
    NEW.acordo_id,
    NEW.id,
    NEW.passenger_id,
    v_driver_id,
    NEW.quota_mensal_kz,
    NEW.quota_mensal_kz,
    NEW.quota_mensal_kz,
    v_take_rate,
    public.compute_payout_liquido_kz(NEW.quota_mensal_kz, v_take_rate),
    v_mes,
    CASE WHEN lower(NEW.estado) = 'reservado' THEN NEW.reservado_expira_em ELSE NULL END
  )
  ON CONFLICT (acordo_passageiro_id, mes_referencia) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- === Escopo lazy apply_due_* (B2: mass run só service_role / admin) ===
CREATE OR REPLACE FUNCTION public._p0_assert_lazy_apply_due_scope(p_acordo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := nullif(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF v_role = 'service_role' OR public.is_platform_admin() THEN
    RETURN;
  END IF;

  IF p_acordo_id IS NULL THEN
    RAISE EXCEPTION 'Sem permissão.'
      USING ERRCODE = '42501';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sem permissão.'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.acordos a
    WHERE a.id = p_acordo_id
      AND (
        a.driver_id = v_uid
        OR EXISTS (
          SELECT 1
          FROM public.acordos_passageiros ap
          WHERE ap.acordo_id = a.id
            AND ap.passenger_id = v_uid
        )
      )
  ) THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'Sem permissão.'
    USING ERRCODE = '42501';
END;
$function$;

-- === apply_due_reserva_expiry ===
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
  PERFORM public._p0_assert_lazy_apply_due_scope(p_acordo_id);

  FOR v_row IN
    SELECT ap.id, ap.acordo_id, ap.passenger_id, a.oferta_id, a.estado AS acordo_estado
    FROM public.acordos_passageiros ap
    JOIN public.acordos a ON a.id = ap.acordo_id
    WHERE lower(ap.estado) = 'reservado'
      AND ap.reservado_expira_em IS NOT NULL
      AND ap.reservado_expira_em <= now()
      AND (p_acordo_id IS NULL OR ap.acordo_id = p_acordo_id)
      AND lower(a.estado) IN ('activo', 'cancelamento_pendente', 'cancelado', 'cancelado_justificado')
      AND NOT EXISTS (
        SELECT 1
        FROM public.pagamentos_acordo pg
        WHERE pg.acordo_passageiro_id = ap.id
          AND lower(pg.estado) IN ('comprovativo_enviado', 'em_custodia', 'liquidado')
      )
    FOR UPDATE OF ap
  LOOP
    PERFORM public._expirar_lugar_reservado_sem_divida(
      v_row.id,
      'Prazo de reserva expirado'
    );

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

  -- Reservados pendurados em acordos já cancelados (sem TTL aplicável)
  FOR v_row IN
    SELECT ap.id, ap.acordo_id, a.oferta_id
    FROM public.acordos_passageiros ap
    JOIN public.acordos a ON a.id = ap.acordo_id
    WHERE lower(ap.estado) = 'reservado'
      AND lower(a.estado) IN ('cancelado', 'cancelado_justificado')
      AND (p_acordo_id IS NULL OR ap.acordo_id = p_acordo_id)
    FOR UPDATE OF ap
  LOOP
    PERFORM public._expirar_lugar_reservado_sem_divida(
      v_row.id,
      'Acordo terminado antes da activação'
    );
    v_count := v_count + 1;
  END LOOP;

  IF p_acordo_id IS NOT NULL THEN
    PERFORM public._maybe_fechar_acordo_sem_lugares_vivos(p_acordo_id);
  END IF;

  RETURN v_count;
END;
$function$;

-- === apply_due_agreement_terminations ===
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
  r record;
BEGIN
  PERFORM public._p0_assert_lazy_apply_due_scope(p_acordo_id);

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
    FOR r IN
      SELECT id, lower(estado) AS est
      FROM public.acordos_passageiros
      WHERE acordo_id = v_acordo.id
        AND lower(estado) IN ('activo', 'reservado')
      FOR UPDATE
    LOOP
      IF r.est = 'reservado' THEN
        PERFORM public._expirar_lugar_reservado_sem_divida(
          r.id,
          'Acordo terminado antes da activação'
        );
      ELSE
        UPDATE public.acordos_passageiros SET estado = 'saiu' WHERE id = r.id;
        PERFORM public.ajustar_obrigacao_pagamento_mes(
          r.id,
          v_today,
          false
        );
      END IF;
    END LOOP;

    UPDATE public.acordos
    SET
      estado = 'cancelado',
      cancelado_em = now()
    WHERE id = v_acordo.id;

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

-- === leave_passenger ===
CREATE OR REPLACE FUNCTION public.leave_passenger(
  p_acordo_id uuid,
  p_passenger_id uuid DEFAULT NULL::uuid,
  p_idempotency_key uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_target uuid;
  v_acordo public.acordos%ROWTYPE;
  v_row public.acordos_passageiros%ROWTYPE;
  v_hoje date := (timezone('Africa/Luanda', now()))::date;
  v_estado_antes text;
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

  v_target := COALESCE(p_passenger_id, v_uid);

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = p_acordo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  IF v_uid IS DISTINCT FROM v_target AND v_uid IS DISTINCT FROM v_acordo.driver_id THEN
    RAISE EXCEPTION 'Sem permissão para sair deste acordo.';
  END IF;

  SELECT * INTO v_row
  FROM public.acordos_passageiros
  WHERE acordo_id = p_acordo_id
    AND passenger_id = v_target
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Passageiro não pertence a este acordo.';
  END IF;

  IF lower(v_row.estado) NOT IN ('activo', 'reservado') THEN
    RAISE EXCEPTION 'Passageiro não está activo neste acordo.';
  END IF;

  v_estado_antes := lower(v_row.estado);

  IF v_estado_antes = 'reservado' THEN
    PERFORM public._expirar_lugar_reservado_sem_divida(
      v_row.id,
      'Saíste antes da activação do lugar'
    );
  ELSE
    UPDATE public.acordos_passageiros SET estado = 'saiu' WHERE id = v_row.id;
    PERFORM public.ajustar_obrigacao_pagamento_mes(v_row.id, v_hoje, false);
  END IF;

  PERFORM public._maybe_fechar_acordo_sem_lugares_vivos(p_acordo_id);
  PERFORM public.recount_oferta_vagas(v_acordo.oferta_id);

  BEGIN
    PERFORM public.promote_waitlist(v_acordo.oferta_id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Falha best-effort promote_waitlist na saída do acordo %: %',
        p_acordo_id, SQLERRM;
  END;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'leave_passenger', p_acordo_id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN p_acordo_id;
END;
$function$;

-- === admin_validate_payment ===
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
  v_acordo public.acordos%ROWTYPE;
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

  SELECT * INTO v_acordo FROM public.acordos WHERE id = v_row.acordo_id;

  IF p_aprovar THEN
    UPDATE public.pagamentos_acordo
    SET
      estado = 'em_custodia',
      validado_por = v_uid,
      validado_em = now(),
      rejeicao_motivo = NULL,
      valor_pago_confirmado_kz = COALESCE(valor_kz, valor_devido_kz),
      updated_at = now()
    WHERE id = p_pagamento_id;

    SELECT * INTO v_ap
    FROM public.acordos_passageiros
    WHERE id = v_row.acordo_passageiro_id
    FOR UPDATE;

    IF FOUND AND lower(v_ap.estado) = 'reservado' THEN
      IF lower(v_acordo.estado) IN ('activo', 'cancelamento_pendente') THEN
        UPDATE public.acordos_passageiros
        SET estado = 'activo', reservado_expira_em = NULL
        WHERE id = v_ap.id;

        SELECT oferta_id INTO v_oferta_id FROM public.acordos WHERE id = v_ap.acordo_id;
        IF v_oferta_id IS NOT NULL THEN
          PERFORM public.recount_oferta_vagas(v_oferta_id);
        END IF;
      ELSE
        UPDATE public.pagamentos_acordo
        SET
          requer_resolucao_admin = true,
          resolucao_admin_motivo = COALESCE(
            resolucao_admin_motivo,
            'Comprovativo validado após término do acordo'
          ),
          updated_at = now()
        WHERE id = p_pagamento_id;
      END IF;
    ELSIF FOUND AND lower(v_acordo.estado) IN ('cancelado', 'cancelado_justificado') THEN
      UPDATE public.pagamentos_acordo
      SET
        requer_resolucao_admin = true,
        resolucao_admin_motivo = COALESCE(
          resolucao_admin_motivo,
          'Comprovativo validado com acordo terminado'
        ),
        updated_at = now()
      WHERE id = p_pagamento_id;
      PERFORM public.ajustar_obrigacao_pagamento_mes(v_ap.id, (timezone('Africa/Luanda', now()))::date, false);
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

CREATE OR REPLACE FUNCTION public._p0_finalize_lugares_rescisao_imediata(
  p_acordo_id uuid,
  p_data_fecho date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, lower(estado) AS est
    FROM public.acordos_passageiros
    WHERE acordo_id = p_acordo_id
      AND lower(estado) IN ('activo', 'reservado')
    ORDER BY ordem_insercao ASC, passenger_id ASC
    FOR UPDATE
  LOOP
    IF r.est = 'reservado' THEN
      PERFORM public._expirar_lugar_reservado_sem_divida(
        r.id,
        'Acordo terminado antes da activação'
      );
    ELSE
      UPDATE public.acordos_passageiros SET estado = 'saiu' WHERE id = r.id;
      PERFORM public.ajustar_obrigacao_pagamento_mes(r.id, p_data_fecho, false);
    END IF;
  END LOOP;

  PERFORM public._maybe_fechar_acordo_sem_lugares_vivos(p_acordo_id);
END;
$function$;

-- terminate_agreement (P0: proporcional via ajustar_obrigacao, reservado→expirado, idempotência confirmação)
CREATE OR REPLACE FUNCTION public.terminate_agreement(
  p_acordo_id uuid,
  p_modo text,
  p_justificativa text DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL,
  p_vigencia text DEFAULT 'imediato'
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
  v_vigencia text;
  v_is_driver boolean;
  v_is_pax boolean;
  v_hoje date;
  v_mes_inicio date;
  v_effective date;
  v_dias_uteis integer;
  v_solicitante_is_driver boolean;
  v_confirma boolean := false;
  v_faltas_ok boolean := false;
  v_estado_final text;
  v_mensagem text;
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

  PERFORM public.apply_due_agreement_terminations(p_acordo_id);

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = p_acordo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  IF lower(COALESCE(v_modo, '')) = 'consensual'
     AND lower(COALESCE(v_acordo.rescisao_modo, '')) = 'consensual'
     AND v_acordo.rescisao_solicitada_por IS NOT NULL
     AND v_acordo.rescisao_solicitada_por IS DISTINCT FROM v_uid
     AND v_acordo.rescisao_confirmada_em IS NOT NULL
     AND (
       (
         lower(v_acordo.estado) = 'cancelamento_pendente'
         AND lower(COALESCE(v_acordo.rescisao_vigencia, '')) = 'fim_ciclo'
       )
       OR (
         lower(v_acordo.estado) IN ('cancelado', 'cancelado_justificado')
         AND lower(COALESCE(v_acordo.rescisao_vigencia, '')) = 'imediato'
       )
     ) THEN
    IF p_idempotency_key IS NOT NULL THEN
      INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
      VALUES (p_idempotency_key, 'terminate_agreement', p_acordo_id, v_uid)
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
    RETURN p_acordo_id;
  END IF;

  v_is_driver := (v_uid = v_acordo.driver_id);

  SELECT EXISTS (
    SELECT 1
    FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id
      AND ap.passenger_id = v_uid
      AND lower(ap.estado) IN ('activo', 'reservado')
  ) INTO v_is_pax;

  IF NOT v_is_driver AND NOT v_is_pax THEN
    RAISE EXCEPTION 'Sem permissão para rescindir este acordo.';
  END IF;

  v_hoje := (timezone('Africa/Luanda', now()))::date;
  v_mes_inicio := date_trunc('month', v_hoje)::date;
  v_effective := (date_trunc('month', v_hoje) + interval '1 month')::date;

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
      rescisao_vigencia = NULL,
      rescisao_effective_on = v_effective
    WHERE id = p_acordo_id;

    v_mensagem := 'A outra parte pediu a rescisão do acordo com aviso prévio; '
      || 'o acordo mantém-se activo até ao fim deste mês.';

  ELSIF v_modo = 'consensual' THEN
    IF lower(v_acordo.estado) <> 'activo' THEN
      RAISE EXCEPTION 'Este acordo já não está activo.';
    END IF;

    v_vigencia := lower(COALESCE(
      NULLIF(btrim(COALESCE(p_vigencia, '')), ''),
      NULLIF(btrim(COALESCE(v_acordo.rescisao_vigencia, '')), ''),
      'imediato'
    ));

    IF v_vigencia NOT IN ('imediato', 'fim_ciclo') THEN
      RAISE EXCEPTION 'Vigência inválida. Use imediato ou fim_ciclo.';
    END IF;

    IF lower(COALESCE(v_acordo.rescisao_modo, '')) = 'consensual'
       AND v_acordo.rescisao_solicitada_por IS NOT NULL
       AND v_acordo.rescisao_solicitada_por IS DISTINCT FROM v_uid THEN
      v_solicitante_is_driver :=
        (v_acordo.rescisao_solicitada_por = v_acordo.driver_id);

      v_confirma := (v_solicitante_is_driver AND v_is_pax)
        OR (NOT v_solicitante_is_driver AND v_is_driver);
    END IF;

    IF NOT v_confirma THEN
      IF lower(COALESCE(v_acordo.rescisao_modo, '')) = 'consensual'
         AND v_acordo.rescisao_solicitada_por = v_uid THEN
        UPDATE public.acordos
        SET
          rescisao_vigencia = v_vigencia,
          rescisao_justificativa = NULLIF(btrim(COALESCE(p_justificativa, '')), '')
        WHERE id = p_acordo_id;
      ELSE
        UPDATE public.acordos
        SET
          rescisao_modo = 'consensual',
          rescisao_solicitada_por = v_uid,
          rescisao_justificativa = NULLIF(btrim(COALESCE(p_justificativa, '')), ''),
          rescisao_vigencia = v_vigencia,
          rescisao_effective_on = NULL
        WHERE id = p_acordo_id;
      END IF;

      BEGIN
        INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
        SELECT
          t.user_id,
          CASE
            WHEN v_vigencia = 'fim_ciclo' THEN
              'A outra parte pediu encerramento amigável no fim deste mês — confirma em Acordos.'
            ELSE
              'A outra parte pediu encerramento amigável imediato (ajuste proporcional) — confirma em Acordos.'
          END,
          'warning',
          jsonb_build_object(
            'type', 'agreement_update',
            'acordo_id', p_acordo_id,
            'rescisao_modo', 'consensual',
            'rescisao_vigencia', v_vigencia
          )
        FROM (
          SELECT v_acordo.driver_id AS user_id
          UNION
          SELECT ap.passenger_id
          FROM public.acordos_passageiros ap
          WHERE ap.acordo_id = p_acordo_id
            AND lower(ap.estado) IN ('activo', 'reservado')
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

    v_vigencia := lower(COALESCE(
      NULLIF(btrim(COALESCE(v_acordo.rescisao_vigencia, '')), ''),
      'imediato'
    ));

    IF v_vigencia = 'fim_ciclo' THEN
      UPDATE public.acordos
      SET
        estado = 'cancelamento_pendente',
        rescisao_modo = 'consensual',
        rescisao_vigencia = 'fim_ciclo',
        rescisao_effective_on = v_effective,
        rescisao_confirmada_por = v_uid,
        rescisao_confirmada_em = now()
      WHERE id = p_acordo_id;

      v_mensagem := 'Encerramento amigável confirmado; o acordo mantém-se activo até ao fim deste mês.';
    ELSE
      v_dias_uteis := COALESCE(v_acordo.dias_uteis_mes, 0);
      IF v_dias_uteis < 1 THEN
        RAISE EXCEPTION 'Dias úteis do acordo inválidos para calcular a rescisão.';
      END IF;

      PERFORM public._p0_finalize_lugares_rescisao_imediata(p_acordo_id, v_hoje);

      PERFORM set_config('boleia.skip_acordo_cancel_notif', 'on', true);

      UPDATE public.acordos
      SET
        estado = 'cancelado',
        rescisao_modo = 'consensual',
        rescisao_vigencia = 'imediato',
        rescisao_effective_on = v_hoje,
        cancelado_em = now(),
        rescisao_confirmada_por = v_uid,
        rescisao_confirmada_em = now()
      WHERE id = p_acordo_id;

      PERFORM set_config('boleia.skip_acordo_cancel_notif', 'off', true);

      PERFORM public.recount_oferta_vagas(v_acordo.oferta_id);

      BEGIN
        PERFORM public.promote_waitlist(v_acordo.oferta_id);
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Falha best-effort promote_waitlist na rescisão do acordo %: %',
            p_acordo_id, SQLERRM;
      END;

      v_mensagem := 'A rescisão consensual foi confirmada; o acordo está encerrado com ajuste proporcional.';
    END IF;

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

    PERFORM public._p0_finalize_lugares_rescisao_imediata(p_acordo_id, v_hoje);

    UPDATE public.acordos
    SET
      estado = 'cancelado_justificado',
      rescisao_modo = 'justa_causa',
      rescisao_solicitada_por = v_uid,
      rescisao_justificativa = lower(btrim(p_justificativa)),
      rescisao_vigencia = NULL,
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

CREATE OR REPLACE FUNCTION public.apply_due_agreement_non_renewals(
  p_acordo_id uuid DEFAULT NULL::uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hoje date := (timezone('Africa/Luanda', now()))::date;
  v_mes_atual date := date_trunc('month', v_hoje)::date;
  v_acordo public.acordos%ROWTYPE;
  v_ultimo_mes date;
  v_applied integer := 0;
  r record;
BEGIN
  PERFORM public._p0_assert_lazy_apply_due_scope(p_acordo_id);

  PERFORM public.apply_due_agreement_terminations(p_acordo_id);

  FOR v_acordo IN
    SELECT a.*
    FROM public.acordos a
    WHERE lower(a.estado) = 'activo'
      AND (p_acordo_id IS NULL OR a.id = p_acordo_id)
      AND lower(COALESCE(a.renovacao_estado, '')) IS DISTINCT FROM 'renovado'
      AND lower(COALESCE(a.renovacao_estado, '')) IS DISTINCT FROM 'nao_renovar'
    ORDER BY a.created_at ASC
    FOR UPDATE
  LOOP
    SELECT COALESCE(MAX(pg.mes_referencia), date_trunc('month', v_acordo.created_at)::date)
    INTO v_ultimo_mes
    FROM public.pagamentos_acordo pg
    WHERE pg.acordo_id = v_acordo.id;

    IF v_mes_atual > v_ultimo_mes
       AND NOT EXISTS (
         SELECT 1 FROM public.pagamentos_acordo pg
         WHERE pg.acordo_id = v_acordo.id
           AND pg.mes_referencia = v_mes_atual
       ) THEN
      UPDATE public.acordos
      SET
        estado = 'cancelado',
        cancelado_em = now(),
        renovacao_estado = 'nao_renovar',
        rescisao_modo = 'nao_renovacao',
        rescisao_effective_on = v_mes_atual
      WHERE id = v_acordo.id;

      FOR r IN
        SELECT id, lower(estado) AS est
        FROM public.acordos_passageiros
        WHERE acordo_id = v_acordo.id
          AND lower(estado) IN ('activo', 'reservado')
        FOR UPDATE
      LOOP
        IF r.est = 'reservado' THEN
          PERFORM public._expirar_lugar_reservado_sem_divida(
            r.id,
            'Acordo terminado antes da activação'
          );
        ELSE
          UPDATE public.acordos_passageiros SET estado = 'saiu' WHERE id = r.id;
          PERFORM public.ajustar_obrigacao_pagamento_mes(r.id, v_hoje, false);
        END IF;
      END LOOP;

      PERFORM public._maybe_fechar_acordo_sem_lugares_vivos(v_acordo.id);
      PERFORM public.recount_oferta_vagas(v_acordo.oferta_id);

      BEGIN
        PERFORM public.promote_waitlist(v_acordo.oferta_id);
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Falha best-effort promote_waitlist na não-renovação %: %',
            v_acordo.id, SQLERRM;
      END;

      v_applied := v_applied + 1;
    END IF;
  END LOOP;

  FOR v_acordo IN
    SELECT a.*
    FROM public.acordos a
    WHERE lower(a.estado) = 'activo'
      AND lower(COALESCE(a.renovacao_estado, '')) = 'renovado'
      AND a.renovacao_proximo_mes IS NOT NULL
      AND a.renovacao_proximo_mes <= v_mes_atual
      AND (p_acordo_id IS NULL OR a.id = p_acordo_id)
    FOR UPDATE
  LOOP
    UPDATE public.acordos
    SET
      renovacao_estado = NULL,
      renovacao_proximo_mes = NULL,
      renovacao_por = NULL,
      renovacao_em = NULL
    WHERE id = v_acordo.id;

    v_applied := v_applied + 1;
  END LOOP;

  RETURN v_applied;
END;
$function$;

-- === B1/B3: helpers internos — só service_role (nunca authenticated/anon) ===
REVOKE ALL ON FUNCTION public._valor_pago_efectivo_kz(public.pagamentos_acordo) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._valor_pago_efectivo_kz(public.pagamentos_acordo) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._valor_pago_efectivo_kz(public.pagamentos_acordo) TO service_role;

REVOKE ALL ON FUNCTION public._anular_pagamento_sem_divida(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._anular_pagamento_sem_divida(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._anular_pagamento_sem_divida(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public._expirar_lugar_reservado_sem_divida(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._expirar_lugar_reservado_sem_divida(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._expirar_lugar_reservado_sem_divida(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.ajustar_obrigacao_pagamento_mes(uuid, date, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ajustar_obrigacao_pagamento_mes(uuid, date, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ajustar_obrigacao_pagamento_mes(uuid, date, boolean) TO service_role;

REVOKE ALL ON FUNCTION public._maybe_fechar_acordo_sem_lugares_vivos(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._maybe_fechar_acordo_sem_lugares_vivos(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._maybe_fechar_acordo_sem_lugares_vivos(uuid) TO service_role;

REVOKE ALL ON FUNCTION public._p0_finalize_lugares_rescisao_imediata(uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._p0_finalize_lugares_rescisao_imediata(uuid, date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._p0_finalize_lugares_rescisao_imediata(uuid, date) TO service_role;

REVOKE ALL ON FUNCTION public._p0_assert_lazy_apply_due_scope(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._p0_assert_lazy_apply_due_scope(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._p0_assert_lazy_apply_due_scope(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.build_ui_obrigacao_snapshot(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.build_ui_obrigacao_snapshot(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_ui_obrigacao_snapshot(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.trg_acordos_passageiros_create_pagamento() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_acordos_passageiros_create_pagamento() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_acordos_passageiros_create_pagamento() TO service_role;

REVOKE ALL ON FUNCTION public.count_dias_uteis_decorridos_mes(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calc_quota_proporcional_kz(integer, integer, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_obrigacao_pagamento_passageiro(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_pagamentos_pendentes_motorista_acordo(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_pagamentos_resolucao_admin() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.count_dias_uteis_decorridos_mes(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calc_quota_proporcional_kz(integer, integer, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_obrigacao_pagamento_passageiro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_pagamentos_pendentes_motorista_acordo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_pagamentos_resolucao_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.count_dias_uteis_decorridos_mes(date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calc_quota_proporcional_kz(integer, integer, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_obrigacao_pagamento_passageiro(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_pagamentos_pendentes_motorista_acordo(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_pagamentos_resolucao_admin() FROM anon;

REVOKE ALL ON FUNCTION public.apply_due_reserva_expiry(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_due_reserva_expiry(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_due_reserva_expiry(uuid) FROM anon;

REVOKE ALL ON FUNCTION public.apply_due_agreement_terminations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_due_agreement_terminations(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_due_agreement_terminations(uuid) FROM anon;

REVOKE ALL ON FUNCTION public.leave_passenger(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_passenger(uuid, uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.leave_passenger(uuid, uuid, uuid) FROM anon;

REVOKE ALL ON FUNCTION public.admin_validate_payment(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_validate_payment(uuid, boolean, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_validate_payment(uuid, boolean, text) FROM anon;

REVOKE ALL ON FUNCTION public.terminate_agreement(uuid, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.terminate_agreement(uuid, text, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.terminate_agreement(uuid, text, text, uuid, text) FROM anon;

REVOKE ALL ON FUNCTION public.apply_due_agreement_non_renewals(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_due_agreement_non_renewals(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_due_agreement_non_renewals(uuid) FROM anon;
