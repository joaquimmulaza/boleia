-- Prova P0 acordo × pagamento (funcional + segurança B1/B2/B3)
\set ON_ERROR_STOP on

\echo '=== P0 funcional (baseline) ==='
DO $$
DECLARE
  v integer;
BEGIN
  v := public.calc_quota_proporcional_kz(22000, 22, '2026-10-09'::date);
  IF v < 1 THEN
    RAISE EXCEPTION 'FAIL: calc_quota_proporcional_kz devolveu %', v;
  END IF;
  RAISE NOTICE 'PASS: calc_quota_proporcional_kz = %', v;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_obrigacao_pagamento_passageiro'
  ) THEN
    RAISE EXCEPTION 'FAIL: RPC get_obrigacao_pagamento_passageiro em falta';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pagamentos_acordo_estado_check'
  ) THEN
    RAISE EXCEPTION 'FAIL: CHECK estado pagamentos';
  END IF;
  RAISE NOTICE 'PASS: RPCs P0 + CHECK presentes';
END $$;

\echo '=== fail-on-old: privilégios helpers / snapshot ==='
DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.build_ui_obrigacao_snapshot(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL-on-old: authenticated EXECUTE build_ui_obrigacao_snapshot';
  END IF;
  IF has_function_privilege('authenticated', 'public._anular_pagamento_sem_divida(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL-on-old: authenticated EXECUTE _anular_pagamento_sem_divida';
  END IF;
  IF has_function_privilege('authenticated', 'public._p0_assert_lazy_apply_due_scope(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL-on-old: authenticated EXECUTE _p0_assert_lazy_apply_due_scope';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.apply_due_reserva_expiry(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL-on-old: authenticated sem EXECUTE apply_due_reserva_expiry';
  END IF;
  RAISE NOTICE 'PASS: fail-on-old privilégios OK';
END $$;

\echo '=== B1/B2/B3: runtime authenticated → 42501 (helpers + apply_due mass/foreign) ==='
CREATE OR REPLACE FUNCTION public._p0_pg_proof_expect_denied(p_label text, p_sql text)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'FAIL %: devia negar (42501)', p_label;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IS DISTINCT FROM '42501' THEN
      RAISE EXCEPTION 'FAIL %: esperava 42501, obteve % — %', p_label, SQLSTATE, SQLERRM;
    END IF;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public._p0_pg_proof_expect_denied(text, text) TO authenticated;

DO $$
DECLARE
  v_driver uuid := 'a1111111-1111-4111-8111-111111111111';
  v_pax uuid := 'a2222222-2222-4222-8222-222222222222';
  v_out uuid := 'a3333333-3333-4333-8333-333333333333';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo uuid := 'a4444444-4444-4444-8444-444444444444';
  v_ap uuid := 'a5555555-5555-4555-8555-555555555555';
  v_pg uuid := 'a6666666-6666-4666-8666-666666666666';
  v_pg_row public.pagamentos_acordo%ROWTYPE;
  v_mes date := date_trunc('month', current_date)::date;

BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'p0-proof-driver@test'),
    (v_pax, 'p0-proof-pax@test'),
    (v_out, 'p0-proof-out@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'Proof Driver', '921000001', 'Motorista'),
    (v_pax, 'Proof Pax', '921000002', 'Passageiro'),
    (v_out, 'Proof Out', '921000003', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'Proof', 'P0-001', 4, 3)
  RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    id, driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (
    gen_random_uuid(), v_driver, v_veiculo, true, '07:00', 3, 3, 'POR_PASSAGEIRO', 50000, 'disponivel'
  ) RETURNING id INTO v_oferta;

  INSERT INTO public.procuras (id, owner_id, preferred_time, n_candidato, estado)
  VALUES (gen_random_uuid(), v_pax, '07:30', 1, 'activa')
  RETURNING id INTO v_procura;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado
  ) VALUES (
    v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 50000, 50000, 'activo'
  );

  INSERT INTO public.acordos_passageiros (
    id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao
  ) VALUES (v_ap, v_acordo, v_pax, 'reservado', 50000, 0);

  INSERT INTO public.pagamentos_acordo (
    id, acordo_passageiro_id, acordo_id, passenger_id, driver_id,
    valor_kz, valor_quota_original_kz, valor_payout_liquido_kz, take_rate_pct, mes_referencia, estado
  ) VALUES (
    v_pg, v_ap, v_acordo, v_pax, v_driver,
    50000, 50000, 45000, 0.10, date_trunc('month', current_date)::date, 'pendente_pagamento'
  );

  SELECT * INTO v_pg_row FROM public.pagamentos_acordo WHERE id = v_pg;

  PERFORM set_config('session_replication_role', 'origin', true);

  PERFORM set_config('request.jwt.claim.sub', v_pax::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  PERFORM public._p0_pg_proof_expect_denied(
    '_valor_pago_efectivo_kz',
    format(
      'SELECT public._valor_pago_efectivo_kz(p) FROM public.pagamentos_acordo p WHERE p.id = %L',
      v_pg
    )
  );
  PERFORM public._p0_pg_proof_expect_denied(
    '_anular_pagamento_sem_divida',
    format('SELECT public._anular_pagamento_sem_divida(%L::uuid, %L)', v_ap, 'proof')
  );
  PERFORM public._p0_pg_proof_expect_denied(
    '_expirar_lugar_reservado_sem_divida',
    format('SELECT public._expirar_lugar_reservado_sem_divida(%L::uuid, %L)', v_ap, 'proof')
  );
  PERFORM public._p0_pg_proof_expect_denied(
    'ajustar_obrigacao_pagamento_mes',
    format(
      'SELECT public.ajustar_obrigacao_pagamento_mes(%L::uuid, %L::date, false)',
      v_ap,
      v_mes
    )
  );
  PERFORM public._p0_pg_proof_expect_denied(
    '_maybe_fechar_acordo_sem_lugares_vivos',
    format('SELECT public._maybe_fechar_acordo_sem_lugares_vivos(%L::uuid)', v_acordo)
  );
  PERFORM public._p0_pg_proof_expect_denied(
    '_p0_finalize_lugares_rescisao_imediata',
    format(
      'SELECT public._p0_finalize_lugares_rescisao_imediata(%L::uuid, %L::date)',
      v_acordo,
      current_date
    )
  );
  PERFORM public._p0_pg_proof_expect_denied(
    '_p0_assert_lazy_apply_due_scope',
    format('SELECT public._p0_assert_lazy_apply_due_scope(%L::uuid)', v_acordo)
  );
  PERFORM public._p0_pg_proof_expect_denied(
    'build_ui_obrigacao_snapshot',
    format('SELECT public.build_ui_obrigacao_snapshot(%L::uuid)', v_pg)
  );
  PERFORM public._p0_pg_proof_expect_denied(
    'trg_acordos_passageiros_create_pagamento',
    'SELECT public.trg_acordos_passageiros_create_pagamento()'
  );

  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_out::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  PERFORM public._p0_pg_proof_expect_denied(
    'apply_due_reserva_expiry(foreign)',
    format('SELECT public.apply_due_reserva_expiry(%L::uuid)', v_acordo)
  );
  PERFORM public._p0_pg_proof_expect_denied(
    'apply_due_agreement_terminations(foreign)',
    format('SELECT public.apply_due_agreement_terminations(%L::uuid)', v_acordo)
  );
  PERFORM public._p0_pg_proof_expect_denied(
    'apply_due_agreement_non_renewals(foreign)',
    format('SELECT public.apply_due_agreement_non_renewals(%L::uuid)', v_acordo)
  );

  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_pax::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.apply_due_reserva_expiry(v_acordo);
  RESET ROLE;

  RAISE NOTICE 'PASS: B1/B3 helpers negados; apply_due foreign → 42501; scope concreto próprio OK';
END $$;

\echo '=== B2: NULL autenticado filtra acordos (fail-on-old baea585: NULL outsider/global negava ou expunha tudo) ==='
DO $$
DECLARE
  v_driver_a uuid := 'b1111111-1111-4111-8111-111111111111';
  v_driver_b uuid := 'b2222222-2222-4222-8222-222222222222';
  v_pax_a uuid := 'b3333333-3333-4333-8333-333333333333';
  v_pax_b uuid := 'b4444444-4444-4444-8444-444444444444';
  v_out uuid := 'b5555555-5555-4555-8555-555555555555';
  v_veiculo_a uuid;
  v_veiculo_b uuid;
  v_oferta_a uuid;
  v_oferta_b uuid;
  v_procura_a uuid;
  v_procura_b uuid;
  v_acordo_a uuid := 'b6666666-6666-4666-8666-666666666666';
  v_acordo_b uuid := 'b7777777-7777-4777-8777-777777777777';
  v_ap_a uuid := 'b8888888-8888-4888-8888-888888888888';
  v_ap_b uuid := 'b9999999-9999-4999-8999-999999999999';
  v_est_a text;
  v_est_b text;
  v_n integer;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver_a, 'b2-driver-a@test'),
    (v_driver_b, 'b2-driver-b@test'),
    (v_pax_a, 'b2-pax-a@test'),
    (v_pax_b, 'b2-pax-b@test'),
    (v_out, 'b2-outsider@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver_a, 'Driver A', '923000001', 'Motorista'),
    (v_driver_b, 'Driver B', '923000002', 'Motorista'),
    (v_pax_a, 'Pax A', '923000003', 'Passageiro'),
    (v_pax_b, 'Pax B', '923000004', 'Passageiro'),
    (v_out, 'Outsider', '923000005', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver_a, 'B2-A', 'B2-A', 4, 3)
  RETURNING id INTO v_veiculo_a;
  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver_b, 'B2-B', 'B2-B', 4, 3)
  RETURNING id INTO v_veiculo_b;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (
    v_driver_a, v_veiculo_a, true, '07:00', 3, 3, 'POR_PASSAGEIRO', 50000, 'disponivel'
  ) RETURNING id INTO v_oferta_a;
  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (
    v_driver_b, v_veiculo_b, true, '08:00', 3, 3, 'POR_PASSAGEIRO', 50000, 'disponivel'
  ) RETURNING id INTO v_oferta_b;

  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax_a, '07:30', 1, 'activa') RETURNING id INTO v_procura_a;
  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax_b, '08:30', 1, 'activa') RETURNING id INTO v_procura_b;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado
  ) VALUES (
    v_acordo_a, v_oferta_a, v_procura_a, v_driver_a, 'POR_PASSAGEIRO', 1, 50000, 50000, 'activo'
  );
  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado
  ) VALUES (
    v_acordo_b, v_oferta_b, v_procura_b, v_driver_b, 'POR_PASSAGEIRO', 1, 50000, 50000, 'activo'
  );

  INSERT INTO public.acordos_passageiros (
    id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao, reservado_expira_em
  ) VALUES (
    v_ap_a, v_acordo_a, v_pax_a, 'reservado', 50000, 0, now() - interval '2 hours'
  );
  INSERT INTO public.acordos_passageiros (
    id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao, reservado_expira_em
  ) VALUES (
    v_ap_b, v_acordo_b, v_pax_b, 'reservado', 50000, 0, now() - interval '2 hours'
  );

  PERFORM set_config('session_replication_role', 'origin', true);

  PERFORM set_config('request.jwt.claim.sub', v_out::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  v_n := public.apply_due_reserva_expiry(NULL);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'FAIL B2: outsider NULL devia 0 linhas, obteve %', v_n;
  END IF;
  RESET ROLE;

  SELECT lower(estado) INTO v_est_a FROM public.acordos_passageiros WHERE id = v_ap_a;
  SELECT lower(estado) INTO v_est_b FROM public.acordos_passageiros WHERE id = v_ap_b;
  IF v_est_a <> 'reservado' OR v_est_b <> 'reservado' THEN
    RAISE EXCEPTION 'FAIL B2: outsider NULL alterou estados (% / %)', v_est_a, v_est_b;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_driver_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('session_replication_role', 'replica', true);
  v_n := public.apply_due_reserva_expiry(NULL);
  PERFORM set_config('session_replication_role', 'origin', true);
  IF v_n < 1 THEN
    RAISE EXCEPTION 'FAIL B2: driver A NULL devia expirar >=1, obteve %', v_n;
  END IF;

  SELECT lower(estado) INTO v_est_a FROM public.acordos_passageiros WHERE id = v_ap_a;
  SELECT lower(estado) INTO v_est_b FROM public.acordos_passageiros WHERE id = v_ap_b;
  IF v_est_a <> 'expirado' THEN
    RAISE EXCEPTION 'FAIL B2: acordo A devia expirado, obteve %', v_est_a;
  END IF;
  IF v_est_b <> 'reservado' THEN
    RAISE EXCEPTION 'FAIL B2: acordo B bloqueado — devia reservado, obteve % (v_blocked)', v_est_b;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_driver_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.apply_due_reserva_expiry(v_acordo_b);
    RAISE EXCEPTION 'FAIL B2: driver A com id acordo B devia 42501';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLSTATE IS DISTINCT FROM '42501' THEN
        RAISE;
      END IF;
  END;
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM set_config('session_replication_role', 'replica', true);
  v_n := public.apply_due_reserva_expiry(NULL);
  PERFORM set_config('session_replication_role', 'origin', true);
  IF v_n < 1 THEN
    RAISE EXCEPTION 'FAIL B2: service_role NULL devia expirar B pendente, obteve %', v_n;
  END IF;

  SELECT lower(estado) INTO v_est_b FROM public.acordos_passageiros WHERE id = v_ap_b;
  IF v_est_b <> 'expirado' THEN
    RAISE EXCEPTION 'FAIL B2: service_role NULL devia expirar B, obteve %', v_est_b;
  END IF;

  RAISE NOTICE 'PASS B2: NULL scoped (A só A; outsider 0; foreign 42501; service_role global)';
END $$;

\echo '=== BL1/BL2: ajustar_obrigacao_pagamento_mes (valor_kz bloqueado + payout) ==='
DO $$
DECLARE
  v_driver uuid := 'c1111111-1111-4111-8111-111111111111';
  v_pax uuid := 'c2222222-2222-4222-8222-222222222222';
  v_admin uuid := 'c3333333-3333-4333-8333-333333333333';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo uuid := 'c4444444-4444-4444-8444-444444444444';
  v_pax_cust uuid := 'c5555555-5555-4555-8555-555555555555';
  v_pax_pend uuid := 'c6666666-6666-4666-8666-666666666666';
  v_pax_liq uuid := 'c9999999-9999-4999-8999-999999999999';
  v_ap uuid := 'c7777777-7777-4777-8777-777777777777';
  v_ap_cust uuid := 'c8888888-8888-4888-8888-888888888888';
  v_ap_pend uuid := 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_ap_liq uuid := 'cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_pg_comp uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  v_pg_pend uuid := 'cddddddd-dddd-4ddd-8ddd-dddddddddddd';
  v_pg_cust uuid := 'ceeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  v_pg_liq uuid := 'cfffffff-ffff-4fff-8fff-ffffffffffff';
  v_fecho date := '2026-10-09';
  v_mes date := '2026-10-01';
  v_devido integer := 7000;
  v_vk integer;
  v_vd integer;
  v_flag boolean;
  v_conf integer;
  v_payout integer;
  v_exp_payout integer;
  v_n_admin integer;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'bl1-driver@test'),
    (v_pax, 'bl1-pax@test'),
    (v_pax_cust, 'bl1-pax-cust@test'),
    (v_pax_pend, 'bl1-pax-pend@test'),
    (v_pax_liq, 'bl1-pax-liq@test'),
    (v_admin, 'bl1-admin@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil, is_admin) VALUES
    (v_driver, 'BL Driver', '924000001', 'Motorista', false),
    (v_pax, 'BL Pax', '924000002', 'Passageiro', false),
    (v_pax_cust, 'BL Cust', '924000003', 'Passageiro', false),
    (v_pax_pend, 'BL Pend', '924000004', 'Passageiro', false),
    (v_pax_liq, 'BL Liq', '924000005', 'Passageiro', false),
    (v_admin, 'BL Admin', '924000006', 'Passageiro', true)
  ON CONFLICT (id) DO UPDATE SET is_admin = EXCLUDED.is_admin;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'BL', 'BL-1', 4, 3) RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (v_driver, v_veiculo, true, '07:00', 3, 3, 'POR_PASSAGEIRO', 22000, 'disponivel')
  RETURNING id INTO v_oferta;

  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax, '07:30', 1, 'activa') RETURNING id INTO v_procura;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes,
    rescisao_effective_on
  ) VALUES (
    v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 22000, 22000, 'activo', 22,
    v_fecho
  );

  INSERT INTO public.acordos_passageiros (
    id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao
  ) VALUES
    (v_ap, v_acordo, v_pax, 'activo', 22000, 0),
    (v_ap_cust, v_acordo, v_pax_cust, 'activo', 22000, 1),
    (v_ap_pend, v_acordo, v_pax_pend, 'activo', 22000, 2),
    (v_ap_liq, v_acordo, v_pax_liq, 'activo', 22000, 3);

  v_exp_payout := public.compute_payout_liquido_kz(v_devido, 0.10);

  INSERT INTO public.pagamentos_acordo (
    id, acordo_id, acordo_passageiro_id, passenger_id, driver_id,
    valor_kz, valor_devido_kz, valor_quota_original_kz, take_rate_pct, valor_payout_liquido_kz,
    estado, comprovativo_path, comprovativo_enviado_em, mes_referencia
  ) VALUES (
    v_pg_comp, v_acordo, v_ap, v_pax, v_driver,
    22000, 22000, 22000, 0.10, 19800,
    'comprovativo_enviado', 'proof/bl1.jpg', now(), v_mes
  );

  INSERT INTO public.pagamentos_acordo (
    id, acordo_id, acordo_passageiro_id, passenger_id, driver_id,
    valor_kz, valor_devido_kz, valor_quota_original_kz, take_rate_pct, valor_payout_liquido_kz,
    estado, mes_referencia
  ) VALUES (
    v_pg_pend, v_acordo, v_ap_pend, v_pax_pend, v_driver,
    22000, 22000, 22000, 0.10, 19800,
    'pendente_pagamento', v_mes
  );

  INSERT INTO public.pagamentos_acordo (
    id, acordo_id, acordo_passageiro_id, passenger_id, driver_id,
    valor_kz, valor_devido_kz, valor_quota_original_kz, take_rate_pct, valor_payout_liquido_kz,
    estado, valor_pago_confirmado_kz, mes_referencia
  ) VALUES (
    v_pg_cust, v_acordo, v_ap_cust, v_pax_cust, v_driver,
    22000, 22000, 22000, 0.10, 19800,
    'em_custodia', 22000, v_mes
  );

  INSERT INTO public.pagamentos_acordo (
    id, acordo_id, acordo_passageiro_id, passenger_id, driver_id,
    valor_kz, valor_devido_kz, valor_quota_original_kz, take_rate_pct, valor_payout_liquido_kz,
    estado, valor_pago_confirmado_kz, liquidado_em, mes_referencia
  ) VALUES (
    v_pg_liq, v_acordo, v_ap_liq, v_pax_liq, v_driver,
    22000, 22000, 22000, 0.10, 19800,
    'liquidado', 22000, now(), v_mes
  );

  PERFORM set_config('session_replication_role', 'origin', true);

  PERFORM public.ajustar_obrigacao_pagamento_mes(v_ap, v_fecho, false);

  SELECT valor_kz, valor_devido_kz, requer_resolucao_admin
  INTO v_vk, v_vd, v_flag
  FROM public.pagamentos_acordo WHERE id = v_pg_comp;

  IF v_vk <> 22000 THEN
    RAISE EXCEPTION 'FAIL BL1a: valor_kz comprovativo devia 22000, obteve %', v_vk;
  END IF;
  IF v_vd <> v_devido THEN
    RAISE EXCEPTION 'FAIL BL1a: valor_devido_kz devia %, obteve %', v_devido, v_vd;
  END IF;
  IF NOT v_flag THEN
    RAISE EXCEPTION 'FAIL BL1a: requer_resolucao_admin devia true (excesso 15000)';
  END IF;

  PERFORM public.ajustar_obrigacao_pagamento_mes(v_ap, v_fecho, false);

  SELECT valor_kz, valor_devido_kz, requer_resolucao_admin
  INTO v_vk, v_vd, v_flag
  FROM public.pagamentos_acordo WHERE id = v_pg_comp;

  IF v_vk <> 22000 OR v_vd <> v_devido OR NOT v_flag THEN
    RAISE EXCEPTION 'FAIL BL1d: segunda passagem idempotente falhou (% / % / %)', v_vk, v_vd, v_flag;
  END IF;

  PERFORM public.ajustar_obrigacao_pagamento_mes(v_ap_cust, v_fecho, false);
  SELECT valor_kz INTO v_vk FROM public.pagamentos_acordo WHERE id = v_pg_cust;
  IF v_vk <> 22000 THEN
    RAISE EXCEPTION 'FAIL BL1c: em_custodia valor_kz devia 22000, obteve %', v_vk;
  END IF;

  PERFORM public.ajustar_obrigacao_pagamento_mes(v_ap_liq, v_fecho, false);
  SELECT valor_kz INTO v_vk FROM public.pagamentos_acordo WHERE id = v_pg_liq;
  IF v_vk <> 22000 THEN
    RAISE EXCEPTION 'FAIL BL1c: liquidado valor_kz devia 22000, obteve %', v_vk;
  END IF;

  PERFORM public.ajustar_obrigacao_pagamento_mes(v_ap_pend, v_fecho, false);

  SELECT valor_kz, valor_payout_liquido_kz
  INTO v_vk, v_payout
  FROM public.pagamentos_acordo WHERE id = v_pg_pend;

  IF v_vk <> v_devido THEN
    RAISE EXCEPTION 'FAIL BL2: pendente valor_kz devia %, obteve %', v_devido, v_vk;
  END IF;
  IF v_payout <> v_exp_payout THEN
    RAISE EXCEPTION 'FAIL BL2: payout devia %, obteve %', v_exp_payout, v_payout;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', format('{"role":"authenticated","sub":"%s"}', v_admin), true);
  SET LOCAL ROLE authenticated;
  PERFORM public.admin_validate_payment(v_pg_comp, true, NULL);
  RESET ROLE;

  SELECT valor_pago_confirmado_kz, requer_resolucao_admin, valor_kz
  INTO v_conf, v_flag, v_vk
  FROM public.pagamentos_acordo WHERE id = v_pg_comp;

  IF v_conf <> 22000 THEN
    RAISE EXCEPTION 'FAIL BL1b: confirmado devia 22000, obteve %', v_conf;
  END IF;
  IF NOT v_flag THEN
    RAISE EXCEPTION 'FAIL BL1b: requer_resolucao_admin devia permanecer true após validação';
  END IF;
  IF v_vk <> 22000 THEN
    RAISE EXCEPTION 'FAIL BL1b: valor_kz devia manter 22000 após validação, obteve %', v_vk;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  SELECT COUNT(*)::integer INTO v_n_admin
  FROM public.list_pagamentos_resolucao_admin() WHERE id = v_pg_comp;
  RESET ROLE;

  IF v_n_admin <> 1 THEN
    RAISE EXCEPTION 'FAIL BL1b: fila admin devia incluir pagamento, count=%', v_n_admin;
  END IF;

  RAISE NOTICE 'PASS BL1/BL2: valor_kz protegido, devido/payout/ admin OK';
END $$;

\echo '=== BL4: repasse proporcional (excesso pago não liquida mês inteiro) ==='
DO $$
DECLARE
  v_driver uuid := 'd1111111-1111-4111-8111-111111111111';
  v_pax uuid := 'd2222222-2222-4222-8222-222222222222';
  v_admin uuid := 'd3333333-3333-4333-8333-333333333333';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo uuid := 'd4444444-4444-4444-8444-444444444444';
  v_ap uuid := 'd7777777-7777-4777-8777-777777777777';
  v_pg_cust uuid := 'deeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  v_fecho date := '2026-10-09';
  v_mes date := '2026-10-01';
  v_devido integer := 7000;
  v_repasse integer;
  v_gmv integer;
  v_payout integer;
  v_repasse_id uuid;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'bl4-driver@test'),
    (v_pax, 'bl4-pax@test'),
    (v_admin, 'bl4-admin@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil, is_admin, iban, iban_titular) VALUES
    (v_driver, 'BL4 Driver', '925000001', 'Motorista', false, 'AO06000000000000000000001', 'Motorista BL4'),
    (v_pax, 'BL4 Pax', '925000002', 'Passageiro', false, NULL, NULL),
    (v_admin, 'BL4 Admin', '925000003', 'Passageiro', true, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET
    is_admin = EXCLUDED.is_admin,
    iban = EXCLUDED.iban,
    iban_titular = EXCLUDED.iban_titular;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'BL4', 'BL4-1', 4, 3) RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (v_driver, v_veiculo, true, '07:00', 3, 3, 'POR_PASSAGEIRO', 22000, 'disponivel')
  RETURNING id INTO v_oferta;

  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax, '07:30', 1, 'activa') RETURNING id INTO v_procura;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes,
    rescisao_effective_on
  ) VALUES (
    v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 22000, 22000, 'activo', 22,
    v_fecho
  );

  INSERT INTO public.acordos_passageiros (
    id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao
  ) VALUES (v_ap, v_acordo, v_pax, 'activo', 22000, 0);

  INSERT INTO public.pagamentos_acordo (
    id, acordo_id, acordo_passageiro_id, passenger_id, driver_id,
    valor_kz, valor_devido_kz, valor_quota_original_kz, take_rate_pct, valor_payout_liquido_kz,
    estado, valor_pago_confirmado_kz, requer_resolucao_admin, mes_referencia
  ) VALUES (
    v_pg_cust, v_acordo, v_ap, v_pax, v_driver,
    22000, 22000, 22000, 0.10, 19800,
    'em_custodia', 22000, true, v_mes
  );

  PERFORM set_config('session_replication_role', 'origin', true);

  PERFORM public.ajustar_obrigacao_pagamento_mes(v_ap, v_fecho, false);

  SELECT valor_payout_liquido_kz INTO v_payout
  FROM public.pagamentos_acordo WHERE id = v_pg_cust;
  IF v_payout <> 6300 THEN
    RAISE EXCEPTION 'FAIL BL4a: payout custódia devia 6300, obteve % (v_blocked)', v_payout;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.admin_liquidate_payment(v_pg_cust, NULL);
  RESET ROLE;

  SELECT valor_repasse_kz INTO v_repasse FROM public.pagamentos_acordo WHERE id = v_pg_cust;
  IF v_repasse <> 6300 THEN
    RAISE EXCEPTION 'FAIL BL4a: valor_repasse_kz devia 6300, obteve % (v_blocked)', v_repasse;
  END IF;

  SELECT gmv_kz INTO v_gmv
  FROM public.repasses_motorista
  WHERE driver_id = v_driver AND mes_referencia = v_mes;
  IF v_gmv <> v_devido THEN
    RAISE EXCEPTION 'FAIL BL4a: receita GMV devia %, obteve % (v_blocked)', v_devido, v_gmv;
  END IF;

  RAISE NOTICE 'PASS BL4a: custódia flagada liquida repasse 6300 e GMV 7000';
END $$;

DO $$
DECLARE
  v_driver uuid := 'e1111111-1111-4111-8111-111111111111';
  v_pax uuid := 'e2222222-2222-4222-8222-222222222222';
  v_admin uuid := 'e3333333-3333-4333-8333-333333333333';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo uuid := 'e4444444-4444-4444-8444-444444444444';
  v_ap uuid := 'e7777777-7777-4777-8777-777777777777';
  v_pg_comp uuid := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  v_fecho date := '2026-10-09';
  v_mes date := '2026-10-01';
  v_devido integer := 7000;
  v_repasse integer;
  v_gmv integer;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'bl4b-driver@test'),
    (v_pax, 'bl4b-pax@test'),
    (v_admin, 'bl4b-admin@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil, is_admin, iban, iban_titular) VALUES
    (v_driver, 'BL4b Driver', '926000001', 'Motorista', false, 'AO06000000000000000000002', 'Motorista BL4b'),
    (v_pax, 'BL4b Pax', '926000002', 'Passageiro', false, NULL, NULL),
    (v_admin, 'BL4b Admin', '926000003', 'Passageiro', true, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET
    iban = EXCLUDED.iban,
    iban_titular = EXCLUDED.iban_titular;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'BL4b', 'BL4-2', 4, 3) RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (v_driver, v_veiculo, true, '07:00', 3, 3, 'POR_PASSAGEIRO', 22000, 'disponivel')
  RETURNING id INTO v_oferta;

  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax, '07:30', 1, 'activa') RETURNING id INTO v_procura;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes,
    rescisao_effective_on
  ) VALUES (
    v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 22000, 22000, 'activo', 22,
    v_fecho
  );

  INSERT INTO public.acordos_passageiros (
    id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao
  ) VALUES (v_ap, v_acordo, v_pax, 'activo', 22000, 0);

  INSERT INTO public.pagamentos_acordo (
    id, acordo_id, acordo_passageiro_id, passenger_id, driver_id,
    valor_kz, valor_devido_kz, valor_quota_original_kz, take_rate_pct, valor_payout_liquido_kz,
    estado, comprovativo_path, comprovativo_enviado_em, mes_referencia
  ) VALUES (
    v_pg_comp, v_acordo, v_ap, v_pax, v_driver,
    22000, 22000, 22000, 0.10, 19800,
    'comprovativo_enviado', 'proof/bl4b.jpg', now(), v_mes
  );

  PERFORM set_config('session_replication_role', 'origin', true);

  PERFORM public.ajustar_obrigacao_pagamento_mes(v_ap, v_fecho, false);

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.admin_validate_payment(v_pg_comp, true, NULL);
  PERFORM public.admin_liquidate_payment(v_pg_comp, NULL);
  RESET ROLE;

  SELECT valor_repasse_kz INTO v_repasse FROM public.pagamentos_acordo WHERE id = v_pg_comp;
  IF v_repasse <> 6300 THEN
    RAISE EXCEPTION 'FAIL BL4b: valor_repasse_kz devia 6300, obteve % (v_blocked)', v_repasse;
  END IF;

  SELECT gmv_kz INTO v_gmv
  FROM public.repasses_motorista
  WHERE driver_id = v_driver AND mes_referencia = v_mes;
  IF v_gmv <> v_devido THEN
    RAISE EXCEPTION 'FAIL BL4b: receita GMV devia %, obteve % (v_blocked)', v_devido, v_gmv;
  END IF;

  RAISE NOTICE 'PASS BL4b: comprovativo→rescisão→validação→liquidação repasse 6300 GMV 7000';
END $$;

\echo '=== BL3: global caller (claims JSON service_role + sessão postgres) ==='
DO $$
DECLARE
  v_n integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  v_n := public.apply_due_reserva_expiry(NULL);
  IF v_n IS NULL THEN
    RAISE EXCEPTION 'FAIL BL3: service_role via claims devia executar (não 42501)';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  v_n := public.apply_due_reserva_expiry(NULL);
  IF v_n IS NULL THEN
    RAISE EXCEPTION 'FAIL BL3: sessão postgres NULL devia executar global';
  END IF;

  RAISE NOTICE 'PASS BL3: service_role (claims JSON) e postgres NULL global';
END $$;

DROP FUNCTION IF EXISTS public._p0_pg_proof_expect_denied(text, text);
