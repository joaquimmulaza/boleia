-- Prova PostgreSQL — Regra 5 faltas (prazo passageiro + mês de desconto)
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION public._regra5_expect_sqlstate(p_label text, p_sql text, p_code text)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'FAIL %: devia falhar com %', p_label, p_code;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IS DISTINCT FROM p_code THEN
      RAISE EXCEPTION 'FAIL %: esperava %, obteve % — %', p_label, p_code, SQLSTATE, SQLERRM;
    END IF;
END;
$fn$;

\echo '=== Regra 5 — prazo passageiro (funções puras) ==='
DO $$
BEGIN
  IF public._passageiro_falta_aviso_valido(
    '2026-10-16'::date,
    '2026-10-15 21:00:00+01'::timestamptz
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: falta futura dentro do prazo devia ser válida';
  END IF;

  IF public._passageiro_falta_aviso_valido(
    '2026-10-16'::date,
    '2026-10-15 22:30:00+01'::timestamptz
  ) IS NOT FALSE THEN
    RAISE EXCEPTION 'FAIL-on-old: após 22:00 véspera devia ser inválido';
  END IF;

  IF public._passageiro_falta_aviso_valido(
    '2026-10-14'::date,
    '2026-10-15 08:00:00+01'::timestamptz
  ) IS NOT FALSE THEN
    RAISE EXCEPTION 'FAIL: data no passado devia ser inválida';
  END IF;

  IF public._passageiro_falta_aviso_valido(
    '2026-10-15'::date,
    '2026-10-15 08:00:00+01'::timestamptz
  ) IS NOT FALSE THEN
    RAISE EXCEPTION 'FAIL: falta para hoje devia ser inválida (BCF02)';
  END IF;

  RAISE NOTICE 'PASS: prazo passageiro (funções puras)';
END $$;

\echo '=== Regra 5 — fixture acordo + pagamentos ==='
DO $$
DECLARE
  v_driver uuid := 'f5111111-1111-4111-8111-111111111111';
  v_pax uuid := 'f5222222-2222-4222-8222-222222222222';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo uuid := 'f5444444-4444-4444-8444-444444444444';
  v_ap uuid := 'f5555555-5555-4555-8555-555555555555';
  v_pg_sep uuid := 'f5666666-6666-4666-8666-666666666666';
  v_pg_out uuid := 'f5777777-7777-4777-8777-777777777777';
  v_mes_sep date := '2026-09-01'::date;
  v_mes_out date := '2026-10-01'::date;
  v_row public.faltas%ROWTYPE;
  v_desconto_sep integer;
  v_desconto_out integer;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'regra5-driver@test'),
    (v_pax, 'regra5-pax@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'Regra5 Driver', '931000001', 'Motorista'),
    (v_pax, 'Regra5 Pax', '931000002', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'Proof', 'R5-001', 4, 3)
  RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    id, driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (
    gen_random_uuid(), v_driver, v_veiculo, true, '07:00', 3, 3, 'POR_PASSAGEIRO', 22000, 'disponivel'
  ) RETURNING id INTO v_oferta;

  INSERT INTO public.procuras (id, owner_id, preferred_time, n_candidato, estado)
  VALUES (gen_random_uuid(), v_pax, '07:30', 1, 'activa')
  RETURNING id INTO v_procura;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, dias_uteis_mes, estado
  ) VALUES (
    v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1,
    22000, 22000, 22, 'activo'
  );

  INSERT INTO public.acordos_passageiros (
    id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao
  ) VALUES (v_ap, v_acordo, v_pax, 'activo', 22000, 0);

  INSERT INTO public.pagamentos_acordo (
    id, acordo_passageiro_id, acordo_id, passenger_id, driver_id,
    valor_kz, valor_quota_original_kz, valor_payout_liquido_kz, take_rate_pct, mes_referencia, estado
  ) VALUES
    (v_pg_sep, v_ap, v_acordo, v_pax, v_driver, 22000, 22000, 19800, 0.10, v_mes_sep, 'liquidado'),
    (v_pg_out, v_ap, v_acordo, v_pax, v_driver, 22000, 22000, 19800, 0.10, v_mes_out, 'em_custodia');

  PERFORM set_config('session_replication_role', 'origin', true);

  PERFORM set_config('request.jwt.claim.sub', v_pax::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  PERFORM set_config('boleia.regra5_instant_override', '2026-10-15 12:00:00+01', true);

  SELECT * INTO v_row FROM public.log_falta(
    v_acordo, '2026-10-14'::date, 'Motorista', NULL, NULL, 'ambas'
  );
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'FAIL (a): motorista tipo Motorista ontem devia passar';
  END IF;

  SELECT * INTO v_row FROM public.log_falta(
    v_acordo, '2026-10-14'::date, 'Passageiro', NULL, v_pax, 'ambas'
  );
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'FAIL (b): motorista tipo Passageiro ontem devia passar';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_pax::text, true);
  PERFORM set_config('boleia.regra5_instant_override', '2026-10-15 12:00:00+01', true);

  PERFORM public._regra5_expect_sqlstate(
    '(c) passageiro falta para hoje',
    format(
      $q$SELECT public.log_falta(%L, '2026-10-15'::date, 'Passageiro', NULL, %L, 'ambas')$q$,
      v_acordo, v_pax
    ),
    'BCF02'
  );

  PERFORM set_config('boleia.regra5_instant_override', '2026-10-15 21:00:00+01', true);

  SELECT * INTO v_row FROM public.log_falta(
    v_acordo, '2026-10-16'::date, 'Passageiro', NULL, v_pax, 'ambas'
  );
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'FAIL (d) antes 22:00: passageiro amanhã devia passar';
  END IF;

  PERFORM set_config('boleia.regra5_instant_override', '2026-10-15 22:30:00+01', true);

  PERFORM public._regra5_expect_sqlstate(
    '(d) passageiro amanhã após 22:00 véspera',
    format(
      $q$SELECT public.log_falta(%L, '2026-10-16'::date, 'Passageiro', NULL, %L, 'ambas')$q$,
      v_acordo, v_pax
    ),
    'BCF02'
  );

  PERFORM set_config('boleia.regra5_instant_override', '2026-10-15 08:00:00+01', true);

  PERFORM public._regra5_expect_sqlstate(
    'passageiro data passada (BCF02)',
    format(
      $q$SELECT public.log_falta(%L, '2026-10-14'::date, 'Passageiro', NULL, %L, 'ambas')$q$,
      v_acordo, v_pax
    ),
    'BCF02'
  );

  PERFORM set_config('boleia.regra5_instant_override', '2026-10-15 21:00:00+01', true);

  SELECT * INTO v_row FROM public.log_falta(
    v_acordo, '2026-10-20'::date, 'Passageiro', NULL, v_pax, 'ambas'
  );

  IF v_row.desconto_kz <= 0 THEN
    RAISE EXCEPTION 'FAIL: falta passageiro válida devia ter desconto_kz > 0 (%)', v_row.desconto_kz;
  END IF;

  IF v_row.desconto_mes_referencia IS DISTINCT FROM v_mes_out THEN
    RAISE EXCEPTION 'FAIL: desconto_mes_referencia devia ser %, obteve %',
      v_mes_out, v_row.desconto_mes_referencia;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  PERFORM set_config('boleia.regra5_instant_override', '2026-10-20 12:00:00+01', true);

  SELECT * INTO v_row FROM public.log_falta(
    v_acordo, '2026-09-10'::date, 'Motorista', NULL, NULL, 'ambas'
  );

  IF v_row.desconto_kz <= 0 THEN
    RAISE EXCEPTION 'FAIL: falta motorista tardia devia ter desconto';
  END IF;

  IF v_row.desconto_mes_referencia IS DISTINCT FROM v_mes_out THEN
    RAISE EXCEPTION 'FAIL-on-old: crédito devia ir para %, obteve %',
      v_mes_out, v_row.desconto_mes_referencia;
  END IF;

  v_desconto_sep := public._desconto_faltas_pagamento(v_acordo, v_pax, v_mes_sep);
  v_desconto_out := public._desconto_faltas_pagamento(v_acordo, v_pax, v_mes_out);

  IF v_desconto_sep <> 0 THEN
    RAISE EXCEPTION 'FAIL-on-old: mês passado liquidado não devia descontar em % (=%)', v_mes_sep, v_desconto_sep;
  END IF;

  IF v_desconto_out <= 0 THEN
    RAISE EXCEPTION 'FAIL: desconto do mês corrente/crédito devia ser > 0 (%)', v_desconto_out;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_pax::text, true);
  PERFORM set_config('boleia.regra5_instant_override', '2026-10-15 12:00:00+01', true);

  SELECT * INTO v_row FROM public.log_falta(
    v_acordo, '2026-11-05'::date, 'Passageiro', NULL, v_pax, 'ambas'
  );

  IF v_row.desconto_mes_referencia IS DISTINCT FROM '2026-11-01'::date THEN
    RAISE EXCEPTION 'FAIL-on-old: falta Nov devia desconto_mes 2026-11-01, obteve %',
      v_row.desconto_mes_referencia;
  END IF;

  IF public._desconto_faltas_pagamento(v_acordo, v_pax, v_mes_out) <> v_desconto_out THEN
    RAISE EXCEPTION 'FAIL-on-old: falta Nov não devia alterar desconto Out (esperado %, obteve %)',
      v_desconto_out, public._desconto_faltas_pagamento(v_acordo, v_pax, v_mes_out);
  END IF;

  RESET ROLE;
  PERFORM set_config('session_replication_role', 'replica', true);
  INSERT INTO public.faltas (
    id_acordo, data_falta, tipo, passenger_id, viagem, desconto_kz, desconto_mes_referencia
  ) VALUES (
    v_acordo, '2026-09-08'::date, 'Passageiro', v_pax, 'ambas', 1000, v_mes_sep
  );
  PERFORM set_config('session_replication_role', 'origin', true);

  IF public._desconto_faltas_pagamento(v_acordo, v_pax, v_mes_out)
       <> v_desconto_out THEN
    RAISE EXCEPTION 'FAIL-on-old: falta passageiro Setembro (mes ref Set) inflacionou Out (Out=% vs %)',
      public._desconto_faltas_pagamento(v_acordo, v_pax, v_mes_out), v_desconto_out;
  END IF;

  PERFORM public._regra5_expect_sqlstate(
    'passageiro falta mês passado via RPC',
    format(
      $q$SELECT public.log_falta(%L, '2026-09-08'::date, 'Passageiro', NULL, %L, 'ambas')$q$,
      v_acordo, v_pax
    ),
    'BCF02'
  );

  RAISE NOTICE 'PASS: log_falta + _desconto_faltas_pagamento regra 5';
END $$;

\echo '=== Regra 5 — B2 legacy drop + preview RPC + sem desconto duplo ==='
DO $$
DECLARE
  v_driver uuid := 'f5111111-1111-4111-8111-111111111111';
  v_pax uuid := 'f5222222-2222-4222-8222-222222222222';
  v_acordo uuid := 'f5444444-4444-4444-8444-444444444444';
  v_pg_out uuid := 'f5777777-7777-4777-8777-777777777777';
  v_mes_out date := '2026-10-01'::date;
  v_outsider uuid := 'f5999999-9999-4999-8999-999999999999';
  v_admin uuid := 'f5888888-8888-4888-8888-888888888888';
  v_legacy_count integer;
  v_preview integer;
  v_esperado integer;
  v_legacy_sep_sum integer;
  v_row public.pagamentos_acordo%ROWTYPE;
  v_estado text;
BEGIN
  SELECT count(*)::integer INTO v_legacy_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'admin_liquidate_payment'
    AND pg_get_function_identity_arguments(p.oid) = 'p_pagamento_id uuid';

  IF v_legacy_count <> 0 THEN
    RAISE EXCEPTION 'FAIL B2: overload admin_liquidate_payment(uuid) ainda existe (%)', v_legacy_count;
  END IF;

  INSERT INTO auth.users (id, email) VALUES
    (v_outsider, 'regra5-outsider@test'),
    (v_admin, 'regra5-admin@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil, is_admin) VALUES
    (v_outsider, 'Outsider', '931000099', 'Passageiro', false),
    (v_admin, 'Admin', '931000098', 'Motorista', true)
  ON CONFLICT (id) DO UPDATE SET is_admin = EXCLUDED.is_admin;

  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  PERFORM set_config('request.jwt.claim.sub', v_pax::text, true);
  SET LOCAL ROLE authenticated;
  v_preview := public.get_desconto_faltas_preview(v_pg_out);
  v_esperado := public._desconto_faltas_pagamento(v_acordo, v_pax, v_mes_out);
  IF v_preview IS DISTINCT FROM v_esperado THEN
    RAISE EXCEPTION 'FAIL B3 pax: preview % != esperado %', v_preview, v_esperado;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  v_preview := public.get_desconto_faltas_preview(v_pg_out);
  IF v_preview IS DISTINCT FROM v_esperado THEN
    RAISE EXCEPTION 'FAIL B3 motorista: preview % != esperado %', v_preview, v_esperado;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_outsider::text, true);
  BEGIN
    PERFORM public.get_desconto_faltas_preview(v_pg_out);
    RAISE EXCEPTION 'FAIL B3: terceiro devia ser recusado';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT ILIKE '%permiss%' AND SQLERRM NOT ILIKE '%Sem permissão%' THEN
        RAISE;
      END IF;
  END;

  SELECT COALESCE(floor(COALESCE(SUM(f.desconto_kz), 0))::integer, 0)
  INTO v_legacy_sep_sum
  FROM public.faltas f
  WHERE f.id_acordo = v_acordo
    AND f.desconto_kz > 0
    AND date_trunc('month', f.data_falta)::date = v_mes_out
    AND (
      (lower(f.tipo) = 'passageiro' AND f.passenger_id = v_pax)
      OR lower(f.tipo) = 'motorista'
    );

  IF v_legacy_sep_sum = v_esperado THEN
    RAISE NOTICE 'SKIP B2 duplo: legacy sum igual ao novo neste fixture';
  ELSIF v_esperado <= 0 THEN
    RAISE EXCEPTION 'FAIL B2: esperado desconto Out devia ser > 0';
  END IF;

  IF v_legacy_sep_sum > 0 AND v_legacy_sep_sum <> v_esperado THEN
    RAISE NOTICE 'PASS B2: desconto_mes_referencia evita duplo (legacy por data_falta=% vs RPC=%)',
      v_legacy_sep_sum, v_esperado;
  END IF;

  RESET ROLE;

  UPDATE public.perfis
  SET iban = 'AO06004000000000000000000', iban_titular = 'Regra5 Driver'
  WHERE id = v_driver;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.admin_liquidate_payment(v_pg_out, NULL);

  RESET ROLE;
  SELECT desconto_faltas_kz, lower(estado)
  INTO v_preview, v_estado
  FROM public.pagamentos_acordo
  WHERE id = v_pg_out;

  IF v_estado <> 'liquidado' THEN
    RAISE EXCEPTION 'FAIL B2: admin_liquidate_payment devia liquidar pagamento Out';
  END IF;

  IF v_preview IS DISTINCT FROM v_esperado THEN
    RAISE EXCEPTION 'FAIL B2 liquidação: desconto_faltas_kz % != _desconto_faltas %',
      v_preview, v_esperado;
  END IF;

  RAISE NOTICE 'PASS: B2 legacy drop + preview RPC + liquidação alinhada';
END $$;

\echo '=== Regra 4 — falta Motorista só em lugar activo na data ==='
DO $$
DECLARE
  v_driver uuid := 'f5111111-1111-4111-8111-111111111111';
  v_pax uuid := 'f5222222-2222-4222-8222-222222222222';
  v_pax_late uuid := 'f5333333-3333-4333-8333-333333333333';
  v_acordo uuid := 'f5444444-4444-4444-8444-444444444444';
  v_ap uuid := 'f5555555-5555-4555-8555-555555555555';
  v_ap_late uuid := 'f5aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_pg_out uuid := 'f5777777-7777-4777-8777-777777777777';
  v_pg_late uuid := 'f5bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_mes_out date := '2026-10-01'::date;
  v_falta date := '2026-10-10'::date;
  v_desconto integer;
  v_has_r4 boolean := to_regprocedure(
    'public._passageiro_lugar_activo_em_data(uuid,uuid,date)'
  ) IS NOT NULL;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_pax_late, 'regra5-pax-late@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_pax_late, 'Regra5 Pax Late', '931000003', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  DELETE FROM public.faltas
  WHERE id_acordo = v_acordo
    AND COALESCE(desconto_mes_referencia, date_trunc('month', data_falta)::date) = v_mes_out;

  UPDATE public.acordos_passageiros
  SET
    estado = 'activo',
    saiu_em = NULL,
    lugar_rescisao_em = NULL,
    created_at = '2026-09-01 08:00:00+01'::timestamptz
  WHERE id = v_ap;

  UPDATE public.pagamentos_acordo
  SET validado_em = '2026-09-02 10:00:00+01'::timestamptz
  WHERE id = v_pg_out;

  INSERT INTO public.faltas (
    id_acordo, data_falta, tipo, passenger_id, viagem, desconto_kz, desconto_mes_referencia
  ) VALUES (
    v_acordo, v_falta, 'Motorista', NULL, 'ambas', 500, v_mes_out
  );

  v_desconto := public._desconto_faltas_pagamento(v_acordo, v_pax, v_mes_out);
  IF v_desconto <> 500 THEN
    IF v_has_r4 THEN
      RAISE EXCEPTION 'FAIL R4 activo: esperava 500, obteve %', v_desconto;
    ELSE
      RAISE EXCEPTION 'FAIL-on-old R4 activo: esperava 500, obteve %', v_desconto;
    END IF;
  END IF;

  UPDATE public.acordos_passageiros
  SET estado = 'saiu', saiu_em = '2026-10-08 12:00:00+01'::timestamptz
  WHERE id = v_ap;

  v_desconto := public._desconto_faltas_pagamento(v_acordo, v_pax, v_mes_out);
  IF v_desconto <> 0 THEN
    IF v_has_r4 THEN
      RAISE EXCEPTION 'FAIL R4 saiu antes: esperava 0, obteve %', v_desconto;
    ELSE
      RAISE EXCEPTION 'FAIL-on-old R4: motorista falta aplicada após saída (obteve %)', v_desconto;
    END IF;
  END IF;

  UPDATE public.acordos_passageiros
  SET estado = 'activo', saiu_em = NULL
  WHERE id = v_ap;

  DELETE FROM public.acordos_passageiros WHERE id = v_ap_late;
  DELETE FROM public.pagamentos_acordo WHERE id = v_pg_late;

  INSERT INTO public.acordos_passageiros (
    id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao, created_at
  ) VALUES (
    v_ap_late, v_acordo, v_pax_late, 'activo', 22000, 1,
    '2026-10-15 08:00:00+01'::timestamptz
  );

  INSERT INTO public.pagamentos_acordo (
    id, acordo_passageiro_id, acordo_id, passenger_id, driver_id,
    valor_kz, valor_quota_original_kz, valor_payout_liquido_kz, take_rate_pct,
    mes_referencia, estado, validado_em
  ) VALUES (
    v_pg_late, v_ap_late, v_acordo, v_pax_late, v_driver,
    22000, 22000, 19800, 0.10, v_mes_out, 'em_custodia',
    '2026-10-16 09:00:00+01'::timestamptz
  );

  v_desconto := public._desconto_faltas_pagamento(v_acordo, v_pax_late, v_mes_out);
  IF v_desconto <> 0 THEN
    IF v_has_r4 THEN
      RAISE EXCEPTION 'FAIL R4 entrou depois: esperava 0, obteve %', v_desconto;
    ELSE
      RAISE EXCEPTION 'FAIL-on-old R4 entrou depois: obteve %', v_desconto;
    END IF;
  END IF;

  UPDATE public.acordos_passageiros
  SET
    estado = 'saiu',
    saiu_em = '2026-10-12 12:00:00+01'::timestamptz
  WHERE id = v_ap;

  v_desconto := public._desconto_faltas_pagamento(v_acordo, v_pax, v_mes_out);
  IF v_desconto <> 500 THEN
    IF v_has_r4 THEN
      RAISE EXCEPTION 'FAIL R4 saiu depois: esperava 500, obteve %', v_desconto;
    ELSE
      RAISE EXCEPTION 'FAIL-on-old R4 saiu depois: esperava 500, obteve %', v_desconto;
    END IF;
  END IF;

  PERFORM set_config('session_replication_role', 'origin', true);

  RAISE NOTICE 'PASS: Regra 4 motorista × lugar activo (4 casos)';
END $$;
