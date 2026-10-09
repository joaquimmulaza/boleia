-- Asserções P0 acordo × pagamento (correr após cadeia completa de migrações)

DO $$
DECLARE
  v integer;
BEGIN
  v := public.calc_quota_proporcional_kz(22000, 22, '2026-10-09'::date);
  IF v < 1 THEN
    RAISE EXCEPTION 'FAIL: calc_quota_proporcional_kz devolveu %', v;
  END IF;
  RAISE NOTICE 'PASS: calc_quota_proporcional_kz = %', v;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_obrigacao_pagamento_passageiro'
  ) THEN
    RAISE EXCEPTION 'FAIL: RPC get_obrigacao_pagamento_passageiro em falta';
  END IF;
  RAISE NOTICE 'PASS: RPCs P0 presentes';
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pagamentos_acordo_estado_check'
  ) THEN
    RAISE EXCEPTION 'FAIL: CHECK estado pagamentos';
  END IF;
  RAISE NOTICE 'PASS: CHECK pagamentos inclui anulado';
END $$;
