-- Backfill is_test: motivo sem lugar 'saiu' → NULL; consensual pendente + último saiu → sem_lugares_vivos.
-- Acordos QA afectados (prod 2026-10-09): cd4a92aa-39b0-4979-bb8b-d112ed30052a e pares no mesmo padrão
-- (034ed791…, c23f6268…, 718c3ba7…, 79b6f7aa…, b8ba6f23…, d153aa78…, 694e78c3…, a6fdc010…).

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
