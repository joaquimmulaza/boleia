-- Regressão: comportamento main SEM migração sec_pr_b (create_proposal + grants anon)
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_driver uuid := gen_random_uuid();
  v_procura_a uuid := gen_random_uuid();
  v_procura_b uuid := gen_random_uuid();
  v_grupo_a uuid := gen_random_uuid();
  v_oferta uuid := gen_random_uuid();
  v_veiculo uuid;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_owner, 'secb-main-owner@test'),
    (v_outsider, 'secb-main-out@test'),
    (v_driver, 'secb-main-driver@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_owner, 'Main Owner', '931000001', 'Passageiro'),
    (v_outsider, 'Main Out', '931000002', 'Passageiro'),
    (v_driver, 'Main Driver', '931000003', 'Motorista')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.procuras (id, owner_id, preferred_time, n_candidato, estado)
  VALUES (v_procura_a, v_owner, '07:00', 1, 'activa'),
         (v_procura_b, v_outsider, '07:00', 1, 'activa');

  INSERT INTO public.grupos (id, procura_id, n_maximo)
  VALUES (v_grupo_a, v_procura_a, 4);

  INSERT INTO public.membros_grupo (grupo_id, passenger_id, estado, ordem_insercao)
  VALUES (v_grupo_a, v_owner, 'activo', 0);

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'Main', 'MAIN-1', 5, 4)
  RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    id, driver_id, veiculo_id, flexibilidade_rota, departure_time,
    vagas_disponiveis, vagas_totais, modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (
    v_oferta, v_driver, v_veiculo, true, '07:00', 4, 4, 'POR_PASSAGEIRO', 15000, 'disponivel'
  );

  PERFORM set_config('session_replication_role', 'origin', true);

  PERFORM set_config('request.jwt.claim.sub', v_outsider::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  PERFORM public.create_proposal(
    v_oferta, v_procura_b, v_grupo_a, 'POR_PASSAGEIRO', 10000, 1
  );

  RAISE NOTICE 'REGRESS_OK: main aceitou create_proposal com grupo de outra procura';
  RAISE EXCEPTION 'REGRESS_FAIL: fim esperado (main sem validação sec_pr_b)';
END $$;
