-- Pacote notificações: leave_passenger — parcial vs último passageiro, B4, self-leave S2/S3.
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_driver uuid := 'c1111111-1111-4111-8111-111111111111';
  v_pax_named uuid := 'c2222222-2222-4222-8222-222222222222';
  v_pax_noname uuid := 'c3333333-3333-4333-8333-333333333333';
  v_pax2 uuid := 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo_partial uuid := 'c4444444-4444-4444-8444-444444444444';
  v_acordo_last uuid := 'c5555555-5555-4555-8555-555555555555';
  v_acordo_res uuid := 'c6666666-6666-4666-8666-666666666666';
  v_acordo_driver uuid := 'c7777777-7777-4777-8777-777777777777';
  v_ap_p1 uuid := 'c8888888-8888-4888-8888-888888888888';
  v_ap_p2 uuid := 'c9999999-9999-4999-8999-999999999999';
  v_ap_last uuid := 'cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_ap_res uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  v_ap_driver uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  v_pg_last uuid := 'deeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  v_pg_res uuid := 'dfffffff-ffff-4fff-8fff-ffffffffffff';
  v_mes date := date_trunc('month', timezone('Africa/Luanda', now()))::date;
  v_hoje date := (timezone('Africa/Luanda', now()))::date;
  v_n integer;
  v_estado text;
  v_pg_estado text;
  v_motivo text;
  v_devido integer;
  v_valor_kz integer;
  v_quota_prop integer;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'npc-driver@test'),
    (v_pax_named, 'npc-pax-named@test'),
    (v_pax_noname, 'npc-pax-noname@test'),
    (v_pax2, 'npc-pax2@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'NPC Driver', '941000001', 'Motorista'),
    (v_pax_named, 'Maria Silva', '941000002', 'Passageiro'),
    (v_pax_noname, '   ', '941000003', 'Passageiro'),
    (v_pax2, 'João Costa', '941000004', 'Passageiro')
  ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'NPC', 'NPC-1', 5, 4) RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (v_driver, v_veiculo, true, '07:00', 4, 4, 'POR_PASSAGEIRO', 20000, 'disponivel')
  RETURNING id INTO v_oferta;

  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax_named, '07:30', 2, 'activa') RETURNING id INTO v_procura;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo_partial, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 2, 40000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES
    (v_ap_p1, v_acordo_partial, v_pax_named, 'activo', 20000, 0),
    (v_ap_p2, v_acordo_partial, v_pax2, 'activo', 20000, 1);

  -- Último passageiro activo (S2) — lugar activo + pagamento mês corrente
  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo_last, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES (v_ap_last, v_acordo_last, v_pax_named, 'activo', 20000, 0);

  INSERT INTO public.pagamentos_acordo (
    id, acordo_passageiro_id, acordo_id, passenger_id, driver_id,
    valor_kz, valor_quota_original_kz, valor_payout_liquido_kz, take_rate_pct, mes_referencia, estado
  ) VALUES (
    v_pg_last, v_ap_last, v_acordo_last, v_pax_named, v_driver,
    20000, 20000, 18000, 0.10, v_mes, 'pendente_pagamento'
  );

  -- reservado único (S3) + pagamento pendente → anulado na saída
  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo_res, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES (v_ap_res, v_acordo_res, v_pax_noname, 'reservado', 20000, 0);

  INSERT INTO public.pagamentos_acordo (
    id, acordo_passageiro_id, acordo_id, passenger_id, driver_id,
    valor_kz, valor_quota_original_kz, valor_payout_liquido_kz, take_rate_pct, mes_referencia, estado
  ) VALUES (
    v_pg_res, v_ap_res, v_acordo_res, v_pax_noname, v_driver,
    20000, 20000, 18000, 0.10, v_mes, 'pendente_pagamento'
  );

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo_driver, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES (v_ap_driver, v_acordo_driver, v_pax2, 'activo', 20000, 0);

  PERFORM set_config('session_replication_role', 'origin', true);
  DELETE FROM public.notificacoes;

  -- Saída parcial com nome → lugar livre + link; acordo activo; sem cancelado genérico
  PERFORM set_config('request.jwt.claim.sub', v_pax_named::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo_partial, v_pax_named, gen_random_uuid());
  RESET ROLE;

  IF lower((SELECT estado FROM public.acordos WHERE id = v_acordo_partial)) <> 'activo' THEN
    RAISE EXCEPTION 'FAIL NPC: acordo parcial devia permanecer activo';
  END IF;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_driver
    AND mensagem = 'Maria Silva saiu do acordo. Ficou um lugar livre.'
    AND link = '/acordos?openAcordoId=' || v_acordo_partial::text;

  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL NPC: notificação parcial com nome (n=%)', v_n;
  END IF;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_driver AND mensagem = 'Um acordo foi cancelado.';

  IF v_n <> 0 THEN
    RAISE EXCEPTION 'FAIL NPC: cancelado genérico após saída parcial (n=%)', v_n;
  END IF;

  DELETE FROM public.notificacoes;

  -- Self-leave último activo (S2): proporcional em dívida; pax sem notif; motorista card encerrado
  v_quota_prop := public.calc_quota_proporcional_kz(20000, 22, v_hoje);

  PERFORM set_config('request.jwt.claim.sub', v_pax_named::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo_last, v_pax_named, gen_random_uuid());
  RESET ROLE;

  IF lower((SELECT estado FROM public.acordos WHERE id = v_acordo_last)) <> 'cancelado' THEN
    RAISE EXCEPTION 'FAIL NPC: acordo último pax devia estar cancelado';
  END IF;

  SELECT lower(estado) INTO v_estado FROM public.acordos_passageiros WHERE id = v_ap_last;
  IF v_estado <> 'saiu' THEN
    RAISE EXCEPTION 'FAIL S2: lugar activo devia passar a saiu (estado=%)', v_estado;
  END IF;

  SELECT lower(estado), valor_devido_kz, valor_kz
  INTO v_pg_estado, v_devido, v_valor_kz
  FROM public.pagamentos_acordo WHERE id = v_pg_last;

  IF v_pg_estado <> 'pendente_pagamento' THEN
    RAISE EXCEPTION 'FAIL S2: pagamento devia permanecer pendente (estado=%)', v_pg_estado;
  END IF;

  IF v_devido IS NULL OR v_devido <> v_quota_prop THEN
    RAISE EXCEPTION 'FAIL S2: valor_devido_kz proporcional esperado %, obteve %', v_quota_prop, v_devido;
  END IF;

  IF v_valor_kz IS NULL OR v_valor_kz <> v_devido THEN
    RAISE EXCEPTION 'FAIL S2: valor_kz devia ser dívida restante %, obteve %', v_devido, v_valor_kz;
  END IF;

  SELECT COUNT(*)::integer INTO v_n FROM public.notificacoes WHERE user_id = v_pax_named;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'FAIL self-leave S2: passageiro não devia receber notificações (n=%)', v_n;
  END IF;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_driver
    AND mensagem = 'Maria Silva saiu e o acordo foi encerrado. A tua oferta continua publicada.'
    AND link = '/acordos?openAcordoId=' || v_acordo_last::text;

  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL self-leave S2: motorista card encerrado (n=%)', v_n;
  END IF;

  SELECT COUNT(*)::integer INTO v_n FROM public.notificacoes WHERE user_id = v_driver;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL self-leave S2: motorista exactamente 1 notif (n=%)', v_n;
  END IF;

  DELETE FROM public.notificacoes;

  -- Self-leave reservado (S3): anulado + motivo; pax sem notif; motorista card encerrado
  PERFORM set_config('request.jwt.claim.sub', v_pax_noname::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo_res, v_pax_noname, gen_random_uuid());
  RESET ROLE;

  SELECT lower(estado) INTO v_estado FROM public.acordos_passageiros WHERE id = v_ap_res;
  IF v_estado <> 'saiu' THEN
    RAISE EXCEPTION 'FAIL S3: reservado não passou a saiu (estado=%)', v_estado;
  END IF;

  SELECT lower(estado), anulacao_motivo
  INTO v_pg_estado, v_motivo
  FROM public.pagamentos_acordo WHERE id = v_pg_res;

  IF v_pg_estado <> 'anulado' THEN
    RAISE EXCEPTION 'FAIL S3: pagamento devia estar anulado (estado=%)', v_pg_estado;
  END IF;

  IF v_motivo IS DISTINCT FROM 'Saíste antes da activação do lugar' THEN
    RAISE EXCEPTION 'FAIL S3: motivo anulação inesperado: %', v_motivo;
  END IF;

  SELECT COUNT(*)::integer INTO v_n FROM public.notificacoes WHERE user_id = v_pax_noname;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'FAIL self-leave S3: passageiro sem notificações (n=%)', v_n;
  END IF;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_driver
    AND mensagem = 'O último passageiro saiu e o acordo foi encerrado. A tua oferta continua publicada.'
    AND link = '/acordos?openAcordoId=' || v_acordo_res::text;

  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL self-leave S3: motorista card encerrado (n=%)', v_n;
  END IF;

  DELETE FROM public.notificacoes;

  -- B4: motorista remove último → passageiro cancelamento; motorista sem notificações
  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  PERFORM set_config('boleia.skip_acordo_cancel_notif', 'on', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo_driver, v_pax2, gen_random_uuid());
  RESET ROLE;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_pax2
    AND mensagem = 'O teu acordo de boleia foi cancelado.';

  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL B4: passageiro removido sem cancelamento exacto (n=%)', v_n;
  END IF;

  SELECT COUNT(*)::integer INTO v_n FROM public.notificacoes WHERE user_id = v_driver;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'FAIL B4: motorista não devia receber notificações (n=%)', v_n;
  END IF;

  -- Saída parcial com motorista caller: sem notificação leave_passenger
  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    'ceeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', v_oferta, v_procura, v_driver,
    'POR_PASSAGEIRO', 2, 40000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES
    ('cfffffff-ffff-4fff-8fff-ffffffffffff', 'ceeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', v_pax_named, 'activo', 20000, 0),
    ('c0000000-0000-4000-8000-000000000001', 'ceeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', v_pax2, 'activo', 20000, 1);

  DELETE FROM public.notificacoes;

  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(
    'ceeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    v_pax_named,
    gen_random_uuid()
  );
  RESET ROLE;

  SELECT COUNT(*)::integer INTO v_n FROM public.notificacoes WHERE user_id = v_driver;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'FAIL NPC: motorista caller saída parcial sem notif (n=%)', v_n;
  END IF;

  RAISE NOTICE 'PASS NPC: parcial/self-leave S2+S3/B4 driver-remove/GUC inútil';
END $$;
