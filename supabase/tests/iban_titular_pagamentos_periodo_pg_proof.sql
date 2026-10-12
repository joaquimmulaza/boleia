-- Prova PG: iban_titular privacidade + renovação quota integral (_create_pagamentos_periodo).
\set ON_ERROR_STOP on

\echo '=== fail-on-old: authenticated ainda lê perfis.iban_titular (pré-fix) ==='
DO $$
BEGIN
  IF has_column_privilege('authenticated', 'public.perfis', 'iban_titular', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL-on-old: authenticated ainda tem SELECT em perfis.iban_titular';
  END IF;
  RAISE NOTICE 'PASS: SELECT iban_titular revogado para authenticated';
END $$;

\echo '=== RPC get_own_perfil_contacto + get_acordo_motorista_dados_bancarios presentes ==='
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_acordo_motorista_dados_bancarios'
  ) THEN
    RAISE EXCEPTION 'FAIL: RPC get_acordo_motorista_dados_bancarios em falta';
  END IF;
  RAISE NOTICE 'PASS: RPCs presentes';
END $$;

CREATE OR REPLACE FUNCTION public._iban_pg_proof_expect_denied(p_label text, p_sql text)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'FAIL %: devia negar (42501)', p_label;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IS DISTINCT FROM '42501' THEN
      RAISE EXCEPTION 'FAIL %: esperava 42501, obteve % — %', p_label, SQLSTATE, SQLERRM;
    END IF;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public._iban_pg_proof_expect_denied(text, text) TO authenticated, anon;

DO $$
DECLARE
  v_driver uuid := 'd1111111-1111-4111-8111-111111111111';
  v_pax uuid := 'd2222222-2222-4222-8222-222222222222';
  v_out uuid := 'd3333333-3333-4333-8333-333333333333';
  v_pax_saiu uuid := 'd6666666-6666-4666-8666-666666666666';
  v_acordo uuid := 'd4444444-4444-4444-8444-444444444444';
  v_ap uuid := 'd5555555-5555-4555-8555-555555555555';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_mes_atual date := date_trunc('month', timezone('Africa/Luanda', now()))::date;
  v_proximo_mes date := (date_trunc('month', timezone('Africa/Luanda', now())) + interval '1 month')::date;
  v_quota integer := 40000;
  v_contacto jsonb;
  v_bancos jsonb;
  v_devido integer;
  v_criados integer;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'iban-proof-driver@test'),
    (v_pax, 'iban-proof-pax@test'),
    (v_out, 'iban-proof-out@test'),
    (v_pax_saiu, 'iban-proof-pax-saiu@test')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.perfis (
    id, nome_completo, telefone, tipo_perfil, iban, iban_titular
  ) VALUES
    (v_driver, 'Proof Driver', '+244921000001', 'Motorista', 'AO06DRIVER0001', 'Titular Motorista'),
    (v_pax, 'Proof Pax', '+244921000002', 'Passageiro', NULL, NULL),
    (v_out, 'Proof Out', '+244921000003', 'Passageiro', NULL, NULL),
    (v_pax_saiu, 'Proof Pax Saiu', '+244921000004', 'Passageiro', NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET
    iban = EXCLUDED.iban,
    iban_titular = EXCLUDED.iban_titular;

  DELETE FROM public.pagamentos_acordo WHERE acordo_id = v_acordo;
  DELETE FROM public.acordos_passageiros WHERE acordo_id = v_acordo;
  DELETE FROM public.acordos WHERE id = v_acordo;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'Proof Van', 'IB-001', 5, 4)
  RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    id, driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (
    gen_random_uuid(), v_driver, v_veiculo, true, '07:00', 3, 4, 'POR_PASSAGEIRO', v_quota, 'disponivel'
  )
  RETURNING id INTO v_oferta;

  INSERT INTO public.procuras (id, owner_id, preferred_time, n_candidato, estado)
  VALUES (gen_random_uuid(), v_pax, '07:30', 1, 'activa')
  RETURNING id INTO v_procura;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado, dias_uteis_mes
  ) VALUES (
    v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1,
    v_quota, v_quota, 'activo', 22
  );

  INSERT INTO public.acordos_passageiros (
    id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao
  ) VALUES
    (v_ap, v_acordo, v_pax, 'activo', v_quota, 0),
    (gen_random_uuid(), v_acordo, v_pax_saiu, 'saiu', v_quota, 1);

  PERFORM set_config('session_replication_role', 'origin', true);

  -- anon: RPC dados bancários → 42501
  SET LOCAL ROLE anon;
  PERFORM public._iban_pg_proof_expect_denied(
    'anon RPC dados bancários',
    format('SELECT public.get_acordo_motorista_dados_bancarios(%L)', v_acordo)
  );
  RESET ROLE;

  -- Outro utilizador: SELECT iban_titular → 42501
  PERFORM set_config('request.jwt.claim.sub', v_out::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', format('{"role":"authenticated","sub":"%s"}', v_out), true);
  SET LOCAL ROLE authenticated;

  PERFORM public._iban_pg_proof_expect_denied(
    'out SELECT iban_titular',
    format('SELECT iban_titular FROM public.perfis WHERE id = %L', v_driver)
  );

  PERFORM public._iban_pg_proof_expect_denied(
    'out RPC dados bancários',
    format('SELECT public.get_acordo_motorista_dados_bancarios(%L)', v_acordo)
  );

  RESET ROLE;

  -- Dono: RPC devolve titular
  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  PERFORM set_config('request.jwt.claims', format('{"role":"authenticated","sub":"%s"}', v_driver), true);
  SET LOCAL ROLE authenticated;

  v_contacto := public.get_own_perfil_contacto();
  IF NULLIF(btrim(COALESCE(v_contacto->>'iban_titular', '')), '') IS DISTINCT FROM 'Titular Motorista' THEN
    RAISE EXCEPTION 'FAIL: get_own_perfil_contacto iban_titular esperado Titular Motorista, obteve %', v_contacto;
  END IF;

  RESET ROLE;

  -- Passageiro: RPC acordo devolve IBAN motorista; SELECT directo nega
  PERFORM set_config('request.jwt.claim.sub', v_pax::text, true);
  PERFORM set_config('request.jwt.claims', format('{"role":"authenticated","sub":"%s"}', v_pax), true);
  SET LOCAL ROLE authenticated;

  PERFORM public._iban_pg_proof_expect_denied(
    'pax SELECT iban_titular',
    format('SELECT iban_titular FROM public.perfis WHERE id = %L', v_driver)
  );

  v_bancos := public.get_acordo_motorista_dados_bancarios(v_acordo);
  IF v_bancos->>'iban' IS DISTINCT FROM 'AO06DRIVER0001'
     OR v_bancos->>'iban_titular' IS DISTINCT FROM 'Titular Motorista' THEN
    RAISE EXCEPTION 'FAIL: get_acordo_motorista_dados_bancarios devolveu %', v_bancos;
  END IF;

  RESET ROLE;

  -- Passageiro saiu: RPC negada
  PERFORM set_config('request.jwt.claim.sub', v_pax_saiu::text, true);
  PERFORM set_config('request.jwt.claims', format('{"role":"authenticated","sub":"%s"}', v_pax_saiu), true);
  SET LOCAL ROLE authenticated;

  PERFORM public._iban_pg_proof_expect_denied(
    'pax saiu RPC dados bancários',
    format('SELECT public.get_acordo_motorista_dados_bancarios(%L)', v_acordo)
  );

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  -- Renovação: _create_pagamentos_periodo → valor_devido_kz = quota integral
  v_criados := public._create_pagamentos_periodo(v_acordo, v_proximo_mes, v_driver);
  IF v_criados <> 1 THEN
    RAISE EXCEPTION 'FAIL: _create_pagamentos_periodo criou % linhas, esperava 1', v_criados;
  END IF;

  SELECT pg.valor_devido_kz INTO v_devido
  FROM public.pagamentos_acordo pg
  WHERE pg.acordo_passageiro_id = v_ap
    AND pg.mes_referencia = v_proximo_mes;

  IF v_devido IS DISTINCT FROM v_quota THEN
    RAISE EXCEPTION 'FAIL renovação: valor_devido_kz=% devia ser quota integral %', v_devido, v_quota;
  END IF;

  RAISE NOTICE 'PASS: iban_titular_pagamentos_periodo_pg_proof';
END $$;
