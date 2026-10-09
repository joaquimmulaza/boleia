-- Pacote notificações: leave_passenger — nome na mensagem, regressão reservado→saiu, sem notif motorista.
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_driver uuid := 'c1111111-1111-4111-8111-111111111111';
  v_pax_named uuid := 'c2222222-2222-4222-8222-222222222222';
  v_pax_noname uuid := 'c3333333-3333-4333-8333-333333333333';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo_named uuid := 'c4444444-4444-4444-8444-444444444444';
  v_acordo_res uuid := 'c5555555-5555-4555-8555-555555555555';
  v_acordo_driver uuid := 'c6666666-6666-4666-8666-666666666666';
  v_ap_named uuid := 'c7777777-7777-4777-8777-777777777777';
  v_ap_res uuid := 'c8888888-8888-4888-8888-888888888888';
  v_ap_driver uuid := 'c9999999-9999-4999-8999-999999999999';
  v_n integer;
  v_estado text;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'npc-driver@test'),
    (v_pax_named, 'npc-pax-named@test'),
    (v_pax_noname, 'npc-pax-noname@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'NPC Driver', '941000001', 'Motorista'),
    (v_pax_named, 'Maria Silva', '941000002', 'Passageiro'),
    (v_pax_noname, '   ', '941000003', 'Passageiro')
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
    v_acordo_named, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 2, 40000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES (v_ap_named, v_acordo_named, v_pax_named, 'activo', 20000, 0);

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo_res, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES (v_ap_res, v_acordo_res, v_pax_noname, 'reservado', 20000, 0);

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo_driver, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES (v_ap_driver, v_acordo_driver, v_pax_named, 'activo', 20000, 0);

  PERFORM set_config('session_replication_role', 'origin', true);

  -- Saída activo com nome → mensagem personalizada + link openAcordoId
  PERFORM set_config('request.jwt.claim.sub', v_pax_named::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo_named, v_pax_named, gen_random_uuid());
  RESET ROLE;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_driver
    AND mensagem = 'Maria Silva saiu do acordo. Ficou um lugar livre.'
    AND link = '/acordos?openAcordoId=' || v_acordo_named::text;

  IF v_n < 1 THEN
    RAISE EXCEPTION 'FAIL NPC: motorista sem notificação com nome do passageiro';
  END IF;

  -- reservado → saiu (190000)
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
    AND mensagem = 'Um passageiro saiu do acordo.'
    AND link = '/acordos?openAcordoId=' || v_acordo_res::text;

  IF v_n < 1 THEN
    RAISE EXCEPTION 'FAIL NPC: mensagem genérica sem nome';
  END IF;

  -- Motorista a remover passageiro: sem notificação para si
  DELETE FROM public.notificacoes WHERE user_id = v_driver;

  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo_driver, v_pax_named, gen_random_uuid());
  RESET ROLE;

  SELECT COUNT(*)::integer INTO v_n FROM public.notificacoes WHERE user_id = v_driver;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'FAIL NPC: motorista caller não devia receber notificação (n=%)', v_n;
  END IF;

  RAISE NOTICE 'PASS NPC: leave_passenger nome/link/reservado→saiu/sem notif motorista';
END $$;
