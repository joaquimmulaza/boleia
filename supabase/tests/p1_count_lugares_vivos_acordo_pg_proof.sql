-- P1: count_lugares_vivos_acordo — participante permitido, terceiro negado.
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_driver uuid := 'd5d55555-5555-4555-8555-555555555555';
  v_pax1 uuid := 'd5d55555-5555-4555-8555-555555555556';
  v_pax2 uuid := 'd5d55555-5555-4555-8555-555555555557';
  v_outsider uuid := 'd5d55555-5555-4555-8555-555555555599';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo uuid := 'd5d55555-5555-4555-8555-555555555544';
  v_n integer;
  v_err text;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'p1c-driver@test'),
    (v_pax1, 'p1c-pax1@test'),
    (v_pax2, 'p1c-pax2@test'),
    (v_outsider, 'p1c-out@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'P1C Driver', '935000001', 'Motorista'),
    (v_pax1, 'P1C Pax1', '935000002', 'Passageiro'),
    (v_pax2, 'P1C Pax2', '935000003', 'Passageiro'),
    (v_outsider, 'P1C Out', '935000099', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'P1C', 'P1C-1', 5, 4) RETURNING id INTO v_veiculo;

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

  INSERT INTO public.acordos_passageiros (acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao)
  VALUES
    (v_acordo, v_pax1, 'activo', 20000, 0),
    (v_acordo, v_pax2, 'reservado', 20000, 1);

  PERFORM set_config('session_replication_role', 'origin', true);

  PERFORM set_config('request.jwt.claim.sub', v_pax1::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  v_n := public.count_lugares_vivos_acordo(v_acordo);
  RESET ROLE;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'FAIL P1C1: passageiro devia ver 2 vivos (n=%)', v_n;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.count_lugares_vivos_acordo(v_acordo);
    RAISE EXCEPTION 'FAIL P1C2: motorista devia ser negado';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err NOT ILIKE '%Sem permissão%' THEN
        RAISE;
      END IF;
  END;
  RESET ROLE;

  UPDATE public.acordos_passageiros
  SET estado = 'saiu'
  WHERE acordo_id = v_acordo AND passenger_id = v_pax2;

  PERFORM set_config('request.jwt.claim.sub', v_pax2::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.count_lugares_vivos_acordo(v_acordo);
    RAISE EXCEPTION 'FAIL P1C2b: passageiro saiu devia ser negado';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err NOT ILIKE '%Sem permissão%' THEN
        RAISE;
      END IF;
  END;
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_pax1::text, true);
  SET LOCAL ROLE authenticated;
  v_n := public.count_lugares_vivos_acordo(v_acordo);
  RESET ROLE;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL P1C2c: passageiro vivo devia ver 1 (n=%)', v_n;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_outsider::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.count_lugares_vivos_acordo(v_acordo);
    RAISE EXCEPTION 'FAIL P1C3: outsider devia ser negado';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err NOT ILIKE '%Sem permissão%' THEN
        RAISE;
      END IF;
  END;
  RESET ROLE;

  RAISE NOTICE 'PASS P1C: count_lugares_vivos_acordo permitido/negado';
END $$;
