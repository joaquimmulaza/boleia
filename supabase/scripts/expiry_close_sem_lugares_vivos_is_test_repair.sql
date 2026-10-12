-- Reparação manual (service_role): acordos is_test / QA sem lugares vivos → encerramento_motivo.
-- NÃO é migração automática. Só ofertas is_test; exclui acordos cujo id começa por ac722c73.

BEGIN;

UPDATE public.acordos a
SET encerramento_motivo = 'sem_lugares_vivos'
FROM public.ofertas_capacidade o
WHERE a.oferta_id = o.id
  AND o.is_test = true
  AND a.id::text NOT LIKE 'ac722c73%'
  AND lower(a.estado) = 'cancelado'
  AND a.encerramento_motivo IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = a.id
      AND lower(ap.estado) IN ('activo', 'reservado')
  );

UPDATE public.acordos a
SET
  rescisao_modo = NULL,
  rescisao_solicitada_por = NULL,
  rescisao_vigencia = NULL,
  rescisao_justificativa = NULL,
  rescisao_effective_on = NULL,
  rescisao_solicitada_em = NULL
FROM public.ofertas_capacidade o
WHERE a.oferta_id = o.id
  AND o.is_test = true
  AND a.id::text NOT LIKE 'ac722c73%'
  AND lower(a.estado) = 'cancelado'
  AND a.encerramento_motivo = 'sem_lugares_vivos'
  AND lower(COALESCE(a.rescisao_modo, '')) = 'consensual'
  AND a.rescisao_confirmada_em IS NULL;

COMMIT;
