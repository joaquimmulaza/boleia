-- v1.15: anulação não mantém «Pagamento mensal disponível…» no sino.
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_driver uuid := 'c1111111-1111-4111-8111-111111111111';
  v_pax uuid := 'c2222222-2222-4222-8222-222222222222';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo uuid := 'c3333333-3333-4333-8333-333333333333';
  v_ap uuid := 'c4444444-4444-4444-8444-444444444444';
  v_pg_before uuid := 'c5555555-5555-4555-8555-555555555555';
  v_pg_after uuid := 'c6666666-6666-4666-8666-666666666666';
  v_mes date := date_trunc('month', timezone('Africa/Luanda', now()))::date;
  v_n integer;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'v15-driver@test'),
    (v_pax, 'v15-pax@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'V15 Driver', '951000101', 'Motorista'),
    (v_pax, 'V15 Pax', '951000102', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'V15', 'V15-1', 5, 4) RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (v_driver, v_veiculo, true, '07:00', 4, 4, 'POR_PASSAGEIRO', 20000, 'disponivel')
  RETURNING id INTO v_oferta;

  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax, '07:30', 1, 'activa') RETURNING id INTO v_procura;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES (v_ap, v_acordo, v_pax, 'reservado', 20000, 0);

  PERFORM set_config('session_replication_role', 'origin', true);
  DELETE FROM public.notificacoes;

  -- v1.15 (a): INSERT já anulado — não criar aviso mensal
  INSERT INTO public.pagamentos_acordo (
    id, acordo_passageiro_id, acordo_id, passenger_id, driver_id,
    valor_kz, valor_quota_original_kz, valor_payout_liquido_kz, take_rate_pct, mes_referencia, estado
  ) VALUES (
    v_pg_before, v_ap, v_acordo, v_pax, v_driver,
    20000, 20000, 18000, 0.10, v_mes, 'anulado'
  );

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_pax
    AND mensagem = 'Pagamento mensal disponível — envia o comprovativo em Acordos.';

  IF v_n <> 0 THEN
    RAISE EXCEPTION 'FAIL v1.15(a): INSERT anulado não devia criar aviso mensal (n=%)', v_n;
  END IF;

  DELETE FROM public.pagamentos_acordo WHERE id = v_pg_before;
  DELETE FROM public.notificacoes;

  -- v1.15 (b): aviso enviado → anulação remove do sino
  INSERT INTO public.pagamentos_acordo (
    id, acordo_passageiro_id, acordo_id, passenger_id, driver_id,
    valor_kz, valor_quota_original_kz, valor_payout_liquido_kz, take_rate_pct, mes_referencia, estado
  ) VALUES (
    v_pg_after, v_ap, v_acordo, v_pax, v_driver,
    20000, 20000, 18000, 0.10, v_mes, 'pendente_pagamento'
  );

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_pax
    AND mensagem = 'Pagamento mensal disponível — envia o comprovativo em Acordos.';

  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL v1.15(b) setup: devia existir 1 aviso após INSERT (n=%)', v_n;
  END IF;

  PERFORM public._anular_pagamento_sem_divida(v_pg_after, 'Prova v1.15');

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_pax
    AND mensagem = 'Pagamento mensal disponível — envia o comprovativo em Acordos.';

  IF v_n <> 0 THEN
    RAISE EXCEPTION 'FAIL v1.15(b): após anulação aviso devia desaparecer do sino (n=%)', v_n;
  END IF;

  RAISE NOTICE 'PASS pagamento-anulacao-v1.15';
END $$;
