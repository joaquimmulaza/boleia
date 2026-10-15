-- Prova PostgreSQL — dias de viagem do acordo (Regra 5 P0)
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION public._dias_acordo_expect_sqlstate(p_label text, p_sql text, p_code text)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'FAIL %: devia falhar com %', p_label, p_code;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IS DISTINCT FROM p_code THEN
      RAISE EXCEPTION 'FAIL %: esperava %, obteve % — %', p_label, p_code, SQLSTATE, SQLERRM;
    END IF;
END;
$fn$;

\echo '=== dias acordo — ISODOW (nunca DOW) + divisores mensais ==='
DO $$
BEGIN
  IF EXTRACT(ISODOW FROM DATE '2026-10-04') <> 7 THEN
    RAISE EXCEPTION 'FAIL ISODOW: 2026-10-04 devia ser domingo (7)';
  END IF;
  IF EXTRACT(ISODOW FROM DATE '2026-10-05') <> 1 THEN
    RAISE EXCEPTION 'FAIL ISODOW: 2026-10-05 devia ser segunda (1)';
  END IF;
  IF EXTRACT(DOW FROM DATE '2026-10-04') <> 0 THEN
    RAISE EXCEPTION 'FAIL contraste DOW: domingo Postgres DOW deve ser 0';
  END IF;

  IF public.count_dias_viagem_mes('2026-10-01'::date, ARRAY[1, 2, 3, 4, 5]) <> 22 THEN
    RAISE EXCEPTION 'FAIL: out/2026 Seg–Sex devia ter 22 dias';
  END IF;
  IF public.count_dias_viagem_mes('2026-11-01'::date, ARRAY[1, 2, 3, 4, 5]) <> 21 THEN
    RAISE EXCEPTION 'FAIL: nov/2026 Seg–Sex devia ter 21 dias';
  END IF;
  IF public.count_dias_viagem_mes('2026-10-01'::date, ARRAY[2, 3, 4, 5]) <> 18 THEN
    RAISE EXCEPTION 'FAIL: out/2026 Ter–Sex devia ter 18 dias, obteve %',
      public.count_dias_viagem_mes('2026-10-01'::date, ARRAY[2, 3, 4, 5]);
  END IF;
  IF public.count_dias_viagem_mes('2026-11-01'::date, ARRAY[2, 3, 4, 5]) <> 16 THEN
    RAISE EXCEPTION 'FAIL: nov/2026 Ter–Sex devia ter 16 dias, obteve %',
      public.count_dias_viagem_mes('2026-11-01'::date, ARRAY[2, 3, 4, 5]);
  END IF;
  IF public.count_dias_viagem_mes('2026-11-01'::date, NULL) <> 21 THEN
    RAISE EXCEPTION 'FAIL: dias_semana NULL devia fallback Seg–Sex nov/2026 = 21, obteve %',
      public.count_dias_viagem_mes('2026-11-01'::date, NULL);
  END IF;
  IF public.count_dias_viagem_mes(date_trunc('month', DATE '2026-11-01')::date, ARRAY[1, 2, 3, 4, 5]) <> 21 THEN
    RAISE EXCEPTION 'FAIL: date_trunc mês de 2026-11-01 devia dar 21 dias Seg–Sex';
  END IF;
  IF public.count_dias_viagem_mes(date_trunc('month', DATE '2026-12-01')::date, ARRAY[1, 2, 3, 4, 5]) <> 23 THEN
    RAISE EXCEPTION 'FAIL: date_trunc mês de 2026-12-01 devia dar 23 dias Seg–Sex';
  END IF;
  RAISE NOTICE 'PASS: ISODOW + divisores out/nov/dez + trunc dia 1 sem TZ';
END $$;

\echo '=== dias acordo — fixture acordo + custódia ==='
DO $$
DECLARE
  v_driver uuid := 'da111111-1111-4111-8111-111111111111';
  v_pax uuid := 'da222222-2222-4222-8222-222222222222';
  v_veiculo uuid;
  v_oferta uuid;
  v_oferta_ter_sex uuid;
  v_procura uuid;
  v_acordo uuid := 'da444444-4444-4444-8444-444444444444';
  v_acordo_ts uuid := 'da444445-4444-4444-8444-444444444445';
  v_ap uuid := 'da555555-5555-4555-8555-555555555555';
  v_ap_ts uuid := 'da555556-5555-4555-8555-555555555556';
  v_pg uuid := 'da666666-6666-4666-8666-666666666666';
  v_pg_ts uuid := 'da666667-6666-4666-8666-666666666667';
  v_row public.faltas%ROWTYPE;
  v_row_nov public.faltas%ROWTYPE;
  v_ins public.faltas%ROWTYPE;
  v_desconto_out numeric;
  v_desconto_nov numeric;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'dias-acordo-driver@test'),
    (v_pax, 'dias-acordo-pax@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'Dias Driver', '931000101', 'Motorista'),
    (v_pax, 'Dias Pax', '931000102', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'Proof', 'DA-001', 4, 3)
  RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    id, driver_id, veiculo_id, flexibilidade_rota, departure_time, dias_semana,
    vagas_disponiveis, vagas_totais, modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (
    gen_random_uuid(), v_driver, v_veiculo, true, '07:00', ARRAY[1, 2, 3, 4, 5],
    3, 3, 'POR_PASSAGEIRO', 22000, 'disponivel'
  ) RETURNING id INTO v_oferta;

  INSERT INTO public.ofertas_capacidade (
    id, driver_id, veiculo_id, flexibilidade_rota, departure_time, dias_semana,
    vagas_disponiveis, vagas_totais, modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (
    gen_random_uuid(), v_driver, v_veiculo, true, '07:00', ARRAY[2, 3, 4, 5],
    3, 3, 'POR_PASSAGEIRO', 22000, 'disponivel'
  ) RETURNING id INTO v_oferta_ter_sex;

  INSERT INTO public.procuras (id, owner_id, preferred_time, n_candidato, estado)
  VALUES (gen_random_uuid(), v_pax, '07:30', 1, 'activa')
  RETURNING id INTO v_procura;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, dias_uteis_mes, estado
  ) VALUES (
    v_acordo, v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO', 1,
    22000, 22000, 22, 'activo'
  );

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz, dias_uteis_mes, estado
  ) VALUES (
    v_acordo_ts, v_oferta_ter_sex, v_procura, v_driver, 'POR_PASSAGEIRO', 1,
    22000, 22000, 99, 'activo'
  );

  INSERT INTO public.acordos_passageiros (
    id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao
  ) VALUES
    (v_ap, v_acordo, v_pax, 'activo', 22000, 0),
    (v_ap_ts, v_acordo_ts, v_pax, 'activo', 22000, 0);

  INSERT INTO public.pagamentos_acordo (
    id, acordo_passageiro_id, acordo_id, passenger_id, driver_id,
    valor_kz, valor_quota_original_kz, valor_payout_liquido_kz, take_rate_pct, mes_referencia, estado
  ) VALUES
    (v_pg, v_ap, v_acordo, v_pax, v_driver, 22000, 22000, 19800, 0.10, '2026-10-01', 'em_custodia'),
    (v_pg_ts, v_ap_ts, v_acordo_ts, v_pax, v_driver, 22000, 22000, 19800, 0.10, '2026-10-01', 'em_custodia');

  PERFORM set_config('session_replication_role', 'origin', true);
  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  -- (0) domingo rejeitado; segunda aceite (Seg–Sex)
  PERFORM public._dias_acordo_expect_sqlstate(
    '(0) domingo',
    format(
      $q$SELECT public.log_falta(%L, '2026-10-04'::date, 'Motorista', NULL, NULL, 'ambas')$q$,
      v_acordo
    ),
    'BCF03'
  );
  SELECT * INTO v_row FROM public.log_falta(
    v_acordo, '2026-10-05'::date, 'Motorista', NULL, NULL, 'ambas'
  );
  IF v_row.desconto_kz IS NULL OR v_row.desconto_kz <= 0 THEN
    RAISE EXCEPTION 'FAIL (0): segunda-feira devia ter desconto > 0';
  END IF;

  -- (1) dia útil Seg–Sex com desconto
  SELECT * INTO v_row FROM public.log_falta(
    v_acordo, '2026-10-14'::date, 'Motorista', NULL, NULL, 'ambas'
  );
  IF v_row.desconto_kz IS NULL OR v_row.desconto_kz <= 0 THEN
    RAISE EXCEPTION 'FAIL (1): desconto devia ser > 0 num dia de viagem';
  END IF;

  -- (2) sábado rejeitado
  PERFORM public._dias_acordo_expect_sqlstate(
    '(2) sábado',
    format(
      $q$SELECT public.log_falta(%L, '2026-10-10'::date, 'Motorista', NULL, NULL, 'ambas')$q$,
      v_acordo
    ),
    'BCF03'
  );

  -- (3) INSERT directo sábado → desconto 0 (defesa trigger; bypass RLS como postgres)
  RESET ROLE;
  SET LOCAL ROLE postgres;
  INSERT INTO public.faltas (id_acordo, data_falta, tipo, passenger_id, viagem)
  VALUES (v_acordo, '2026-10-11'::date, 'Passageiro', v_pax, 'ambas')
  RETURNING * INTO v_ins;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  IF COALESCE(v_ins.desconto_kz, -1) <> 0 THEN
    RAISE EXCEPTION 'FAIL (3): INSERT sábado devia desconto_kz=0, obteve %', v_ins.desconto_kz;
  END IF;

  -- (4) Ter–Sex rejeita segunda
  PERFORM public._dias_acordo_expect_sqlstate(
    '(4) segunda Ter–Sex',
    format(
      $q$SELECT public.log_falta(%L, '2026-10-05'::date, 'Motorista', NULL, NULL, 'ambas')$q$,
      v_acordo_ts
    ),
    'BCF03'
  );

  -- (5) divisor por mês da falta (Ter–Sex): out/2026=18 vs nov/2026=16; ignora acordos.dias_uteis_mes=99
  SELECT * INTO v_row FROM public.log_falta(
    v_acordo_ts, '2026-10-14'::date, 'Motorista', NULL, NULL, 'ambas'
  );
  SELECT * INTO v_row_nov FROM public.log_falta(
    v_acordo_ts, '2026-11-11'::date, 'Motorista', NULL, NULL, 'ambas'
  );
  v_desconto_out := ROUND(22000::numeric / 18::numeric, 2);
  v_desconto_nov := ROUND(22000::numeric / 16::numeric, 2);
  IF v_row.desconto_kz IS DISTINCT FROM v_desconto_out THEN
    RAISE EXCEPTION 'FAIL (5a): out/2026 desconto devia %, obteve %', v_desconto_out, v_row.desconto_kz;
  END IF;
  IF v_row_nov.desconto_kz IS DISTINCT FROM v_desconto_nov THEN
    RAISE EXCEPTION 'FAIL (5b): nov/2026 desconto devia %, obteve %', v_desconto_nov, v_row_nov.desconto_kz;
  END IF;
  IF v_row.desconto_kz = v_row_nov.desconto_kz THEN
    RAISE EXCEPTION 'FAIL (5c): descontos out vs nov deviam diferir';
  END IF;

  -- (6) 01/11/2026 domingo rejeitado (Seg–Sex)
  PERFORM public._dias_acordo_expect_sqlstate(
    '(6) domingo 01/11/2026',
    format(
      $q$SELECT public.log_falta(%L, '2026-11-01'::date, 'Motorista', NULL, NULL, 'ambas')$q$,
      v_acordo
    ),
    'BCF03'
  );

  -- (7) dia 1 do mês civil: dez/2026 Seg–Sex divisor 23 (2026-12-01 terça)
  SELECT * INTO v_row FROM public.log_falta(
    v_acordo, '2026-12-01'::date, 'Motorista', NULL, NULL, 'ambas'
  );
  IF v_row.desconto_kz IS DISTINCT FROM ROUND(22000::numeric / 23::numeric, 2) THEN
    RAISE EXCEPTION 'FAIL (7): 2026-12-01 desconto devia 22000/23, obteve %', v_row.desconto_kz;
  END IF;

  -- (8) nov/2026 divisor 21 (primeira segunda; mês truncado a partir de 2026-11-01)
  SELECT * INTO v_row_nov FROM public.log_falta(
    v_acordo, '2026-11-02'::date, 'Motorista', NULL, NULL, 'ambas'
  );
  IF v_row_nov.desconto_kz IS DISTINCT FROM ROUND(22000::numeric / 21::numeric, 2) THEN
    RAISE EXCEPTION 'FAIL (8): 2026-11-02 desconto devia 22000/21, obteve %', v_row_nov.desconto_kz;
  END IF;

  RAISE NOTICE 'PASS: log_falta + handle_falta_desconto dias de viagem + divisor mensal';
END $$;
