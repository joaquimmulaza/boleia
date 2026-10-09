-- Backfill P0 (correr manualmente em produção com service_role — NÃO é migração automática)
-- Preenche colunas novas e alinha valor_devido sem alterar quotas congeladas no lugar.

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS p0_backfill_report (
  categoria text PRIMARY KEY,
  linhas_afectadas bigint NOT NULL DEFAULT 0
) ON COMMIT DROP;

INSERT INTO p0_backfill_report (categoria, linhas_afectadas)
SELECT 'pagamentos_quota_original', COUNT(*)
FROM public.pagamentos_acordo pg
WHERE pg.valor_quota_original_kz IS NULL OR pg.valor_devido_kz IS NULL;

UPDATE public.pagamentos_acordo pg
SET
  valor_quota_original_kz = COALESCE(pg.valor_quota_original_kz, pg.valor_kz),
  valor_devido_kz = COALESCE(pg.valor_devido_kz, pg.valor_kz)
WHERE pg.valor_quota_original_kz IS NULL OR pg.valor_devido_kz IS NULL;

INSERT INTO p0_backfill_report (categoria, linhas_afectadas)
SELECT 'pagamentos_prazo_reserva', COUNT(*)
FROM public.pagamentos_acordo pg
JOIN public.acordos_passageiros ap ON ap.id = pg.acordo_passageiro_id
WHERE pg.prazo_pagamento_em IS NULL
  AND ap.reservado_expira_em IS NOT NULL
  AND lower(ap.estado) IN ('reservado', 'expirado');

UPDATE public.pagamentos_acordo pg
SET prazo_pagamento_em = ap.reservado_expira_em
FROM public.acordos_passageiros ap
WHERE ap.id = pg.acordo_passageiro_id
  AND pg.prazo_pagamento_em IS NULL
  AND ap.reservado_expira_em IS NOT NULL
  AND lower(ap.estado) IN ('reservado', 'expirado');

SELECT * FROM p0_backfill_report ORDER BY categoria;

COMMIT;
