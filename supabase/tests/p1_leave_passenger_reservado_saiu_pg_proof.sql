-- P1 / PR #249 guard: após 200000, saída com lugar reservado → estado saiu (não expirado TTL).
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_driver uuid := 'c1111111-1111-4111-8111-111111111111';
  v_pax uuid := 'c2222222-2222-4222-8222-222222222222';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo uuid := 'c4444444-4444-4444-8444-444444444444';
  v_ap uuid := 'c7777777-7777-4777-8777-777777777777';
  v_estado text;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'p1r-driver@test'),
    (v_pax, 'p1r-pax@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'P1R Driver', '932000001', 'Motorista'),
    (v_pax, 'P1R Pax', '932000002', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'P1R', 'P1R-1', 5, 4) RETURNING id INTO v_veiculo;

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

  PERFORM set_config('request.jwt.claim.sub', v_pax::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_passenger(v_acordo, v_pax, gen_random_uuid());
  RESET ROLE;

  SELECT lower(estado) INTO v_estado
  FROM public.acordos_passageiros
  WHERE id = v_ap;

  IF v_estado <> 'saiu' THEN
    RAISE EXCEPTION 'FAIL P1R: reservado leave devia dar saiu, obteve %', v_estado;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.acordos_passageiros
    WHERE id = v_ap AND lower(estado) = 'expirado'
  ) THEN
    RAISE EXCEPTION 'FAIL P1R: regressão TTL — estado expirado após saída voluntária';
  END IF;

  RAISE NOTICE 'PASS P1R: leave_passenger reservado → saiu (pós-200000)';
END $$;
