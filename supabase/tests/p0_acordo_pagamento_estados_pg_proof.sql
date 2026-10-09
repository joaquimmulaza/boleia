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

\echo '=== B1/B3: helpers + snapshot negados como authenticated ==='
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
  v_err text;
  v_sqlstate text;
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

  PERFORM set_config('session_replication_role', 'origin', true);

  PERFORM set_config('request.jwt.claim.sub', v_pax::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  BEGIN
    PERFORM public._anular_pagamento_sem_divida(v_ap, 'proof');
    RAISE EXCEPTION 'FAIL: _anular_pagamento_sem_divida devia negar';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
      IF v_sqlstate IS DISTINCT FROM '42501' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    PERFORM public.build_ui_obrigacao_snapshot(v_pg);
    RAISE EXCEPTION 'FAIL: build_ui_obrigacao_snapshot devia negar';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
      IF v_sqlstate IS DISTINCT FROM '42501' THEN
        RAISE;
      END IF;
  END;

  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_out::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  BEGIN
    PERFORM public.apply_due_reserva_expiry(NULL);
    RAISE EXCEPTION 'FAIL: apply_due_reserva_expiry(NULL) devia negar (non-admin)';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_err = MESSAGE_TEXT;
      IF v_sqlstate IS DISTINCT FROM '42501' THEN
        RAISE EXCEPTION 'FAIL: apply_due NULL scope sqlstate=% msg=%', v_sqlstate, v_err;
      END IF;
  END;

  BEGIN
    PERFORM public.apply_due_agreement_terminations(v_acordo);
    RAISE EXCEPTION 'FAIL: apply_due_terminations acordo alheio devia negar';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
      IF v_sqlstate IS DISTINCT FROM '42501' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    PERFORM public.apply_due_agreement_non_renewals(v_acordo);
    RAISE EXCEPTION 'FAIL: apply_due_non_renewals acordo alheio devia negar';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
      IF v_sqlstate IS DISTINCT FROM '42501' THEN
        RAISE;
      END IF;
  END;

  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_pax::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  PERFORM public.apply_due_reserva_expiry(v_acordo);

  RESET ROLE;
  RAISE NOTICE 'PASS: B1/B2/B3 runtime (helpers, NULL scope, acordo alheio, scope próprio OK)';
END $$;
