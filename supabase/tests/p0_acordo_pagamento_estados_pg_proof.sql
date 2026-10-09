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

DROP FUNCTION IF EXISTS public._p0_pg_proof_expect_denied(text, text);
