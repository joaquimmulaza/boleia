-- P1 soft: confirmação consensual com acordo já fechado sem rescisao_confirmada_em → status ja_encerrado.
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_driver uuid := 'd1111111-1111-4111-8111-111111111111';
  v_pax uuid := 'd2222222-2222-4222-8222-222222222222';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo uuid := 'd4444444-4444-4444-8444-444444444444';
  v_ap uuid := 'd7777777-7777-4777-8777-777777777777';
  v_out jsonb;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'p1j-driver@test'),
    (v_pax, 'p1j-pax@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'P1J Driver', '933000001', 'Motorista'),
    (v_pax, 'P1J Pax', '933000002', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'P1J', 'P1J-1', 4, 3) RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (v_driver, v_veiculo, true, '07:00', 3, 3, 'POR_PASSAGEIRO', 20000, 'disponivel')
  RETURNING id INTO v_oferta;

  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax, '07:30', 1, 'activa') RETURNING id INTO v_procura;

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
    RAISE EXCEPTION 'FAIL P1J: esperava status ja_encerrado, obteve %', v_out;
  END IF;

  RAISE NOTICE 'PASS P1J: terminate consensual devolve ja_encerrado sem confirmação prévia';
END $$;

-- B5: último passageiro sai → acordo cancelado; motorista confirma pedido consensual pendente → ja_encerrado
DO $$
DECLARE
  v_driver uuid := 'd3111111-1111-4111-8111-111111111111';
  v_pax uuid := 'd3222222-2222-4222-8222-222222222222';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo uuid := 'd3444444-4444-4444-8444-444444444444';
  v_ap uuid := 'd3777777-7777-4777-8777-777777777777';
  v_out jsonb;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'p1j2-driver@test'),
    (v_pax, 'p1j2-pax@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'P1J2 Driver', '933000011', 'Motorista'),
    (v_pax, 'P1J2 Pax', '933000012', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'P1J2', 'P1J2-1', 4, 3) RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (v_driver, v_veiculo, true, '07:00', 3, 3, 'POR_PASSAGEIRO', 20000, 'disponivel')
  RETURNING id INTO v_oferta;

  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax, '07:30', 1, 'activa') RETURNING id INTO v_procura;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes,
    rescisao_modo, rescisao_solicitada_por, rescisao_vigencia
  ) VALUES (
    v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000,
    'activo', 22, 'consensual', v_pax, 'imediato'
  );

  INSERT INTO public.acordos_passageiros (
    id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao
  ) VALUES (v_ap, v_acordo, v_pax, 'activo', 20000, 0);

  PERFORM set_config('session_replication_role', 'origin', true);

  PERFORM set_config('request.jwt.claim.sub', v_pax::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo, v_pax, gen_random_uuid());
  RESET ROLE;

  IF lower((SELECT estado FROM public.acordos WHERE id = v_acordo)) <> 'cancelado' THEN
    RAISE EXCEPTION 'FAIL P1J2: acordo devia estar cancelado após último passageiro sair';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  SET LOCAL ROLE authenticated;
  v_out := public.terminate_agreement(v_acordo, 'consensual', NULL, gen_random_uuid(), 'imediato');
  RESET ROLE;

  IF COALESCE(v_out->>'status', '') <> 'ja_encerrado' THEN
    RAISE EXCEPTION 'FAIL P1J2: esperava ja_encerrado após leave, obteve %', v_out;
  END IF;

  RAISE NOTICE 'PASS P1J2: consensual pendente + último pax saiu → confirmação ja_encerrado';
END $$;
