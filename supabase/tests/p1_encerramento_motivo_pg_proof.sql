-- encerramento_motivo: só leave_passenger (não terminate); parcial vs último; motorista remove último.
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_driver uuid := '0e111111-1111-4111-8111-111111111111';
  v_pax1 uuid := '0e222222-2222-4222-8222-222222222222';
  v_pax2 uuid := '0e333333-3333-4333-8333-333333333333';
  v_pax_solo uuid := '0e444444-4444-4444-8444-444444444444';
  v_pax_cons uuid := '0e4aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_pax_jc uuid := '0e4bbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_pax_cp uuid := '0e4ccccc-cccc-4ccc-8ccc-cccccccccccc';
  v_veiculo uuid;
  v_oferta uuid;
  v_oferta_solo uuid;
  v_oferta_cons uuid;
  v_oferta_jc uuid;
  v_oferta_cp uuid;
  v_procura uuid;
  v_procura_solo uuid;
  v_procura_cons uuid;
  v_procura_jc uuid;
  v_procura_cp uuid;
  v_acordo uuid := '0e555555-5555-4555-8555-555555555555';
  v_acordo_solo uuid := '0e666666-6666-4666-8666-666666666666';
  v_acordo_cons uuid := '0e6aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_acordo_jc uuid := '0e6bbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_acordo_cp uuid := '0e6ccccc-cccc-4ccc-8ccc-cccccccccccc';
  v_ap1 uuid := '0e777777-7777-4777-8777-777777777777';
  v_ap2 uuid := '0e888888-8888-4888-8888-888888888888';
  v_ap_solo uuid := '0e999999-9999-4999-8999-999999999999';
  v_ap_cons uuid := '0e7aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_ap_jc uuid := '0e7bbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_ap_cp uuid := '0e7ccccc-cccc-4ccc-8ccc-cccccccccccc';
  v_motivo text;
  v_estado text;
  v_key1 uuid := '0e011111-1111-4111-8111-111111111111';
  v_key2 uuid := '0e022222-2222-4222-8222-222222222222';
  v_key_jc uuid := '0e033333-3333-4333-8333-333333333333';
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'p1m-driver@test'),
    (v_pax1, 'p1m-pax1@test'),
    (v_pax2, 'p1m-pax2@test'),
    (v_pax_solo, 'p1m-paxsolo@test'),
    (v_pax_cons, 'p1m-paxcons@test'),
    (v_pax_jc, 'p1m-paxjc@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'P1M Driver', '932000001', 'Motorista'),
    (v_pax1, 'P1M Pax1', '932000002', 'Passageiro'),
    (v_pax2, 'P1M Pax2', '932000003', 'Passageiro'),
    (v_pax_solo, 'P1M Solo', '932000004', 'Passageiro'),
    (v_pax_cons, 'P1M Cons', '932000005', 'Passageiro'),
    (v_pax_jc, 'P1M JC', '932000006', 'Passageiro')
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

  INSERT INTO public.ofertas_capacidade (
    id, driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (
    '0ecaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', v_driver, v_veiculo, true, '09:00', 4, 4,
    'POR_PASSAGEIRO', 20000, 'disponivel'
  ) RETURNING id INTO v_oferta_cons;

  INSERT INTO public.ofertas_capacidade (
    id, driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (
    '0edaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', v_driver, v_veiculo, true, '10:00', 4, 4,
    'POR_PASSAGEIRO', 20000, 'disponivel'
  ) RETURNING id INTO v_oferta_jc;

  INSERT INTO public.ofertas_capacidade (
    id, driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado, is_test
  ) VALUES (
    '0eeccccc-cccc-4ccc-8ccc-cccccccccccc', v_driver, v_veiculo, true, '11:00', 4, 4,
    'POR_PASSAGEIRO', 20000, 'disponivel', true
  ) RETURNING id INTO v_oferta_cp;

  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax1, '07:30', 2, 'activa') RETURNING id INTO v_procura;
  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax_solo, '08:30', 1, 'activa') RETURNING id INTO v_procura_solo;
  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax_cons, '09:30', 1, 'activa') RETURNING id INTO v_procura_cons;
  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax_jc, '10:30', 1, 'activa') RETURNING id INTO v_procura_jc;
  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax_cp, '11:30', 1, 'activa') RETURNING id INTO v_procura_cp;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES
    (v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 2, 40000, 20000, 'activo', 22),
    (v_acordo_solo, v_oferta_solo, v_procura_solo, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22),
    (v_acordo_cons, v_oferta_cons, v_procura_cons, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22),
    (v_acordo_jc, v_oferta_jc, v_procura_jc, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22),
    (v_acordo_cp, v_oferta_cp, v_procura_cp, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'cancelamento_pendente', 22);

  UPDATE public.acordos
  SET rescisao_modo = 'consensual',
      rescisao_confirmada_em = NULL
  WHERE id = v_acordo_cp;

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES
    (v_ap1, v_acordo, v_pax1, 'activo', 20000, 0),
    (v_ap2, v_acordo, v_pax2, 'activo', 20000, 1),
    (v_ap_solo, v_acordo_solo, v_pax_solo, 'activo', 20000, 0),
    (v_ap_cons, v_acordo_cons, v_pax_cons, 'activo', 20000, 0),
    (v_ap_jc, v_acordo_jc, v_pax_jc, 'activo', 20000, 0),
    (v_ap_cp, v_acordo_cp, v_pax_cp, 'activo', 20000, 0);

  PERFORM set_config('session_replication_role', 'origin', true);

  -- Saída parcial
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
    RAISE EXCEPTION 'FAIL P1M: saída parcial não deve definir encerramento_motivo (=%)', v_motivo;
  END IF;

  -- Último passageiro (self-leave)
  PERFORM set_config('request.jwt.claim.sub', v_pax2::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo, v_pax2, gen_random_uuid());
  RESET ROLE;

  SELECT encerramento_motivo INTO v_motivo FROM public.acordos WHERE id = v_acordo;
  IF lower((SELECT estado FROM public.acordos WHERE id = v_acordo)) <> 'cancelado'
     OR v_motivo IS DISTINCT FROM 'sem_lugares_vivos' THEN
    RAISE EXCEPTION 'FAIL P1M: último leave (pax) devia cancelar com sem_lugares_vivos';
  END IF;

  -- Motorista remove último passageiro
  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo_solo, v_pax_solo, gen_random_uuid());
  RESET ROLE;

  SELECT encerramento_motivo INTO v_motivo FROM public.acordos WHERE id = v_acordo_solo;
  IF v_motivo IS DISTINCT FROM 'sem_lugares_vivos' THEN
    RAISE EXCEPTION 'FAIL P1M: motorista remove último devia definir sem_lugares_vivos (=%)', v_motivo;
  END IF;

  -- Consensual imediato: pedido + confirmação — sem encerramento_motivo
  PERFORM set_config('request.jwt.claim.sub', v_pax_cons::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.terminate_agreement(v_acordo_cons, 'consensual', NULL, v_key1, 'imediato');
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.terminate_agreement(v_acordo_cons, 'consensual', NULL, v_key2, 'imediato');
  RESET ROLE;

  SELECT lower(estado), encerramento_motivo INTO v_estado, v_motivo
  FROM public.acordos WHERE id = v_acordo_cons;
  IF v_estado <> 'cancelado' THEN
    RAISE EXCEPTION 'FAIL P1M: consensual imediato devia terminar cancelado (=%)', v_estado;
  END IF;
  IF v_motivo IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL P1M: consensual imediato não deve definir encerramento_motivo (=%)', v_motivo;
  END IF;

  -- Justa causa (avaria_veiculo) — sem encerramento_motivo
  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.terminate_agreement(v_acordo_jc, 'justa_causa', 'avaria_veiculo', v_key_jc, 'imediato');
  RESET ROLE;

  SELECT lower(estado), encerramento_motivo INTO v_estado, v_motivo
  FROM public.acordos WHERE id = v_acordo_jc;
  IF v_estado <> 'cancelado_justificado' THEN
    RAISE EXCEPTION 'FAIL P1M: justa_causa devia terminar cancelado_justificado (=%)', v_estado;
  END IF;
  IF v_motivo IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL P1M: justa_causa não deve definir encerramento_motivo (=%)', v_motivo;
  END IF;

  -- Consensual pendente (sem confirmação): último leave define sem_lugares_vivos
  PERFORM set_config('request.jwt.claim.sub', v_pax_cp::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo_cp, v_pax_cp, gen_random_uuid());
  RESET ROLE;

  SELECT encerramento_motivo INTO v_motivo FROM public.acordos WHERE id = v_acordo_cp;
  SELECT lower(estado) INTO v_estado FROM public.acordos WHERE id = v_acordo_cp;
  IF v_estado <> 'cancelado' OR v_motivo IS DISTINCT FROM 'sem_lugares_vivos' THEN
    RAISE EXCEPTION 'FAIL P1M: consensual pendente + último leave devia sem_lugares_vivos (estado=%, motivo=%)', v_estado, v_motivo;
  END IF;

  RAISE NOTICE 'PASS P1M: encerramento_motivo leave vs terminate';
END $$;
