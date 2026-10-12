-- Sprint UX: motorista notificado (G1 cancelamento_pendente, G2 v1.12, G3 v1.7/v1.8, motorista remove).
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_driver uuid := 'd1111111-1111-4111-8111-111111111111';
  v_pax_named uuid := 'd2222222-2222-4222-8222-222222222222';
  v_pax_noname uuid := 'd3333333-3333-4333-8333-333333333333';
  v_pax2 uuid := 'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo_cp uuid := 'd4444444-4444-4444-8444-444444444444';
  v_acordo_partial uuid := 'd5555555-5555-4555-8555-555555555555';
  v_acordo_last uuid := 'd6666666-6666-4666-8666-666666666666';
  v_acordo_exp_name uuid := 'd7777777-7777-4777-8777-777777777777';
  v_acordo_exp_noname uuid := 'd8888888-8888-4888-8888-888888888888';
  v_acordo_driver uuid := 'd9999999-9999-4999-8999-999999999999';
  v_acordo_driver_od uuid := 'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
  v_oferta_fixa uuid;
  v_ap_cp1 uuid := 'e4444444-4444-4444-8444-444444444441';
  v_ap_cp2 uuid := 'e4444444-4444-4444-8444-444444444442';
  v_ap_p1 uuid := 'e5555555-5555-4555-8555-555555555551';
  v_ap_p2 uuid := 'e5555555-5555-4555-8555-555555555552';
  v_ap_last uuid := 'e6666666-6666-4666-8666-666666666661';
  v_ap_exp_name uuid := 'e7777777-7777-4777-8777-777777777771';
  v_ap_exp_act uuid := 'e7777777-7777-4777-8777-777777777772';
  v_ap_exp_noname uuid := 'e8888888-8888-4888-8888-888888888881';
  v_ap_exp_act2 uuid := 'e8888888-8888-4888-8888-888888888882';
  v_ap_driver uuid := 'e9999999-9999-4999-8999-999999999991';
  v_n integer;
  v_meta jsonb;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'dn-driver@test'),
    (v_pax_named, 'dn-pax-named@test'),
    (v_pax_noname, 'dn-pax-noname@test'),
    (v_pax2, 'dn-pax2@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'DN Driver', '951000001', 'Motorista'),
    (v_pax_named, 'Ana Costa', '951000002', 'Passageiro'),
    (v_pax_noname, '   ', '951000003', 'Passageiro'),
    (v_pax2, 'Bruno Lima', '951000004', 'Passageiro')
  ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'DN', 'DN-1', 5, 4) RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (v_driver, v_veiculo, true, '07:00', 4, 4, 'POR_PASSAGEIRO', 20000, 'disponivel')
  RETURNING id INTO v_oferta;

  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax_named, '07:30', 2, 'activa') RETURNING id INTO v_procura;

  -- G1: cancelamento_pendente + saída parcial
  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes,
    rescisao_modo, rescisao_effective_on
  ) VALUES (
    v_acordo_cp, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 2, 40000, 20000,
    'cancelamento_pendente', 22, 'aviso_previo', (timezone('Africa/Luanda', now()))::date + 7
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES
    (v_ap_cp1, v_acordo_cp, v_pax_named, 'activo', 20000, 0),
    (v_ap_cp2, v_acordo_cp, v_pax2, 'activo', 20000, 1);

  DELETE FROM public.notificacoes;

  PERFORM set_config('request.jwt.claim.sub', v_pax_named::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo_cp, v_pax_named, gen_random_uuid());
  RESET ROLE;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_driver
    AND mensagem = 'Ana Costa saiu do acordo. Ficou um lugar livre.';

  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL G1: motorista sem notif parcial em cancelamento_pendente (n=%)', v_n;
  END IF;

  SELECT metadata INTO v_meta
  FROM public.notificacoes
  WHERE user_id = v_driver
    AND mensagem = 'Ana Costa saiu do acordo. Ficou um lugar livre.'
  LIMIT 1;

  IF v_meta->>'card' IS DISTINCT FROM 'v1.7' THEN
    RAISE EXCEPTION 'FAIL G1/G3: card v1.7 esperado, obteve %', v_meta->>'card';
  END IF;

  -- G3 parcial (activo)
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

  DELETE FROM public.notificacoes;

  PERFORM set_config('request.jwt.claim.sub', v_pax_named::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo_partial, v_pax_named, gen_random_uuid());
  RESET ROLE;

  SELECT metadata INTO v_meta
  FROM public.notificacoes
  WHERE user_id = v_driver
    AND mensagem = 'Ana Costa saiu do acordo. Ficou um lugar livre.'
  LIMIT 1;

  IF v_meta->>'card' <> 'v1.7' OR v_meta->>'titulo' <> 'Ficou um lugar livre' THEN
    RAISE EXCEPTION 'FAIL G3 parcial: metadata card/titulo inválido %', v_meta;
  END IF;

  -- G3 último (v1.8)
  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo_last, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES (v_ap_last, v_acordo_last, v_pax_named, 'activo', 20000, 0);

  DELETE FROM public.notificacoes;

  PERFORM set_config('request.jwt.claim.sub', v_pax_named::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo_last, v_pax_named, gen_random_uuid());
  RESET ROLE;

  SELECT metadata INTO v_meta
  FROM public.notificacoes
  WHERE user_id = v_driver
    AND mensagem LIKE 'Ana Costa saiu e o acordo foi encerrado%'
  LIMIT 1;

  IF v_meta->>'card' <> 'v1.8' OR v_meta->>'titulo' <> 'Acordo encerrado' THEN
    RAISE EXCEPTION 'FAIL G3 último: metadata card/titulo inválido %', v_meta;
  END IF;

  -- G2 com nome (reserva expira, lugar activo restante)
  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo_exp_name, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 2, 40000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao, reservado_expira_em)
  VALUES
    (v_ap_exp_name, v_acordo_exp_name, v_pax_named, 'reservado', 20000, 0, now() - interval '1 hour'),
    (v_ap_exp_act, v_acordo_exp_name, v_pax2, 'activo', 20000, 1, NULL);

  DELETE FROM public.notificacoes;

  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.apply_due_reserva_expiry(v_acordo_exp_name);
  RESET ROLE;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_driver
    AND mensagem = 'A reserva de Ana Costa expirou. O acordo continua.';

  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL G2 nome: notif motorista v1.12 (n=%)', v_n;
  END IF;

  SELECT metadata INTO v_meta
  FROM public.notificacoes
  WHERE user_id = v_driver
    AND mensagem = 'A reserva de Ana Costa expirou. O acordo continua.'
  LIMIT 1;

  IF v_meta->>'card' <> 'v1.12' OR v_meta->>'titulo' <> 'Ficou um lugar livre' THEN
    RAISE EXCEPTION 'FAIL G2 nome: metadata inválido %', v_meta;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notificacoes
    WHERE user_id = v_driver AND link IS NOT NULL
      AND mensagem = 'A reserva de Ana Costa expirou. O acordo continua.'
  ) THEN
    RAISE EXCEPTION 'FAIL G2: v1.12 não deve ter link/CTA';
  END IF;

  -- G2 sem nome
  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo_exp_noname, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 2, 40000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao, reservado_expira_em)
  VALUES
    (v_ap_exp_noname, v_acordo_exp_noname, v_pax_noname, 'reservado', 20000, 0, now() - interval '1 hour'),
    (v_ap_exp_act2, v_acordo_exp_noname, v_pax2, 'activo', 20000, 1, NULL);

  DELETE FROM public.notificacoes;

  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.apply_due_reserva_expiry(v_acordo_exp_noname);
  RESET ROLE;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_driver
    AND mensagem = 'A reserva de um passageiro expirou. O acordo continua.';

  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL G2 sem nome: notif motorista (n=%)', v_n;
  END IF;

  -- v1.14 flexível: motorista remove último — passageiro card info, motorista sem notif
  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo_driver, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES (v_ap_driver, v_acordo_driver, v_pax2, 'activo', 20000, 0);

  DELETE FROM public.notificacoes;

  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo_driver, v_pax2, gen_random_uuid());
  RESET ROLE;

  SELECT COUNT(*)::integer INTO v_n FROM public.notificacoes WHERE user_id = v_driver;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'FAIL driver remove: motorista não devia ser notificado (n=%)', v_n;
  END IF;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_pax2
    AND mensagem = 'O motorista retirou-te do acordo, que foi encerrado.'
    AND lower(tipo) = 'info';

  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL v1.14 flex: passageiro (n=%)', v_n;
  END IF;

  SELECT metadata INTO v_meta
  FROM public.notificacoes
  WHERE user_id = v_pax2
    AND mensagem = 'O motorista retirou-te do acordo, que foi encerrado.'
  LIMIT 1;

  IF v_meta->>'card' <> 'v1.14' OR v_meta->>'titulo' <> 'Acordo encerrado' THEN
    RAISE EXCEPTION 'FAIL v1.14 flex metadata: %', v_meta;
  END IF;

  IF EXISTS (SELECT 1 FROM public.notificacoes WHERE user_id = v_pax2 AND link IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL v1.14: sem CTA/link';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notificacoes
    WHERE user_id = v_pax2 AND mensagem = 'O teu acordo de boleia foi cancelado.'
  ) THEN
    RAISE EXCEPTION 'FAIL v1.14: copy antiga cancelado ainda presente';
  END IF;

  -- v1.14 com rota OD real
  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado, origin_name, destination_name
  ) VALUES (
    v_driver, v_veiculo, false, '08:00', 4, 4, 'POR_PASSAGEIRO', 20000, 'disponivel',
    'Talatona', 'Belas Shopping'
  ) RETURNING id INTO v_oferta_fixa;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo_driver_od, v_oferta_fixa, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES ('e4444444-4444-4444-8444-444444444443', v_acordo_driver_od, v_pax_named, 'activo', 20000, 0);

  DELETE FROM public.notificacoes;

  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo_driver_od, v_pax_named, gen_random_uuid());
  RESET ROLE;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_pax_named
    AND mensagem = 'O motorista retirou-te do acordo Talatona → Belas Shopping, que foi encerrado.';

  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL v1.14 com rota (n=%)', v_n;
  END IF;

  PERFORM set_config('session_replication_role', 'origin', true);
  RAISE NOTICE 'PASS driver-notif-passenger-exit: G1 G2 G3 driver-remove';
END $$;
