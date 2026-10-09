-- P1 encerramento_motivo: último leave marca motivo; parcial não; terminate não.
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_driver uuid := '0e111111-1111-4111-8111-111111111111';
  v_pax1 uuid := '0e222222-2222-4222-8222-222222222222';
  v_pax2 uuid := '0e333333-3333-4333-8333-333333333333';
  v_pax_solo uuid := '0e444444-4444-4444-8444-444444444444';
  v_veiculo uuid;
  v_oferta uuid;
  v_oferta_solo uuid;
  v_procura uuid;
  v_procura_solo uuid;
  v_acordo uuid := '0e555555-5555-4555-8555-555555555555';
  v_acordo_solo uuid := '0e666666-6666-4666-8666-666666666666';
  v_ap1 uuid := '0e777777-7777-4777-8777-777777777777';
  v_ap2 uuid := '0e888888-8888-4888-8888-888888888888';
  v_ap_solo uuid := '0e999999-9999-4999-8999-999999999999';
  v_motivo text;
  v_key uuid := '0e011111-1111-4111-8111-111111111111';
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'p1m-driver@test'),
    (v_pax1, 'p1m-pax1@test'),
    (v_pax2, 'p1m-pax2@test'),
    (v_pax_solo, 'p1m-paxsolo@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'P1M Driver', '932000001', 'Motorista'),
    (v_pax1, 'P1M Pax1', '932000002', 'Passageiro'),
    (v_pax2, 'P1M Pax2', '932000003', 'Passageiro'),
    (v_pax_solo, 'P1M Solo', '932000004', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'P1M', 'P1M-1', 5, 4) RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    id, driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (
    '0eaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', v_driver, v_veiculo, true, '07:00', 4, 4,
    'POR_PASSAGEIRO', 20000, 'disponivel'
  ) RETURNING id INTO v_oferta;

  INSERT INTO public.ofertas_capacidade (
    id, driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (
    '0ebaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', v_driver, v_veiculo, true, '08:00', 4, 4,
    'POR_PASSAGEIRO', 20000, 'disponivel'
  ) RETURNING id INTO v_oferta_solo;

  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax1, '07:30', 2, 'activa') RETURNING id INTO v_procura;

  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax_solo, '08:30', 1, 'activa') RETURNING id INTO v_procura_solo;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 2, 40000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo_solo, v_oferta_solo, v_procura_solo, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES
    (v_ap1, v_acordo, v_pax1, 'activo', 20000, 0),
    (v_ap2, v_acordo, v_pax2, 'activo', 20000, 1);

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES (v_ap_solo, v_acordo_solo, v_pax_solo, 'activo', 20000, 0);

  PERFORM set_config('session_replication_role', 'origin', true);

  -- Saída parcial: acordo activo, sem motivo
  PERFORM set_config('request.jwt.claim.sub', v_pax1::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo, v_pax1, gen_random_uuid());
  RESET ROLE;

  IF lower((SELECT estado FROM public.acordos WHERE id = v_acordo)) <> 'activo' THEN
    RAISE EXCEPTION 'FAIL P1M: acordo devia permanecer activo após saída parcial';
  END IF;

  SELECT encerramento_motivo INTO v_motivo FROM public.acordos WHERE id = v_acordo;
  IF v_motivo IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL P1M: saída parcial não deve definir encerramento_motivo (=%', v_motivo;
  END IF;

  -- Último passageiro vivo: cancelado + sem_lugares_vivos
  PERFORM set_config('request.jwt.claim.sub', v_pax2::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo, v_pax2, gen_random_uuid());
  RESET ROLE;

  SELECT encerramento_motivo INTO v_motivo FROM public.acordos WHERE id = v_acordo;
  IF lower((SELECT estado FROM public.acordos WHERE id = v_acordo)) <> 'cancelado'
     OR v_motivo IS DISTINCT FROM 'sem_lugares_vivos' THEN
    RAISE EXCEPTION 'FAIL P1M: último leave devia cancelar com sem_lugares_vivos (estado/motivo)';
  END IF;

  -- terminate consensual imediato: cancelado sem encerramento_motivo
  PERFORM set_config('request.jwt.claim.sub', v_pax_solo::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.terminate_agreement(v_acordo_solo, 'consensual', NULL, v_key, 'imediato');
  RESET ROLE;

  SELECT encerramento_motivo INTO v_motivo FROM public.acordos WHERE id = v_acordo_solo;
  IF v_motivo IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL P1M: terminate consensual não deve definir encerramento_motivo (=%', v_motivo;
  END IF;

  RAISE NOTICE 'PASS P1M: encerramento_motivo leave último / parcial / terminate';
END $$;
