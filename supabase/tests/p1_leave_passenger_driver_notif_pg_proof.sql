-- P1 regra 3: leave_passenger (saída parcial) notifica motorista.
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_driver uuid := 'b1111111-1111-4111-8111-111111111111';
  v_pax1 uuid := 'b2222222-2222-4222-8222-222222222222';
  v_pax2 uuid := 'b3333333-3333-4333-8333-333333333333';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo uuid := 'b4444444-4444-4444-8444-444444444444';
  v_ap1 uuid := 'b7777777-7777-4777-8777-777777777777';
  v_ap2 uuid := 'b8888888-8888-4888-8888-888888888888';
  v_n integer;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'p1l-driver@test'),
    (v_pax1, 'p1l-pax1@test'),
    (v_pax2, 'p1l-pax2@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'P1L Driver', '931000001', 'Motorista'),
    (v_pax1, 'P1L Pax1', '931000002', 'Passageiro'),
    (v_pax2, 'P1L Pax2', '931000003', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'P1L', 'P1L-1', 5, 4) RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (v_driver, v_veiculo, true, '07:00', 4, 4, 'POR_PASSAGEIRO', 20000, 'disponivel')
  RETURNING id INTO v_oferta;

  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax1, '07:30', 2, 'activa') RETURNING id INTO v_procura;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 2, 40000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES
    (v_ap1, v_acordo, v_pax1, 'activo', 20000, 0),
    (v_ap2, v_acordo, v_pax2, 'activo', 20000, 1);

  PERFORM set_config('session_replication_role', 'origin', true);

  PERFORM set_config('request.jwt.claim.sub', v_pax1::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo, v_pax1, gen_random_uuid());
  RESET ROLE;

  IF lower((SELECT estado FROM public.acordos WHERE id = v_acordo)) <> 'activo' THEN
    RAISE EXCEPTION 'FAIL P1L: acordo devia permanecer activo após saída parcial';
  END IF;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.notificacoes
  WHERE user_id = v_driver
    AND mensagem = 'P1L Pax1 saiu do acordo. Ficou um lugar livre.'
    AND metadata->>'type' = 'agreement_update'
    AND (metadata->>'acordo_id')::uuid = v_acordo;

  IF v_n < 1 THEN
    RAISE EXCEPTION 'FAIL P1L: motorista sem notificação de saída parcial (n=%)', v_n;
  END IF;

  RAISE NOTICE 'PASS P1L: leave_passenger notifica motorista';
END $$;
