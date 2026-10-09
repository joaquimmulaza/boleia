-- Privacidade: list_anulacao_motivo_lugar_acordos (após migrations + bootstrap_p0_auth_overrides).
-- FAIL-on-old 3052d44: EXISTS (qualquer lugar) devolvia todas as linhas do acordo ao passageiro.
\set ON_ERROR_STOP on

\echo '=== list_anulacao_motivo_lugar_acordos — privacidade (só linha própria vs motorista) ==='
DO $$
DECLARE
  v_driver uuid := 'c1111111-1111-4111-8111-111111111111';
  v_pax_a uuid := 'c2222222-2222-4222-8222-222222222222';
  v_pax_b uuid := 'c3333333-3333-4333-8333-333333333333';
  v_pax_x uuid := 'c4444444-4444-4444-8444-444444444444';
  v_pax_y uuid := 'c5555555-5555-4555-8555-555555555555';
  v_out uuid := 'c6666666-6666-4666-8666-666666666666';
  v_acordo uuid := 'c7777777-7777-4777-8777-777777777777';
  v_ap_a uuid := 'c8888888-8888-4888-8888-888888888888';
  v_ap_b uuid := 'c9999999-9999-4999-8999-999999999999';
  v_ap_x uuid := 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_ap_y uuid := 'cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_mes date := date_trunc('month', timezone('Africa/Luanda', now()))::date;
  v_cnt integer;
  v_motivo text;
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
    (v_pax_x, 'lm-pax-x@test'),
    (v_pax_y, 'lm-pax-y@test'),
    (v_out, 'lm-out@test')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'LM Driver', '931000001', 'Motorista'),
    (v_pax_a, 'LM Pax A', '931000002', 'Passageiro'),
    (v_pax_b, 'LM Pax B', '931000003', 'Passageiro'),
    (v_pax_x, 'LM Pax X', '931000004', 'Passageiro'),
    (v_pax_y, 'LM Pax Y', '931000005', 'Passageiro'),
    (v_out, 'LM Out', '931000006', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  DELETE FROM public.pagamentos_acordo WHERE acordo_id = v_acordo;
  DELETE FROM public.acordos_passageiros WHERE acordo_id = v_acordo;
  DELETE FROM public.acordos WHERE id = v_acordo;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'LM Proof', 'LM-001', 5, 4)
  RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    id, driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (
    gen_random_uuid(), v_driver, v_veiculo, true, '07:00', 1, 4, 'POR_PASSAGEIRO', 40000, 'disponivel'
  )
  RETURNING id INTO v_oferta;

  INSERT INTO public.procuras (id, owner_id, preferred_time, n_candidato, estado)
  VALUES (gen_random_uuid(), v_pax_a, '07:30', 4, 'activa')
  RETURNING id INTO v_procura;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado
  ) VALUES (
    v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 4, 160000, 40000, 'activo'
  );

  INSERT INTO public.acordos_passageiros (
    id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao
  ) VALUES
    (v_ap_a, v_acordo, v_pax_a, 'activo', 40000, 0),
    (v_ap_b, v_acordo, v_pax_b, 'saiu', 40000, 1),
    (v_ap_x, v_acordo, v_pax_x, 'saiu', 40000, 2),
    (v_ap_y, v_acordo, v_pax_y, 'activo', 40000, 3);

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
      gen_random_uuid(), v_ap_b, v_acordo, v_pax_b, v_driver,
      40000, 40000, 36000, 0.10, v_mes, 'anulado', 'Saíste antes da activação do lugar'
    ),
    (
      gen_random_uuid(), v_ap_x, v_acordo, v_pax_x, v_driver,
      40000, 40000, 36000, 0.10, v_mes, 'anulado', 'Saíste antes da activação do lugar'
    ),
    (
      gen_random_uuid(), v_ap_y, v_acordo, v_pax_y, v_driver,
      40000, 40000, 36000, 0.10, v_mes, 'em_custodia', NULL
    );

  PERFORM set_config('session_replication_role', 'origin', true);

  -- Passageiro A (activo): exactamente 1 linha (própria); 0 para B
  PERFORM set_config('request.jwt.claim.sub', v_pax_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', format('{"role":"authenticated","sub":"%s"}', v_pax_a), true);

  SELECT count(*)::integer INTO v_cnt
  FROM public.list_anulacao_motivo_lugar_acordos(ARRAY[v_acordo]);

  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'FAIL-on-old3052: passageiro A devia receber 1 linha, obteve %', v_cnt;
  END IF;

  SELECT count(*)::integer INTO v_cnt
  FROM public.list_anulacao_motivo_lugar_acordos(ARRAY[v_acordo]) r
  WHERE r.passenger_id = v_pax_b;

  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'FAIL-on-old3052: passageiro A não devia receber linha de B (obteve %)', v_cnt;
  END IF;

  -- Passageiro B (saiu): só a própria linha
  PERFORM set_config('request.jwt.claim.sub', v_pax_b::text, true);
  PERFORM set_config('request.jwt.claims', format('{"role":"authenticated","sub":"%s"}', v_pax_b), true);

  SELECT count(*)::integer INTO v_cnt
  FROM public.list_anulacao_motivo_lugar_acordos(ARRAY[v_acordo]);

  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'FAIL-on-old3052: passageiro B (saiu) devia receber 1 linha, obteve %', v_cnt;
  END IF;

  SELECT r.anulacao_motivo INTO v_motivo
  FROM public.list_anulacao_motivo_lugar_acordos(ARRAY[v_acordo]) r
  WHERE r.passenger_id = v_pax_b;

  IF v_motivo IS DISTINCT FROM 'Saíste antes da activação do lugar' THEN
    RAISE EXCEPTION 'FAIL: B devia ver o próprio anulacao_motivo';
  END IF;

  -- Passageiro X (saiu antes): só a própria linha
  PERFORM set_config('request.jwt.claim.sub', v_pax_x::text, true);
  PERFORM set_config('request.jwt.claims', format('{"role":"authenticated","sub":"%s"}', v_pax_x), true);

  SELECT count(*)::integer INTO v_cnt
  FROM public.list_anulacao_motivo_lugar_acordos(ARRAY[v_acordo]);

  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'FAIL-on-old3052: passageiro X devia receber 1 linha, obteve %', v_cnt;
  END IF;

  -- Motorista: todas as linhas (4)
  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  PERFORM set_config('request.jwt.claims', format('{"role":"authenticated","sub":"%s"}', v_driver), true);

  SELECT count(*)::integer INTO v_cnt
  FROM public.list_anulacao_motivo_lugar_acordos(ARRAY[v_acordo]);

  IF v_cnt <> 4 THEN
    RAISE EXCEPTION 'FAIL: motorista devia receber 4 linhas, obteve %', v_cnt;
  END IF;

  -- Outsider: zero linhas
  PERFORM set_config('request.jwt.claim.sub', v_out::text, true);
  PERFORM set_config('request.jwt.claims', format('{"role":"authenticated","sub":"%s"}', v_out), true);

  SELECT count(*)::integer INTO v_cnt
  FROM public.list_anulacao_motivo_lugar_acordos(ARRAY[v_acordo]);

  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'FAIL: outsider devia receber 0 linhas (obteve %)', v_cnt;
  END IF;

  RAISE NOTICE 'PASS: privacidade list_anulacao_motivo_lugar_acordos';
END $$;
