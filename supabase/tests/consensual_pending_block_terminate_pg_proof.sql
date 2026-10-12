-- Prova: com consensual pendente (activo), aviso/consensual rejeitam; justa_causa permitida.
-- Executar com psql contra projecto is_test (session_replication_role replica na seed).
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_driver uuid := 'c2631111-1111-4111-8111-111111111111';
  v_pax uuid := 'c2632222-2222-4222-8222-222222222222';
  v_pax2 uuid := 'c2633333-3333-4333-8333-333333333333';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo uuid := 'c2634444-4444-4444-8444-444444444444';
  v_ap uuid := 'c2637777-7777-4777-8777-777777777777';
  v_ap2 uuid := 'c2638888-8888-4888-8888-888888888888';
  v_key uuid := 'c263aaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_ok boolean;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'c263-driver@test'),
    (v_pax, 'c263-pax@test'),
    (v_pax2, 'c263-pax2@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'C263 Driver', '930263001', 'Motorista'),
    (v_pax, 'C263 Pax', '930263002', 'Passageiro'),
    (v_pax2, 'C263 Pax2', '930263003', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'C263', 'C263-1', 4, 3) RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (v_driver, v_veiculo, true, '07:00', 3, 3, 'POR_PASSAGEIRO', 20000, 'disponivel')
  RETURNING id INTO v_oferta;

  INSERT INTO public.procuras (owner_id, preferred_time, n_candidato, estado)
  VALUES (v_pax, '07:30', 1, 'activa') RETURNING id INTO v_procura;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 2, 40000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (
    id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao
  ) VALUES
    (v_ap, v_acordo, v_pax, 'activo', 20000, 0),
    (v_ap2, v_acordo, v_pax2, 'activo', 20000, 1);

  PERFORM set_config('session_replication_role', 'origin', true);

  PERFORM set_config('request.jwt.claim.sub', v_pax::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.terminate_agreement(v_acordo, 'consensual', NULL, gen_random_uuid(), 'imediato');
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  BEGIN
    PERFORM public.terminate_agreement(v_acordo, 'aviso_previo', NULL, gen_random_uuid(), 'imediato');
    RAISE EXCEPTION 'FAIL C263: aviso_previo devia falhar com consensual pendente';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%pedido de encerramento amigável pendente%' THEN
        RAISE;
      END IF;
  END;

  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_pax2::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  BEGIN
    PERFORM public.terminate_agreement(v_acordo, 'consensual', NULL, gen_random_uuid(), 'fim_ciclo');
    RAISE EXCEPTION 'FAIL C263: consensual reinit devia falhar com pendente';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%pedido de encerramento amigável pendente%' THEN
        RAISE;
      END IF;
  END;

  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  PERFORM public.terminate_agreement(v_acordo, 'justa_causa', 'avaria_veiculo', v_key, 'imediato');
  RESET ROLE;

  SELECT lower(estado) = 'cancelado_justificado' INTO v_ok FROM public.acordos WHERE id = v_acordo;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'FAIL C263: justa_causa devia encerrar acordo';
  END IF;

  RAISE NOTICE 'PASS C263: consensual pendente bloqueia aviso/consensual; justa_causa ok';
END $$;
