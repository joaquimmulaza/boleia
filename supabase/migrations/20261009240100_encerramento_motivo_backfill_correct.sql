-- Correcção backfill 235000: motivo sem nenhum lugar 'saiu' (ex. só expirado/reservado TTL).
-- Em prod (2026-10-09): apenas ofertas is_test afectadas.

UPDATE public.acordos a
SET encerramento_motivo = NULL
FROM public.ofertas_capacidade o
WHERE a.oferta_id = o.id
  AND o.is_test = true
  AND a.encerramento_motivo = 'sem_lugares_vivos'
  AND NOT EXISTS (
    SELECT 1
    FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = a.id
      AND lower(ap.estado) = 'saiu'
  );
