-- Prova PG: expiração último lugar (v1.8) + motorista remove não-último (v1.10).
-- Acções de passageiro com JWT do próprio passageiro (authenticated).
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_driver uuid := 'f1111111-1111-4111-8111-111111111111';
  v_pax_last uuid := 'f2222222-2222-4222-8222-222222222222';
  v_pax_a uuid := 'f3333333-3333-4333-8333-333333333333';
  v_pax_b uuid := 'f4444444-4444-4444-8444-444444444444';
  v_veiculo uuid;
  v_oferta_last uuid;
  v_oferta_fixa uuid;
  v_procura uuid;
  v_acordo_last uuid := 'f5555555-5555-4555-8555-555555555555';
  v_acordo_partial uuid := 'f6666666-6666-4666-8666-666666666666';
  v_ap_last uuid := 'f7777777-7777-4777-8777-777777777777';
  v_ap_a uuid := 'f8888888-8888-4888-8888-888888888888';
  v_ap_b uuid := 'f9999999-9999-4999-8999-999999999999';
  v_pg uuid := 'faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_mes date := date_trunc('month', timezone('Africa/Luanda', now()))::date;
  v_n integer;
  v_estado text;
  v_motivo text;
  v_rescisao_modo text;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'ecs-driver@test'),
    (v_pax_last, 'ecs-pax-last@test'),
    (v_pax_a, 'ecs-pax-a@test'),
    (v_pax_b, 'ecs-pax-b@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'ECS Driver', '951000001', 'Motorista'),
    (v_pax_last, 'ECS Last', '951000002', 'Passageiro'),
    (v_pax_a, 'ECS A', '951000003', 'Passageiro'),
    (v_pax_b, 'ECS B', '951000004', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'ECS', 'ECS-1', 5, 4) RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (v_driver, v_veiculo, true, '07:00', 4, 4, 'POR_PASSAGEIRO', 20000, 'disponivel')
  RETURNING id INTO v_oferta_last;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, origin_name, destination_name,
    origin_lat, origin_lng, destination_lat, destination_lng,
    departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (
    v_driver, v_veiculo, false, 'Talatona', 'Belas Shopping',
    -8.916, 13.234, -8.998, 13.264,
    '07:00', 4, 4, 'POR_PASSAGEIRO', 20000, 'disponivel'
  ) RETURNING id INTO v_oferta_fixa;

  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax_last, '07:30', 2, 'activa') RETURNING id INTO v_procura;

  -- EC1: único reservado expirado → encerrado sem_lugares_vivos + v1.8 motorista; pax sem notif
  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes,
    rescisao_modo, rescisao_solicitada_por, rescisao_solicitada_em
  ) VALUES (
    v_acordo_last, v_oferta_last, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22,
    'consensual', v_driver, now() - interval '1 day'
  );

  INSERT INTO public.acordos_passageiros (
    id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao, reservado_expira_em
  ) VALUES (
    v_ap_last, v_acordo_last, v_pax_last, 'reservado', 20000, 0, now() - interval '2 hours'
  );

  INSERT INTO public.pagamentos_acordo (
    id, acordo_passageiro_id, acordo_id, passenger_id, driver_id,
    valor_kz, valor_quota_original_kz, valor_payout_liquido_kz, take_rate_pct, mes_referencia, estado
  ) VALUES (
    v_pg, v_ap_last, v_acordo_last, v_pax_last, v_driver,
    20000, 20000, 18000, 0.10, v_mes, 'pendente_pagamento'
  );

  -- EC2: motorista remove um de dois (v1.10 fixa); outro pax e motorista sem notif
  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo_partial, v_oferta_fixa, v_procura, v_driver, 'POR_PASSAGEIRO', 2, 40000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES
    (v_ap_a, v_acordo_partial, v_pax_a, 'activo', 20000, 0),
    (v_ap_b, v_acordo_partial, v_pax_b, 'activo', 20000, 1);

  PERFORM set_config('session_replication_role', 'origin', true);
  DELETE FROM public.notificacoes;

  -- EC1: passageiro chama apply_due (JWT próprio)
  PERFORM set_config('request.jwt.claim.sub', v_pax_last::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.apply_due_reserva_expiry(v_acordo_last);
  RESET ROLE;

  SELECT lower(estado), encerramento_motivo, rescisao_modo
  INTO v_estado, v_motivo, v_rescisao_modo
  FROM public.acordos WHERE id = v_acordo_last;

  IF v_estado <> 'cancelado' OR v_motivo IS DISTINCT FROM 'sem_lugares_vivos' THEN
    RAISE EXCEPTION 'FAIL EC1: acordo devia cancelado sem_lugares_vivos (estado=%, motivo=%)', v_estado, v_motivo;
  END IF;

  IF v_rescisao_modo IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL EC1: pedido consensual pendente devia estar limpo (rescisao_modo=%)', v_rescisao_modo;
  END IF;

  SELECT COUNT(*)::integer INTO v_n FROM public.notificacoes WHERE user_id = v_pax_last;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'FAIL EC1: passageiro expirado não devia receber notificação (n=%)', v_n;
  END IF;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_driver
    AND mensagem = 'A última reserva expirou e o acordo foi encerrado. A tua oferta continua publicada.'
    AND metadata->>'card' = 'v1.8';

  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL EC1: motorista devia receber card v1.8 (n=%)', v_n;
  END IF;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_driver AND mensagem = 'Um acordo foi cancelado.';

  IF v_n <> 0 THEN
    RAISE EXCEPTION 'FAIL EC1: motorista não devia receber cancelamento genérico (n=%)', v_n;
  END IF;

  DELETE FROM public.notificacoes;

  -- EC2: motorista remove v_pax_a
  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo_partial, v_pax_a, gen_random_uuid());
  RESET ROLE;

  IF lower((SELECT estado FROM public.acordos WHERE id = v_acordo_partial)) <> 'activo' THEN
    RAISE EXCEPTION 'FAIL EC2: acordo parcial devia permanecer activo';
  END IF;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_pax_a
    AND metadata->>'card' = 'v1.10'
    AND metadata->>'titulo' = 'Já não fazes parte deste acordo'
    AND mensagem =
      'O motorista retirou-te do acordo Talatona → Belas Shopping. O teu lugar foi libertado.';

  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL EC2: removido devia receber v1.10 com rota (n=%)', v_n;
  END IF;

  SELECT COUNT(*)::integer INTO v_n FROM public.notificacoes WHERE user_id = v_driver;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'FAIL EC2: motorista caller não devia receber notificação (n=%)', v_n;
  END IF;

  SELECT COUNT(*)::integer INTO v_n FROM public.notificacoes WHERE user_id = v_pax_b;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'FAIL EC2: outro passageiro vivo não devia receber notificação (n=%)', v_n;
  END IF;

  RAISE NOTICE 'PASS EC1+EC2: expiry último lugar + driver remove parcial v1.10';
END $$;
