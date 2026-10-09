-- Backfill is_test: último saiu + consensual pendente (sem confirmação) → sem_lugares_vivos.

UPDATE public.acordos a
SET encerramento_motivo = 'sem_lugares_vivos'
FROM public.ofertas_capacidade o
WHERE a.oferta_id = o.id
  AND o.is_test = true
  AND lower(a.estado) = 'cancelado'
  AND a.encerramento_motivo IS NULL
  AND lower(coalesce(a.rescisao_modo, '')) = 'consensual'
  AND a.rescisao_confirmada_em IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = a.id
      AND lower(ap.estado) IN ('activo', 'reservado')
  )
  AND EXISTS (
    SELECT 1
    FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = a.id
      AND lower(ap.estado) = 'saiu'
  );
