-- Prova PostgreSQL — Regra 5 faltas (prazo passageiro + mês de desconto)
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION public._regra5_expect_sqlstate(p_label text, p_sql text, p_code text)
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

\echo '=== Regra 5 — prazo passageiro (funções puras) ==='
DO $$
BEGIN
  IF public._passageiro_falta_aviso_valido(
    '2026-10-16'::date,
    '2026-10-15 21:00:00+01'::timestamptz
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: falta futura dentro do prazo devia ser válida';
  END IF;

  IF public._passageiro_falta_aviso_valido(
    '2026-10-16'::date,
    '2026-10-15 22:30:00+01'::timestamptz
  ) IS NOT FALSE THEN
    RAISE EXCEPTION 'FAIL-on-old: após 22:00 véspera devia ser inválido';
  END IF;

  IF public._passageiro_falta_aviso_valido(
    '2026-10-14'::date,
    '2026-10-15 08:00:00+01'::timestamptz
  ) IS NOT FALSE THEN
    RAISE EXCEPTION 'FAIL: data no passado devia ser inválida';
  END IF;

  RAISE NOTICE 'PASS: prazo passageiro (funções puras)';
END $$;

\echo '=== Regra 5 — fixture acordo + pagamentos ==='
DO $$
DECLARE
  v_driver uuid := 'f5111111-1111-4111-8111-111111111111';
  v_pax uuid := 'f5222222-2222-4222-8222-222222222222';
  v_veiculo uuid;
  v_oferta uuid;
  v_procura uuid;
  v_acordo uuid := 'f5444444-4444-4444-8444-444444444444';
  v_ap uuid := 'f5555555-5555-4555-8555-555555555555';
  v_pg_sep uuid := 'f5666666-6666-4666-8666-666666666666';
  v_pg_out uuid := 'f5777777-7777-4777-8777-777777777777';
  v_mes_sep date := '2026-09-01'::date;
  v_mes_out date := '2026-10-01'::date;
  v_row public.faltas%ROWTYPE;
  v_desconto_sep integer;
  v_desconto_out integer;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO auth.users (id, email) VALUES
    (v_driver, 'regra5-driver@test'),
    (v_pax, 'regra5-pax@test')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil) VALUES
    (v_driver, 'Regra5 Driver', '931000001', 'Motorista'),
    (v_pax, 'Regra5 Pax', '931000002', 'Passageiro')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'Proof', 'R5-001', 4, 3)
  RETURNING id INTO v_veiculo;

  INSERT INTO public.ofertas_capacidade (
    id, driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (
    gen_random_uuid(), v_driver, v_veiculo, true, '07:00', 3, 3, 'POR_PASSAGEIRO', 22000, 'disponivel'
  ) RETURNING id INTO v_oferta;

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

  INSERT INTO public.acordos_passageiros (
    id, acordo_id, passenger_id, estado, quota_mensal_kz, ordem_insercao
  ) VALUES (v_ap, v_acordo, v_pax, 'activo', 22000, 0);

  INSERT INTO public.pagamentos_acordo (
    id, acordo_passageiro_id, acordo_id, passenger_id, driver_id,
    valor_kz, valor_quota_original_kz, valor_payout_liquido_kz, take_rate_pct, mes_referencia, estado
  ) VALUES
    (v_pg_sep, v_ap, v_acordo, v_pax, v_driver, 22000, 22000, 19800, 0.10, v_mes_sep, 'liquidado'),
    (v_pg_out, v_ap, v_acordo, v_pax, v_driver, 22000, 22000, 19800, 0.10, v_mes_out, 'em_custodia');

  PERFORM set_config('session_replication_role', 'origin', true);

  PERFORM set_config('request.jwt.claim.sub', v_pax::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  PERFORM set_config('boleia.regra5_instant_override', '2026-10-15 22:30:00+01', true);

  PERFORM public._regra5_expect_sqlstate(
    'passageiro após 22:00 véspera',
    format(
      $q$SELECT public.log_falta(%L, '2026-10-16'::date, 'Passageiro', NULL, %L, 'ambas')$q$,
      v_acordo, v_pax
    ),
    'BCF02'
  );

  PERFORM set_config('boleia.regra5_instant_override', '2026-10-15 08:00:00+01', true);

  PERFORM public._regra5_expect_sqlstate(
    'passageiro data passada',
    format(
      $q$SELECT public.log_falta(%L, '2026-10-14'::date, 'Passageiro', NULL, %L, 'ambas')$q$,
      v_acordo, v_pax
    ),
    'BCF01'
  );

  PERFORM set_config('boleia.regra5_instant_override', '2026-10-15 21:00:00+01', true);

  SELECT * INTO v_row FROM public.log_falta(
    v_acordo, '2026-10-20'::date, 'Passageiro', NULL, v_pax, 'ambas'
  );

  IF v_row.desconto_kz <= 0 THEN
    RAISE EXCEPTION 'FAIL: falta passageiro válida devia ter desconto_kz > 0 (%)', v_row.desconto_kz;
  END IF;

  IF v_row.desconto_mes_referencia IS DISTINCT FROM v_mes_out THEN
    RAISE EXCEPTION 'FAIL: desconto_mes_referencia devia ser %, obteve %',
      v_mes_out, v_row.desconto_mes_referencia;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_driver::text, true);
  PERFORM set_config('boleia.regra5_instant_override', '2026-10-20 12:00:00+01', true);

  SELECT * INTO v_row FROM public.log_falta(
    v_acordo, '2026-09-10'::date, 'Motorista', NULL, NULL, 'ambas'
  );

  IF v_row.desconto_kz <= 0 THEN
    RAISE EXCEPTION 'FAIL: falta motorista tardia devia ter desconto';
  END IF;

  IF v_row.desconto_mes_referencia IS DISTINCT FROM v_mes_out THEN
    RAISE EXCEPTION 'FAIL-on-old: crédito devia ir para %, obteve %',
      v_mes_out, v_row.desconto_mes_referencia;
  END IF;

  v_desconto_sep := public._desconto_faltas_pagamento(v_acordo, v_pax, v_mes_sep);
  v_desconto_out := public._desconto_faltas_pagamento(v_acordo, v_pax, v_mes_out);

  IF v_desconto_sep <> 0 THEN
    RAISE EXCEPTION 'FAIL-on-old: mês passado liquidado não devia descontar em % (=%)', v_mes_sep, v_desconto_sep;
  END IF;

  IF v_desconto_out <= 0 THEN
    RAISE EXCEPTION 'FAIL: desconto do mês corrente/crédito devia ser > 0 (%)', v_desconto_out;
  END IF;

  RAISE NOTICE 'PASS: log_falta + _desconto_faltas_pagamento regra 5';
END $$;
