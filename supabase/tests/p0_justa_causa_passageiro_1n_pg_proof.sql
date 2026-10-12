-- P0: justa causa por passageiro 1:N — só o lugar do invocador; motorista notificado;
-- último passageiro → sem_lugares_vivos; motorista → encerra acordo inteiro.
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_driver uuid := '1c1a1111-1111-4111-8111-111111111111';
  v_pax_a uuid := '1c1a2222-2222-4222-8222-222222222222';
  v_pax_b uuid := '1c1a3333-3333-4333-8333-333333333333';
  v_pax_solo uuid := '1c1a4444-4444-4444-8444-444444444444';
  v_veiculo uuid;
  v_oferta uuid;
  v_oferta_solo uuid;
  v_oferta_drv uuid;
  v_oferta_res uuid;
  v_procura uuid;
  v_procura_solo uuid;
  v_procura_drv uuid;
  v_procura_res uuid;
  v_acordo uuid := '1c1a5555-5555-4555-8555-555555555555';
  v_acordo_solo uuid := '1c1a6666-6666-4666-8666-666666666666';
  v_acordo_drv uuid := '1c1a7777-7777-4777-8777-777777777777';
  v_acordo_res uuid := '1c1b5555-5555-4555-8555-555555555555';
  v_ap_a uuid := '1c1a8888-8888-4888-8888-888888888888';
  v_ap_b uuid := '1c1a9999-9999-4999-8999-999999999999';
  v_ap_solo uuid := '1c1aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_ap_drv_a uuid := '1c1abbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_ap_drv_b uuid := '1c1acccc-cccc-4ccc-8ccc-cccccccccccc';
  v_ap_res_a uuid := '1c1b8888-8888-4888-8888-888888888888';
  v_ap_res_b uuid := '1c1b9999-9999-4999-8999-999999999999';
  v_pg_a uuid := '1c1af111-f111-4111-8111-111111111111';
  v_pg_b uuid := '1c1adddd-dddd-4ddd-8ddd-dddddddddddd';
  v_key uuid := '1c1aeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  v_key_solo uuid := '1c1affff-ffff-4fff-8fff-ffffffffffff';
  v_key_drv uuid := '1c1a0000-0000-4000-8000-000000000001';
  v_key_res uuid := '1c1b0000-0000-4000-8000-000000000002';
  v_mes date := date_trunc('month', timezone('Africa/Luanda', now()))::date;
  v_hoje date := (timezone('Africa/Luanda', now()))::date;
  v_devido integer;
  v_payout integer;
  v_pg_devido integer;
  v_pg_payout integer;
  v_n_pax_b int;
  v_n_saiu int;
  v_rescisao_dia date;
  v_estado text;
  v_estado_b text;
  v_motivo text;
  v_pg_estado text;
  v_pg_valor integer;
  v_n_driver int;
  v_n_pax_a int;
  v_inv_msg text;
  v_inv_tit text;
  v_data_pt text;
  v_lugar_modo text;
  v_oferta_estado text;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'jc1n-driver@test'),
    (v_pax_a, 'jc1n-paxa@test'),
    (v_pax_b, 'jc1n-paxb@test'),
    (v_pax_solo, 'jc1n-solo@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'JC1N Driver', '931001001', 'Motorista'),
    (v_pax_a, 'JC1N Pax A', '931001002', 'Passageiro'),
    (v_pax_b, 'JC1N Pax B', '931001003', 'Passageiro'),
    (v_pax_solo, 'JC1N Solo', '931001004', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'JC1N', 'JC1N-1', 5, 4) RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado, is_test
  ) VALUES (v_driver, v_veiculo, true, '07:00', 4, 4, 'POR_PASSAGEIRO', 20000, 'disponivel', true)
  RETURNING id INTO v_oferta;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado, is_test
  ) VALUES (v_driver, v_veiculo, true, '08:00', 4, 4, 'POR_PASSAGEIRO', 20000, 'disponivel', true)
  RETURNING id INTO v_oferta_solo;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado, is_test
  ) VALUES (v_driver, v_veiculo, true, '09:00', 4, 4, 'POR_PASSAGEIRO', 20000, 'disponivel', true)
  RETURNING id INTO v_oferta_drv;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado, is_test
  ) VALUES (v_driver, v_veiculo, true, '10:00', 4, 4, 'POR_PASSAGEIRO', 20000, 'disponivel', true)
  RETURNING id INTO v_oferta_res;

  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado, is_test)
  VALUES (v_pax_a, '07:30', 2, 'activa', true) RETURNING id INTO v_procura;
  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado, is_test)
  VALUES (v_pax_solo, '08:30', 1, 'activa', true) RETURNING id INTO v_procura_solo;
  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado, is_test)
  VALUES (v_pax_a, '09:30', 2, 'activa', true) RETURNING id INTO v_procura_drv;
  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado, is_test)
  VALUES (v_pax_a, '10:30', 2, 'activa', true) RETURNING id INTO v_procura_res;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES
    (v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 2, 40000, 20000, 'activo', 22),
    (v_acordo_solo, v_oferta_solo, v_procura_solo, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22),
    (v_acordo_drv, v_oferta_drv, v_procura_drv, v_driver, 'POR_PASSAGEIRO', 2, 40000, 20000, 'activo', 22),
    (v_acordo_res, v_oferta_res, v_procura_res, v_driver, 'POR_PASSAGEIRO', 2, 40000, 20000, 'activo', 22);

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES
    (v_ap_a, v_acordo, v_pax_a, 'activo', 20000, 0),
    (v_ap_b, v_acordo, v_pax_b, 'activo', 20000, 1),
    (v_ap_solo, v_acordo_solo, v_pax_solo, 'activo', 20000, 0),
    (v_ap_drv_a, v_acordo_drv, v_pax_a, 'activo', 20000, 0),
    (v_ap_drv_b, v_acordo_drv, v_pax_b, 'activo', 20000, 1),
    (v_ap_res_a, v_acordo_res, v_pax_a, 'reservado', 20000, 0),
    (v_ap_res_b, v_acordo_res, v_pax_b, 'activo', 20000, 1);

  INSERT INTO public.pagamentos_acordo (
    id, acordo_passageiro_id, acordo_id, passenger_id, driver_id,
    valor_kz, valor_quota_original_kz, valor_payout_liquido_kz, take_rate_pct, mes_referencia, estado
  ) VALUES
    (
      v_pg_a, v_ap_a, v_acordo, v_pax_a, v_driver,
      20000, 20000, 18000, 0.10, v_mes, 'em_custodia'
    ),
    (
      v_pg_b, v_ap_b, v_acordo, v_pax_b, v_driver,
      20000, 20000, 18000, 0.10, v_mes, 'em_custodia'
    );

  DELETE FROM public.notificacoes
  WHERE (metadata->>'acordo_id')::uuid IN (v_acordo, v_acordo_solo, v_acordo_drv, v_acordo_res);

  PERFORM set_config('session_replication_role', 'origin', true);

  -- Caso 1: passageiro A, acordo 2 pax — B activo, pagamento intacto, acordo activo, motorista notificado
  PERFORM set_config('request.jwt.claim.sub', v_pax_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.terminate_agreement(v_acordo, 'justa_causa', 'seguranca', v_key, 'imediato');
  RESET ROLE;

  SELECT lower(estado) INTO v_estado FROM public.acordos WHERE id = v_acordo;
  IF v_estado <> 'activo' THEN
    RAISE EXCEPTION 'FAIL JC1N-1: acordo devia permanecer activo (=%)', v_estado;
  END IF;

  SELECT lower(estado) INTO v_estado_b
  FROM public.acordos_passageiros WHERE id = v_ap_b;
  IF v_estado_b <> 'activo' THEN
    RAISE EXCEPTION 'FAIL JC1N-1: passageiro B devia permanecer activo (=%)', v_estado_b;
  END IF;

  SELECT lower(estado) INTO v_estado FROM public.acordos_passageiros WHERE id = v_ap_a;
  IF v_estado <> 'saiu' THEN
    RAISE EXCEPTION 'FAIL JC1N-1: passageiro A devia sair (=%)', v_estado;
  END IF;

  SELECT lower(lugar_rescisao_modo) INTO v_lugar_modo
  FROM public.acordos_passageiros WHERE id = v_ap_a;
  IF v_lugar_modo IS DISTINCT FROM 'justa_causa' THEN
    RAISE EXCEPTION 'FAIL JC1N-1: lugar_rescisao_modo devia justa_causa (=%)', v_lugar_modo;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.acordos_passageiros
    WHERE id = v_ap_a AND lugar_rescisao_em IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'FAIL JC1N-1: lugar_rescisao_em devia estar preenchido';
  END IF;

  SELECT (timezone('Africa/Luanda', lugar_rescisao_em))::date INTO v_rescisao_dia
  FROM public.acordos_passageiros WHERE id = v_ap_a;
  IF v_rescisao_dia IS DISTINCT FROM v_hoje THEN
    RAISE EXCEPTION 'FAIL JC1N-1: rescisão devia ser no dia de hoje (Luanda) (=%)', v_rescisao_dia;
  END IF;

  v_devido := public.calc_quota_proporcional_kz(20000, 22, v_hoje);
  v_payout := public.compute_payout_liquido_kz(LEAST(20000, v_devido), 0.10::numeric);
  SELECT valor_devido_kz, valor_payout_liquido_kz INTO v_pg_devido, v_pg_payout
  FROM public.pagamentos_acordo WHERE id = v_pg_a;
  IF v_pg_devido IS DISTINCT FROM v_devido OR v_pg_payout IS DISTINCT FROM v_payout THEN
    RAISE EXCEPTION 'FAIL JC1N-1: pro-rata+comissão lugar A (devido=%, payout=%, esp dev=%, esp pay=%)',
      v_pg_devido, v_pg_payout, v_devido, v_payout;
  END IF;

  SELECT lower(estado), valor_kz, valor_devido_kz, valor_payout_liquido_kz
  INTO v_pg_estado, v_pg_valor, v_pg_devido, v_pg_payout
  FROM public.pagamentos_acordo WHERE id = v_pg_b;
  IF v_pg_estado <> 'em_custodia' OR v_pg_valor <> 20000 THEN
    RAISE EXCEPTION 'FAIL JC1N-1: pagamento B devia em_custodia 20000 (est=%, val=%)',
      v_pg_estado, v_pg_valor;
  END IF;
  IF v_pg_devido IS NOT NULL AND v_pg_devido <> 20000 THEN
    RAISE EXCEPTION 'FAIL JC1N-1: obrigação B não devia ser ajustada (devido=%)', v_pg_devido;
  END IF;

  SELECT lower(estado) INTO v_oferta_estado FROM public.ofertas_capacidade WHERE id = v_oferta;
  IF v_oferta_estado NOT IN ('disponivel', 'parcial') THEN
    RAISE EXCEPTION 'FAIL JC1N-1: oferta parcial devia continuar publicada (=%)', v_oferta_estado;
  END IF;

  SELECT COUNT(*) INTO v_n_driver
  FROM public.notificacoes n
  WHERE n.user_id = v_driver
    AND (n.metadata->>'acordo_id')::uuid = v_acordo;
  IF v_n_driver < 1 THEN
    RAISE EXCEPTION 'FAIL JC1N-1: motorista devia ser notificado (n=%)', v_n_driver;
  END IF;

  SELECT COUNT(*) INTO v_n_pax_b
  FROM public.notificacoes n
  WHERE n.user_id = v_pax_b
    AND (n.metadata->>'acordo_id')::uuid = v_acordo;
  IF v_n_pax_b <> 0 THEN
    RAISE EXCEPTION 'FAIL JC1N-1: passageiro B não devia receber notificações (n=%)', v_n_pax_b;
  END IF;

  SELECT COUNT(*) INTO v_n_pax_a
  FROM public.notificacoes n
  WHERE n.user_id = v_pax_a
    AND (n.metadata->>'acordo_id')::uuid = v_acordo
    AND n.metadata->>'type' = 'justa_causa_passageiro_invocador';
  IF v_n_pax_a <> 1 THEN
    RAISE EXCEPTION 'FAIL JC1N-1: invocador devia receber exactamente 1 notificação (n=%)', v_n_pax_a;
  END IF;

  SELECT n.mensagem, n.metadata->>'titulo'
  INTO v_inv_msg, v_inv_tit
  FROM public.notificacoes n
  WHERE n.user_id = v_pax_a
    AND (n.metadata->>'acordo_id')::uuid = v_acordo
    AND n.metadata->>'type' = 'justa_causa_passageiro_invocador'
  ORDER BY n.created_at DESC
  LIMIT 1;

  SELECT public._format_civil_date_luanda_pt_no_year(ap.lugar_rescisao_em)
  INTO v_data_pt
  FROM public.acordos_passageiros ap
  WHERE ap.id = v_ap_a;

  IF v_inv_tit IS DISTINCT FROM 'Saíste do acordo' THEN
    RAISE EXCEPTION 'FAIL JC1N-1d: título invocador A (=%)', v_inv_tit;
  END IF;

  IF v_inv_msg IS DISTINCT FROM (
    'Terminaste o teu lugar por justa causa a ' || v_data_pt
    || '. Só contam os dias até essa data. Se já pagaste mais, devolvemos-te a diferença.'
  ) THEN
    RAISE EXCEPTION 'FAIL JC1N-1d: mensagem invocador A (=%)', v_inv_msg;
  END IF;

  IF v_inv_msg LIKE '%·%' THEN
    RAISE EXCEPTION 'FAIL JC1N-1d: mensagem invocador não deve ser placeholder (=%)', v_inv_msg;
  END IF;

  RAISE NOTICE 'JC1N-1 (copy A): invocador=% motorista=% outros_pax=% titulo=% mensagem=%',
    v_n_pax_a, v_n_driver, v_n_pax_b, v_inv_tit, v_inv_msg;

  -- Idempotência: segunda chamada com a mesma chave não altera estado
  PERFORM set_config('request.jwt.claim.sub', v_pax_a::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.terminate_agreement(v_acordo, 'justa_causa', 'seguranca', v_key, 'imediato');
  RESET ROLE;

  SELECT COUNT(*) INTO v_n_saiu
  FROM public.acordos_passageiros ap
  WHERE ap.id = v_ap_a AND lower(ap.estado) = 'saiu';
  IF v_n_saiu <> 1 THEN
    RAISE EXCEPTION 'FAIL JC1N-1b: idempotência devia manter saída única do passageiro A';
  END IF;

  SELECT COUNT(*) INTO v_n_pax_a
  FROM public.notificacoes n
  WHERE n.user_id = v_pax_a
    AND (n.metadata->>'acordo_id')::uuid = v_acordo
    AND n.metadata->>'type' = 'justa_causa_passageiro_invocador';
  IF v_n_pax_a <> 1 THEN
    RAISE EXCEPTION 'FAIL JC1N-1c: idempotência invocador devia manter 1 notificação (n=%)', v_n_pax_a;
  END IF;

  RAISE NOTICE 'JC1N-1c (idempotência): invocador=% (2.ª chamada)', v_n_pax_a;

  -- Caso 2: último passageiro (solo) por justa causa → sem_lugares_vivos
  PERFORM set_config('request.jwt.claim.sub', v_pax_solo::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.terminate_agreement(v_acordo_solo, 'justa_causa', 'seguranca', v_key_solo, 'imediato');
  RESET ROLE;

  SELECT lower(estado), encerramento_motivo INTO v_estado, v_motivo
  FROM public.acordos WHERE id = v_acordo_solo;
  IF v_estado <> 'cancelado' OR v_motivo IS DISTINCT FROM 'sem_lugares_vivos' THEN
    RAISE EXCEPTION 'FAIL JC1N-2: último pax JC devia cancelado + sem_lugares_vivos (est=%, mot=%)',
      v_estado, v_motivo;
  END IF;

  SELECT lower(lugar_rescisao_modo) INTO v_lugar_modo
  FROM public.acordos_passageiros WHERE id = v_ap_solo;
  IF v_lugar_modo IS DISTINCT FROM 'justa_causa' THEN
    RAISE EXCEPTION 'FAIL JC1N-2: lugar_rescisao_modo solo devia justa_causa (=%)', v_lugar_modo;
  END IF;

  SELECT lower(estado) INTO v_oferta_estado
  FROM public.ofertas_capacidade WHERE id = v_oferta_solo;
  IF v_oferta_estado NOT IN ('disponivel', 'parcial') THEN
    RAISE EXCEPTION 'FAIL JC1N-2: oferta solo devia continuar publicada (=%)', v_oferta_estado;
  END IF;

  SELECT n.mensagem, n.metadata->>'titulo'
  INTO v_inv_msg, v_inv_tit
  FROM public.notificacoes n
  WHERE n.user_id = v_pax_solo
    AND (n.metadata->>'acordo_id')::uuid = v_acordo_solo
    AND n.metadata->>'type' = 'justa_causa_passageiro_invocador'
  ORDER BY n.created_at DESC
  LIMIT 1;

  SELECT public._format_civil_date_luanda_pt_no_year(ap.lugar_rescisao_em)
  INTO v_data_pt
  FROM public.acordos_passageiros ap
  WHERE ap.id = v_ap_solo;

  IF v_inv_tit IS DISTINCT FROM 'Acordo encerrado' THEN
    RAISE EXCEPTION 'FAIL JC1N-2b: título invocador B (=%)', v_inv_tit;
  END IF;

  IF v_inv_msg IS DISTINCT FROM (
    'Saíste por justa causa a ' || v_data_pt
    || '. Eras o último passageiro, por isso o acordo foi encerrado. '
    || 'Só contam os dias até essa data. Se já pagaste mais, devolvemos-te a diferença.'
  ) THEN
    RAISE EXCEPTION 'FAIL JC1N-2b: mensagem invocador B (=%)', v_inv_msg;
  END IF;

  IF v_inv_msg LIKE '%·%' THEN
    RAISE EXCEPTION 'FAIL JC1N-2b: mensagem invocador B sem placeholder (=%)', v_inv_msg;
  END IF;

  SELECT COUNT(*) INTO v_n_driver
  FROM public.notificacoes n
  WHERE n.user_id = v_driver
    AND (n.metadata->>'acordo_id')::uuid = v_acordo_solo;

  SELECT COUNT(*) INTO v_n_pax_a
  FROM public.notificacoes n
  WHERE n.user_id = v_pax_solo
    AND (n.metadata->>'acordo_id')::uuid = v_acordo_solo
    AND n.metadata->>'type' = 'justa_causa_passageiro_invocador';

  RAISE NOTICE 'JC1N-2 (copy B): invocador=% motorista=% titulo=% mensagem=%',
    v_n_pax_a, v_n_driver, v_inv_tit, v_inv_msg;

  -- Caso 4: passageiro reservado (não activo) — expira só o lugar; outro activo intacto
  DELETE FROM public.notificacoes
  WHERE (metadata->>'acordo_id')::uuid = v_acordo_res;

  PERFORM set_config('request.jwt.claim.sub', v_pax_a::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.terminate_agreement(v_acordo_res, 'justa_causa', 'seguranca', v_key_res, 'imediato');
  RESET ROLE;

  SELECT lower(estado) INTO v_estado FROM public.acordos WHERE id = v_acordo_res;
  IF v_estado <> 'activo' THEN
    RAISE EXCEPTION 'FAIL JC1N-4: acordo reservado devia permanecer activo (=%)', v_estado;
  END IF;

  SELECT lower(estado) INTO v_estado FROM public.acordos_passageiros WHERE id = v_ap_res_a;
  IF v_estado <> 'expirado' THEN
    RAISE EXCEPTION 'FAIL JC1N-4: invocador reservado devia expirado (=%)', v_estado;
  END IF;

  SELECT lower(lugar_rescisao_modo) INTO v_lugar_modo
  FROM public.acordos_passageiros WHERE id = v_ap_res_a;
  IF v_lugar_modo IS DISTINCT FROM 'justa_causa' THEN
    RAISE EXCEPTION 'FAIL JC1N-4: reservado devia marcar justa_causa (=%)', v_lugar_modo;
  END IF;

  SELECT lower(estado) INTO v_estado_b FROM public.acordos_passageiros WHERE id = v_ap_res_b;
  IF v_estado_b <> 'activo' THEN
    RAISE EXCEPTION 'FAIL JC1N-4: outro passageiro devia permanecer activo (=%)', v_estado_b;
  END IF;

  SELECT COUNT(*) INTO v_n_pax_b
  FROM public.notificacoes n
  WHERE n.user_id = v_pax_b
    AND (n.metadata->>'acordo_id')::uuid = v_acordo_res;
  IF v_n_pax_b <> 0 THEN
    RAISE EXCEPTION 'FAIL JC1N-4: passageiro B não devia ser notificado (n=%)', v_n_pax_b;
  END IF;

  -- Caso 3: motorista → encerra acordo inteiro (cancelado_justificado)
  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.terminate_agreement(v_acordo_drv, 'justa_causa', 'avaria_veiculo', v_key_drv, 'imediato');
  RESET ROLE;

  SELECT lower(estado) INTO v_estado FROM public.acordos WHERE id = v_acordo_drv;
  IF v_estado <> 'cancelado_justificado' THEN
    RAISE EXCEPTION 'FAIL JC1N-3: motorista JC devia cancelado_justificado (=%)', v_estado;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.acordos_passageiros
    WHERE acordo_id = v_acordo_drv AND lower(estado) IN ('activo', 'reservado')
  ) THEN
    RAISE EXCEPTION 'FAIL JC1N-3: motorista JC devia libertar todos os lugares';
  END IF;

  RAISE NOTICE 'PASS JC1N: justa causa passageiro 1:N (parcial, último, reservado, motorista, pro-rata, idempotência)';
END $$;
