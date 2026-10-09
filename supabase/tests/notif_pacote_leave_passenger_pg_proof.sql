-- Pacote notificações: leave_passenger — parcial vs último passageiro, skip trigger cancelado.
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
  v_n integer;
  v_estado text;
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

  -- Acordo com 2 activos → saída parcial
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

  -- Último passageiro com nome
  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo_last, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES (v_ap_last, v_acordo_last, v_pax_named, 'activo', 20000, 0);

  -- reservado único sem nome → último + regressão saiu
  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo_res, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES (v_ap_res, v_acordo_res, v_pax_noname, 'reservado', 20000, 0);

  -- Motorista remove passageiro
  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo_driver, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES (v_ap_driver, v_acordo_driver, v_pax2, 'activo', 20000, 0);

  PERFORM set_config('session_replication_role', 'origin', true);

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

  DELETE FROM public.notificacoes WHERE user_id = v_driver;

  -- Último passageiro com nome → encerrado, sem link, exactamente uma notif, sem genérico
  PERFORM set_config('request.jwt.claim.sub', v_pax_named::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo_last, v_pax_named, gen_random_uuid());
  RESET ROLE;

  IF lower((SELECT estado FROM public.acordos WHERE id = v_acordo_last)) <> 'cancelado' THEN
    RAISE EXCEPTION 'FAIL NPC: acordo último pax devia estar cancelado';
  END IF;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_driver
    AND mensagem = 'Maria Silva saiu e o acordo foi encerrado. A tua oferta continua publicada.'
    AND link IS NULL;

  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL NPC: último pax com nome — uma notif sem link (n=%)', v_n;
  END IF;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes WHERE user_id = v_driver;

  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL NPC: motorista devia ter exactamente 1 notif (n=%)', v_n;
  END IF;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_driver AND mensagem = 'Um acordo foi cancelado.';

  IF v_n <> 0 THEN
    RAISE EXCEPTION 'FAIL NPC: cancelado genérico após último pax (n=%)', v_n;
  END IF;

  DELETE FROM public.notificacoes WHERE user_id = v_driver;

  -- reservado → saiu + último sem nome
  PERFORM set_config('request.jwt.claim.sub', v_pax_noname::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo_res, v_pax_noname, gen_random_uuid());
  RESET ROLE;

  SELECT lower(estado) INTO v_estado
  FROM public.acordos_passageiros
  WHERE id = v_ap_res;

  IF v_estado <> 'saiu' THEN
    RAISE EXCEPTION 'FAIL NPC: reservado não passou a saiu (estado=%)', v_estado;
  END IF;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_driver
    AND mensagem = 'O último passageiro saiu e o acordo foi encerrado. A tua oferta continua publicada.'
    AND link IS NULL;

  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL NPC: último pax sem nome (n=%)', v_n;
  END IF;

  DELETE FROM public.notificacoes WHERE user_id = v_driver;

  -- Motorista a remover passageiro: sem notificação para si
  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo_driver, v_pax2, gen_random_uuid());
  RESET ROLE;

  SELECT COUNT(*)::integer INTO v_n FROM public.notificacoes WHERE user_id = v_driver;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'FAIL NPC: motorista caller não devia receber notificação (n=%)', v_n;
  END IF;

  RAISE NOTICE 'PASS NPC: leave_passenger parcial/último/skip cancelado/sem notif motorista';
END $$;
