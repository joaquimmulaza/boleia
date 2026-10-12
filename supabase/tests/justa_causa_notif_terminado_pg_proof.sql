-- Justa causa imediata: notificações + motivo lugar Terminado + suppress não forjável.
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_driver uuid := '0e111111-1111-4111-8111-111111111111';
  v_pax uuid := '0e222222-2222-4222-8222-222222222222';
  v_pax2 uuid := '0e333333-3333-4333-8333-333333333333';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo uuid := '0e444444-4444-4444-8444-444444444444';
  v_ap_res uuid := '0e777777-7777-4777-8777-777777777777';
  v_ap_act uuid := '0e888888-8888-4888-8888-888888888888';
  v_pg_res uuid := '0e999999-9999-4999-8999-999999999999';
  v_key uuid := '0eaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_mes date := date_trunc('month', timezone('Africa/Luanda', now()))::date;
  v_n_pax int;
  v_n_pax_generic int;
  v_n_driver int;
  v_motivo text;
  v_estado_ap text;
  v_forge_ok boolean := false;
  v_out jsonb;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'jc-driver@test'),
    (v_pax, 'jc-pax@test'),
    (v_pax2, 'jc-pax2@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'JC Driver', '934000001', 'Motorista'),
    (v_pax, 'JC Pax', '934000002', 'Passageiro'),
    (v_pax2, 'JC Pax2', '934000003', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'JC', 'JC-1', 4, 3) RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (v_driver, v_veiculo, true, '07:00', 2, 2, 'POR_PASSAGEIRO', 20000, 'disponivel')
  RETURNING id INTO v_oferta;

  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax, '07:30', 2, 'activa') RETURNING id INTO v_procura;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 2, 40000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES
    (v_ap_res, v_acordo, v_pax, 'reservado', 20000, 0),
    (v_ap_act, v_acordo, v_pax2, 'activo', 20000, 1);

  INSERT INTO public.pagamentos_acordo (
    id, acordo_passageiro_id, acordo_id, passenger_id, driver_id,
    valor_kz, valor_quota_original_kz, valor_payout_liquido_kz, take_rate_pct, mes_referencia, estado
  ) VALUES (
    v_pg_res, v_ap_res, v_acordo, v_pax, v_driver,
    20000, 20000, 18000, 0.10, v_mes, 'pendente_pagamento'
  );

  DELETE FROM public.notificacoes
  WHERE (metadata->>'acordo_id')::uuid = v_acordo;

  PERFORM set_config('session_replication_role', 'origin', true);

  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  v_out := public.terminate_agreement(v_acordo, 'justa_causa', 'avaria_veiculo', v_key, 'imediato');
  RESET ROLE;

  IF COALESCE(v_out->>'status', '') <> 'ok' THEN
    RAISE EXCEPTION 'FAIL JC: terminate devia status ok, obteve %', v_out;
  END IF;

  SELECT COUNT(*) INTO v_n_pax
  FROM public.notificacoes n
  WHERE n.user_id = v_pax
    AND (n.metadata->>'acordo_id')::uuid = v_acordo
    AND n.mensagem = 'A outra parte rescindiu o acordo por justa causa.';

  IF v_n_pax <> 1 THEN
    RAISE EXCEPTION 'FAIL JC: contraparte devia receber 1 notif justa causa (n=%)', v_n_pax;
  END IF;

  SELECT COUNT(*) INTO v_n_pax_generic
  FROM public.notificacoes n
  WHERE n.user_id IN (v_pax, v_pax2)
    AND (n.metadata->>'acordo_id')::uuid = v_acordo
    AND n.mensagem = 'O teu acordo de boleia foi cancelado.';

  IF v_n_pax_generic <> 0 THEN
    RAISE EXCEPTION 'FAIL JC: passageiros não devem receber cancelamento genérico (n=%)', v_n_pax_generic;
  END IF;

  SELECT COUNT(*) INTO v_n_driver
  FROM public.notificacoes n
  WHERE n.user_id = v_driver
    AND (n.metadata->>'acordo_id')::uuid = v_acordo;

  IF v_n_driver <> 0 THEN
    RAISE EXCEPTION 'FAIL JC: actor (motorista) devia ter 0 notificações (n=%)', v_n_driver;
  END IF;

  SELECT lower(estado) INTO v_estado_ap
  FROM public.acordos_passageiros WHERE id = v_ap_res;

  IF v_estado_ap <> 'expirado' THEN
    RAISE EXCEPTION 'FAIL JC: lugar reservado devia expirado (=%)', v_estado_ap;
  END IF;

  SELECT anulacao_motivo INTO v_motivo
  FROM public.pagamentos_acordo WHERE id = v_pg_res;

  IF v_motivo IS DISTINCT FROM 'Rescisão por justa causa' THEN
    RAISE EXCEPTION 'FAIL JC: anulacao_motivo devia «Rescisão por justa causa» (=%)', v_motivo;
  END IF;

  -- authenticated não forja suppress
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_pax::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO public._acordo_cancel_notif_suppress (
      acordo_id, txid, reason, suppress_driver, suppress_passenger
    ) VALUES (v_acordo, txid_current(), 'forge', true, true);
    RESET ROLE;
    v_forge_ok := true;
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_forge_ok := false;
  END;

  IF v_forge_ok THEN
    RAISE EXCEPTION 'FAIL JC: authenticated não devia INSERT em _acordo_cancel_notif_suppress';
  END IF;

  RAISE NOTICE 'PASS JC: justa causa notif + motivo Terminado + suppress';
END $$;

-- ja_encerrado (regressão B5)
DO $$
DECLARE
  v_driver uuid := '0e511111-1111-4111-8111-111111111111';
  v_pax uuid := '0e522222-2222-4222-8222-222222222222';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo uuid := '0e544444-4444-4444-8444-444444444444';
  v_ap uuid := '0e577777-7777-4777-8777-777777777777';
  v_out jsonb;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'jc5-driver@test'),
    (v_pax, 'jc5-pax@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'JC5 Driver', '935000001', 'Motorista'),
    (v_pax, 'JC5 Pax', '935000002', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'JC5', 'JC5-1', 4, 3) RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (v_driver, v_veiculo, true, '08:00', 3, 3, 'POR_PASSAGEIRO', 20000, 'disponivel')
  RETURNING id INTO v_oferta;

  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax, '08:30', 1, 'activa') RETURNING id INTO v_procura;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes,
    rescisao_modo, rescisao_solicitada_por, rescisao_vigencia
  ) VALUES (
    v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000,
    'cancelado', 22, 'consensual', v_pax, 'imediato'
  );

  INSERT INTO public.acordos_passageiros (
    id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao
  ) VALUES (v_ap, v_acordo, v_pax, 'saiu', 20000, 0);

  PERFORM set_config('session_replication_role', 'origin', true);

  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  v_out := public.terminate_agreement(v_acordo, 'consensual', NULL, gen_random_uuid(), 'imediato');
  RESET ROLE;

  IF COALESCE(v_out->>'status', '') <> 'ja_encerrado' THEN
    RAISE EXCEPTION 'FAIL JC5: esperava ja_encerrado, obteve %', v_out;
  END IF;

  RAISE NOTICE 'PASS JC5: ja_encerrado intacto';
END $$;

-- Consensual imediato confirmado: suppress antes de finalize (actor 0 genéricas; contraparte 1 específica).
DO $$
DECLARE
  v_driver uuid := '0e611111-1111-4111-8111-111111111111';
  v_pax uuid := '0e622222-2222-4222-8222-222222222222';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo uuid := '0e644444-4444-4444-8444-444444444444';
  v_ap uuid := '0e677777-7777-4777-8777-777777777777';
  v_key1 uuid := '0e6aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_key2 uuid := '0e6bbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_out jsonb;
  v_n_driver_specific int;
  v_n_driver_generic int;
  v_n_pax_total int;
  v_msg_specific constant text :=
    'A rescisão consensual foi confirmada; o acordo está encerrado com ajuste proporcional.';
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'jc6-driver@test'),
    (v_pax, 'jc6-pax@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'JC6 Driver', '936000001', 'Motorista'),
    (v_pax, 'JC6 Pax', '936000002', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'JC6', 'JC6-1', 4, 3) RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (v_driver, v_veiculo, true, '09:00', 2, 2, 'POR_PASSAGEIRO', 20000, 'disponivel')
  RETURNING id INTO v_oferta;

  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax, '09:30', 1, 'activa') RETURNING id INTO v_procura;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES (v_ap, v_acordo, v_pax, 'activo', 20000, 0);

  DELETE FROM public.notificacoes
  WHERE (metadata->>'acordo_id')::uuid = v_acordo;

  PERFORM set_config('session_replication_role', 'origin', true);

  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  v_out := public.terminate_agreement(v_acordo, 'consensual', NULL, v_key1, 'imediato');
  RESET ROLE;

  IF COALESCE(v_out->>'status', '') <> 'ok' THEN
    RAISE EXCEPTION 'FAIL JC6: pedido consensual devia ok, obteve %', v_out;
  END IF;

  DELETE FROM public.notificacoes
  WHERE (metadata->>'acordo_id')::uuid = v_acordo;

  PERFORM set_config('request.jwt.claim.sub', v_pax::text, true);
  SET LOCAL ROLE authenticated;
  v_out := public.terminate_agreement(v_acordo, 'consensual', NULL, v_key2, 'imediato');
  RESET ROLE;

  IF COALESCE(v_out->>'status', '') <> 'ok' THEN
    RAISE EXCEPTION 'FAIL JC6: confirmação consensual devia ok, obteve %', v_out;
  END IF;

  SELECT COUNT(*) INTO v_n_driver_specific
  FROM public.notificacoes n
  WHERE n.user_id = v_driver
    AND (n.metadata->>'acordo_id')::uuid = v_acordo
    AND n.mensagem = v_msg_specific;

  IF v_n_driver_specific <> 1 THEN
    RAISE EXCEPTION 'FAIL JC6: motorista devia receber 1 notif consensual específica (n=%)', v_n_driver_specific;
  END IF;

  SELECT COUNT(*) INTO v_n_driver_generic
  FROM public.notificacoes n
  WHERE n.user_id = v_driver
    AND (n.metadata->>'acordo_id')::uuid = v_acordo
    AND n.mensagem = 'Um acordo foi cancelado.';

  IF v_n_driver_generic <> 0 THEN
    RAISE EXCEPTION 'FAIL JC6: motorista não devia receber cancelamento genérico (n=%)', v_n_driver_generic;
  END IF;

  SELECT COUNT(*) INTO v_n_pax_total
  FROM public.notificacoes n
  WHERE n.user_id = v_pax
    AND (n.metadata->>'acordo_id')::uuid = v_acordo;

  IF v_n_pax_total <> 0 THEN
    RAISE EXCEPTION 'FAIL JC6: actor (passageiro) devia ter 0 notificações (n=%)', v_n_pax_total;
  END IF;

  RAISE NOTICE 'PASS JC6: consensual imediato confirmado — suppress + notif';
END $$;
