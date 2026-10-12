-- Asserções Security PR B (BD já com todas as migrações + stubs net/vault)
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_driver uuid := gen_random_uuid();
  v_procura_a uuid := gen_random_uuid();
  v_procura_b uuid := gen_random_uuid();
  v_grupo_a uuid := gen_random_uuid();
  v_grupo_b uuid := gen_random_uuid();
  v_oferta uuid := gen_random_uuid();
  v_veiculo uuid;
  v_err text;
  v_log_count integer;
  v_headers jsonb;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_owner, 'secb-owner@test'),
    (v_outsider, 'secb-out@test'),
    (v_driver, 'secb-driver@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_owner, 'SecB Owner', '930000001', 'Passageiro'),
    (v_outsider, 'SecB Out', '930000002', 'Passageiro'),
    (v_driver, 'SecB Driver', '930000003', 'Motorista')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.procuras (id, owner_id, preferred_time, n_candidato, estado)
  VALUES (v_procura_a, v_owner, '07:00', 1, 'activa'),
         (v_procura_b, v_outsider, '07:00', 1, 'activa');

  INSERT INTO public.grupos (id, procura_id, n_maximo)
  VALUES (v_grupo_a, v_procura_a, 4),
         (v_grupo_b, v_procura_b, 4);

  INSERT INTO public.membros_grupo (grupo_id, passenger_id, estado, ordem_insercao)
  VALUES (v_grupo_a, v_owner, 'activo', 0);

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'SecB', 'SEC-B-1', 5, 4)
  RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    id, driver_id, veiculo_id, flexibilidade_rota, departure_time,
    vagas_disponiveis, vagas_totais, modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (
    v_oferta, v_driver, v_veiculo, true, '07:00', 4, 4, 'POR_PASSAGEIRO', 15000, 'disponivel'
  );

  IF has_table_privilege('anon', 'public.push_subscriptions', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: anon ainda tem SELECT em push_subscriptions após REVOKE ALL';
  END IF;

  -- anon INSERT em push_subscriptions → 42501
  BEGIN
    SET LOCAL ROLE anon;
    INSERT INTO public.push_subscriptions (user_id, subscription)
    VALUES (v_owner, '{"endpoint":"https://x"}'::jsonb);
    RAISE EXCEPTION 'FAIL: anon conseguiu INSERT em push_subscriptions';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  RESET ROLE;

  PERFORM set_config('session_replication_role', 'origin', true);

  -- Secret em falta: INSERT notificação OK + pg_net chamado sem header secret
  TRUNCATE public._sec_pr_b_net_log;
  INSERT INTO public.notificacoes (user_id, mensagem, tipo)
  VALUES (v_owner, 'teste push sem vault', 'info');

  SELECT COUNT(*), (SELECT headers FROM public._sec_pr_b_net_log ORDER BY id DESC LIMIT 1)
  INTO v_log_count, v_headers
  FROM public._sec_pr_b_net_log;

  IF v_log_count < 1 THEN
    RAISE EXCEPTION 'FAIL: secret em falta mas net.http_post não foi chamado';
  END IF;
  IF v_headers ? 'x-boleia-push-secret' THEN
    RAISE EXCEPTION 'FAIL: sem vault secret não deve enviar x-boleia-push-secret';
  END IF;
  IF COALESCE(v_headers->>'Content-Type', '') <> 'application/json' THEN
    RAISE EXCEPTION 'FAIL: headers legados devem incluir Content-Type';
  END IF;

  -- Com secret no Vault: header presente
  DROP VIEW IF EXISTS vault.decrypted_secrets;
  CREATE VIEW vault.decrypted_secrets AS
  SELECT 'push_webhook_secret'::text AS name, 'proof-secret-value'::text AS decrypted_secret;

  TRUNCATE public._sec_pr_b_net_log;
  INSERT INTO public.notificacoes (user_id, mensagem, tipo)
  VALUES (v_owner, 'teste push com vault', 'info');

  SELECT headers INTO v_headers
  FROM public._sec_pr_b_net_log
  ORDER BY id DESC
  LIMIT 1;

  IF COALESCE(v_headers->>'x-boleia-push-secret', '') <> 'proof-secret-value' THEN
    RAISE EXCEPTION 'FAIL: com vault secret deve enviar x-boleia-push-secret';
  END IF;

  -- create_proposal: grupo de outra procura
  PERFORM set_config('request.jwt.claim.sub', v_outsider::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  BEGIN
    PERFORM public.create_proposal(
      v_oferta, v_procura_b, v_grupo_a, 'POR_PASSAGEIRO', 10000, 1
    );
    RAISE EXCEPTION 'FAIL: create_proposal aceitou grupo de outra procura';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err NOT LIKE '%Grupo não pertence a esta procura.%' THEN
        RAISE EXCEPTION 'FAIL: mensagem inesperada outsider grupo: %', v_err;
      END IF;
  END;

  -- N > membros activos
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  BEGIN
    PERFORM public.create_proposal(
      v_oferta, v_procura_a, v_grupo_a, 'POR_PASSAGEIRO', 10000, 3
    );
    RAISE EXCEPTION 'FAIL: create_proposal aceitou N > membros activos';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err NOT LIKE '%excede os membros activos%' THEN
        RAISE EXCEPTION 'FAIL: mensagem inesperada N>membros: %', v_err;
      END IF;
  END;

  PERFORM public.create_proposal(
    v_oferta, v_procura_a, v_grupo_a, 'POR_PASSAGEIRO', 12000, 1
  );

  RAISE NOTICE 'OK: sec_pr_b_pg_proof_assertions passou';
END $$;
