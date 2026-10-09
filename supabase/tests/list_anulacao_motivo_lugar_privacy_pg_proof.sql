-- Privacidade: list_anulacao_motivo_lugar_acordos (após migrations + bootstrap_p0_auth_overrides).
-- FAIL-on-old: em 4e587db o passageiro A recebia pagamento_estado do passageiro B.
\set ON_ERROR_STOP on

\echo '=== list_anulacao_motivo_lugar_acordos — privacidade ==='
DO $$
DECLARE
  v_driver uuid := 'c1111111-1111-4111-8111-111111111111';
  v_pax_a uuid := 'c2222222-2222-4222-8222-222222222222';
  v_pax_b uuid := 'c3333333-3333-4333-8333-333333333333';
  v_out uuid := 'c4444444-4444-4444-8444-444444444444';
  v_acordo uuid := 'c5555555-5555-4555-8555-555555555555';
  v_ap_a uuid := 'c6666666-6666-4666-8666-666666666666';
  v_ap_b uuid := 'c7777777-7777-4777-8777-777777777777';
  v_pg_b uuid := 'c8888888-8888-4888-8888-888888888888';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_mes date := date_trunc('month', timezone('Africa/Luanda', now()))::date;
  v_estado_b text;
  v_motivo_b text;
  v_estado_drv text;
  v_cnt_out integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'list_anulacao_motivo_lugar_acordos'
  ) THEN
    RAISE EXCEPTION 'FAIL: RPC list_anulacao_motivo_lugar_acordos em falta';
  END IF;

  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'lm-driver@test'),
    (v_pax_a, 'lm-pax-a@test'),
    (v_pax_b, 'lm-pax-b@test'),
    (v_out, 'lm-out@test')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'LM Driver', '931000001', 'Motorista'),
    (v_pax_a, 'LM Pax A', '931000002', 'Passageiro'),
    (v_pax_b, 'LM Pax B', '931000003', 'Passageiro'),
    (v_out, 'LM Out', '931000004', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  DELETE FROM public.pagamentos_acordo WHERE acordo_id = v_acordo;
  DELETE FROM public.acordos_passageiros WHERE acordo_id = v_acordo;
  DELETE FROM public.acordos WHERE id = v_acordo;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'LM Proof', 'LM-001', 4, 3)
  RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    id, driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (
    gen_random_uuid(), v_driver, v_veiculo, true, '07:00', 2, 3, 'POR_PASSAGEIRO', 40000, 'disponivel'
  )
  RETURNING id INTO v_oferta;

  INSERT INTO public.procuras (id, owner_id, preferred_time, n_candidato, estado)
  VALUES (gen_random_uuid(), v_pax_a, '07:30', 2, 'activa')
  RETURNING id INTO v_procura;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado
  ) VALUES (
    v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 2, 80000, 40000, 'activo'
  );

  INSERT INTO public.acordos_passageiros (
    id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao
  ) VALUES
    (v_ap_a, v_acordo, v_pax_a, 'activo', 40000, 0),
    (v_ap_b, v_acordo, v_pax_b, 'activo', 40000, 1);

  INSERT INTO public.pagamentos_acordo (
    id, acordo_passageiro_id, acordo_id, passenger_id, driver_id,
    valor_kz, valor_quota_original_kz, valor_payout_liquido_kz, take_rate_pct, mes_referencia, estado,
    anulacao_motivo
  ) VALUES
    (
      gen_random_uuid(), v_ap_a, v_acordo, v_pax_a, v_driver,
      40000, 40000, 36000, 0.10, v_mes, 'pendente_pagamento', NULL
    ),
    (
      v_pg_b, v_ap_b, v_acordo, v_pax_b, v_driver,
      40000, 40000, 36000, 0.10, v_mes, 'em_custodia', NULL
    );

  PERFORM set_config('session_replication_role', 'origin', true);

  -- Passageiro A: não vê pagamento_estado de B (FAIL-on-old se não for NULL)
  PERFORM set_config('request.jwt.claim.sub', v_pax_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', format('{"role":"authenticated","sub":"%s"}', v_pax_a), true);

  SELECT r.pagamento_estado, r.anulacao_motivo
  INTO v_estado_b, v_motivo_b
  FROM public.list_anulacao_motivo_lugar_acordos(ARRAY[v_acordo]) r
  WHERE r.passenger_id = v_pax_b;

  IF v_estado_b IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL-on-old: passageiro A vê pagamento_estado de B (%)', v_estado_b;
  END IF;

  IF v_motivo_b IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: passageiro A não devia ver anulacao_motivo de B (pagamento não anulado)';
  END IF;

  -- Própria linha A: estado visível
  SELECT r.pagamento_estado INTO v_estado_b
  FROM public.list_anulacao_motivo_lugar_acordos(ARRAY[v_acordo]) r
  WHERE r.passenger_id = v_pax_a;

  IF v_estado_b IS NULL THEN
    RAISE EXCEPTION 'FAIL: passageiro A devia ver o próprio pagamento_estado';
  END IF;

  -- Motorista: vê estado de B
  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  PERFORM set_config('request.jwt.claims', format('{"role":"authenticated","sub":"%s"}', v_driver), true);

  SELECT r.pagamento_estado INTO v_estado_drv
  FROM public.list_anulacao_motivo_lugar_acordos(ARRAY[v_acordo]) r
  WHERE r.passenger_id = v_pax_b;

  IF v_estado_drv IS DISTINCT FROM 'em_custodia' THEN
    RAISE EXCEPTION 'FAIL: motorista devia ver pagamento_estado em_custodia de B (%)', v_estado_drv;
  END IF;

  -- Outsider: zero linhas
  PERFORM set_config('request.jwt.claim.sub', v_out::text, true);
  PERFORM set_config('request.jwt.claims', format('{"role":"authenticated","sub":"%s"}', v_out), true);

  SELECT count(*)::integer INTO v_cnt_out
  FROM public.list_anulacao_motivo_lugar_acordos(ARRAY[v_acordo]);

  IF v_cnt_out <> 0 THEN
    RAISE EXCEPTION 'FAIL: outsider devia receber 0 linhas (obteve %)', v_cnt_out;
  END IF;

  RAISE NOTICE 'PASS: privacidade list_anulacao_motivo_lugar_acordos';
END $$;
