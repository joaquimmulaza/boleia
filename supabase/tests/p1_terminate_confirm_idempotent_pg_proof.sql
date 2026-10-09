-- P1 regra 1: segunda confirmação consensual imediata é no-op (sem excepção, sem notificação duplicada).
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_driver uuid := 'f1111111-1111-4111-8111-111111111111';
  v_pax uuid := 'f2222222-2222-4222-8222-222222222222';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo uuid := 'f4444444-4444-4444-8444-444444444444';
  v_ap uuid := 'f7777777-7777-4777-8777-777777777777';
  v_key1 uuid := 'a1111111-1111-4111-8111-111111111111';
  v_key2 uuid := 'a2222222-2222-4222-8222-222222222222';
  v_n_notif integer;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'p1t-driver@test'),
    (v_pax, 'p1t-pax@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'P1 Driver', '930000001', 'Motorista'),
    (v_pax, 'P1 Pax', '930000002', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'P1', 'P1-1', 4, 3) RETURNING id INTO v_veiculo;

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
    v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1, 20000, 20000, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (
    id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao
  ) VALUES (v_ap, v_acordo, v_pax, 'activo', 20000, 0);

  PERFORM set_config('session_replication_role', 'origin', true);

  PERFORM set_config('request.jwt.claim.sub', v_pax::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.terminate_agreement(v_acordo, 'consensual', NULL, v_key1, 'imediato');
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.terminate_agreement(v_acordo, 'consensual', NULL, v_key2, 'imediato');
  PERFORM public.terminate_agreement(v_acordo, 'consensual', NULL, gen_random_uuid(), 'imediato');
  RESET ROLE;

  IF lower((SELECT estado FROM public.acordos WHERE id = v_acordo)) <> 'cancelado' THEN
    RAISE EXCEPTION 'FAIL P1T: acordo devia estar cancelado após confirmação';
  END IF;

  SELECT COUNT(*)::integer INTO v_n_notif
  FROM public.notificacoes
  WHERE user_id = v_pax
    AND mensagem LIKE '%rescisão consensual foi confirmada%';

  IF v_n_notif <> 1 THEN
    RAISE EXCEPTION 'FAIL P1T: esperava 1 notificação pax pós-confirmação, obteve %', v_n_notif;
  END IF;

  RAISE NOTICE 'PASS P1T: segunda confirmação consensual idempotente';
END $$;
