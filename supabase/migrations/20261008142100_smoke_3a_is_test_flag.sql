-- Smoke #3a — item 10: flag is_test em ofertas/procuras (QA allowlist + backfill prod).
-- Filtra browse/matching via RLS; dono continua a ver os seus registos.

ALTER TABLE public.ofertas_capacidade
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

ALTER TABLE public.procuras
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ofertas_capacidade.is_test IS
  'Oferta de QA/teste — oculta em /explorar, matching e contagens públicas; visível ao dono.';
COMMENT ON COLUMN public.procuras.is_test IS
  'Procura de QA/teste — oculta em /explorar, matching e contagens públicas; visível ao dono.';

-- Allowlist exacta de contas QA (sem padrões de email em runtime)
CREATE TABLE IF NOT EXISTS public.qa_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_accounts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.qa_accounts FROM PUBLIC;
REVOKE ALL ON TABLE public.qa_accounts FROM anon;
REVOKE ALL ON TABLE public.qa_accounts FROM authenticated;

-- Só para seed one-shot — não expor a authenticated
CREATE OR REPLACE FUNCTION public.is_qa_test_owner_email(p_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT COALESCE(
    lower(btrim(p_email)) LIKE 'critiquito.%'
    OR lower(btrim(p_email)) LIKE '%@example.com'
    OR lower(btrim(p_email)) LIKE '%@mailinator.com'
    OR lower(btrim(p_email)) LIKE '%@boleiacerta.test',
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_qa_test_owner_email(text) FROM PUBLIC;

-- Seed: contas QA existentes hoje (padrões legados) + donos das 18 ofertas (exc. Joaquim)
INSERT INTO public.qa_accounts (user_id, note)
SELECT u.id, 'seed: email pattern snapshot'
FROM auth.users u
WHERE public.is_qa_test_owner_email(u.email)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.qa_accounts (user_id, note)
SELECT DISTINCT o.driver_id, 'seed: 18 test offers driver'
FROM public.ofertas_capacidade o
WHERE o.id IN (
  'f230fdb5-3de4-434e-950f-dd25b7460e1c',
  '8149c96b-4095-4a52-bc79-b6398234a73d',
  'b48fe371-fd4c-437d-9d91-0ad8013a5766',
  '34d5ebe5-bfe3-4d82-9787-f92f58ef908b',
  'c0fd75dd-c9ae-4ae9-b38a-77bab24694ec',
  'a494bd14-5515-4089-844f-676e9e86c384',
  'f4da40f5-2e56-450c-bdd9-aa14db5dae4e',
  '7631235b-3b85-4b55-bec5-90e054b9f959',
  'e543dd4c-6452-4186-9e26-3534cfc96c6f',
  'f96978a4-14e5-4b7d-a785-d722b0d62491',
  '972e074a-42f8-4059-8de4-d057aaefd012',
  'a4c85546-b10c-432f-9f15-4974e63369e6',
  'd91a647f-798c-4d81-9ec7-8efee766b569',
  '8a9ced16-c963-4e9b-93b7-20d10f90db60',
  '05c887e0-6046-4afb-aee6-149e9796c3d8',
  '7215efbf-e00a-48b0-82cf-0b4252177849',
  'b8a732b2-5343-4055-8a8c-7b60787e62dd',
  '08b55f87-b2ec-4df1-bd75-ef824aff5273'
)
AND o.driver_id NOT IN (
  SELECT driver_id FROM public.ofertas_capacidade
  WHERE id IN (
    '9da0ba16-32a6-403e-a7f6-0f34fe8eb768',
    'a8583b34-ea6f-4045-b6e9-cba0d688c7e3'
  )
)
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_marketplace_is_test_oferta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.qa_accounts q WHERE q.user_id = NEW.driver_id) THEN
    NEW.is_test := true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_marketplace_is_test_procura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.qa_accounts q WHERE q.user_id = NEW.owner_id) THEN
    NEW.is_test := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ofertas_marketplace_is_test ON public.ofertas_capacidade;
CREATE TRIGGER trg_ofertas_marketplace_is_test
  BEFORE INSERT ON public.ofertas_capacidade
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_marketplace_is_test_oferta();

DROP TRIGGER IF EXISTS trg_procuras_marketplace_is_test ON public.procuras;
CREATE TRIGGER trg_procuras_marketplace_is_test
  BEFORE INSERT ON public.procuras
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_marketplace_is_test_procura();

-- RLS: browse público (anon) — excluir is_test
DROP POLICY IF EXISTS ofertas_select_anon_browse ON public.ofertas_capacidade;
CREATE POLICY ofertas_select_anon_browse ON public.ofertas_capacidade
  FOR SELECT TO anon
  USING (estado IN ('disponivel', 'parcial') AND NOT is_test);

DROP POLICY IF EXISTS procuras_select_anon_browse ON public.procuras;
CREATE POLICY procuras_select_anon_browse ON public.procuras
  FOR SELECT TO anon
  USING (estado IN ('activa', 'em_negociacao') AND NOT is_test);

-- RLS: autenticados — marketplace público exclui is_test; dono vê sempre os seus
DROP POLICY IF EXISTS ofertas_select_autenticados ON public.ofertas_capacidade;
CREATE POLICY ofertas_select_autenticados ON public.ofertas_capacidade
  FOR SELECT TO authenticated
  USING (NOT is_test OR driver_id = auth.uid());

DROP POLICY IF EXISTS procuras_select_autenticados ON public.procuras;
CREATE POLICY procuras_select_autenticados ON public.procuras
  FOR SELECT TO authenticated
  USING (NOT is_test OR owner_id = auth.uid());

-- Backfill: contas QA allowlist
UPDATE public.ofertas_capacidade o
SET is_test = true
WHERE o.driver_id IN (SELECT q.user_id FROM public.qa_accounts q);

UPDATE public.procuras p
SET is_test = true
WHERE p.owner_id IN (SELECT q.user_id FROM public.qa_accounts q);

-- Backfill: 18 ofertas de teste escondidas manualmente em prod (2026-10-08)
UPDATE public.ofertas_capacidade
SET is_test = true
WHERE id IN (
  'f230fdb5-3de4-434e-950f-dd25b7460e1c',
  '8149c96b-4095-4a52-bc79-b6398234a73d',
  'b48fe371-fd4c-437d-9d91-0ad8013a5766',
  '34d5ebe5-bfe3-4d82-9787-f92f58ef908b',
  'c0fd75dd-c9ae-4ae9-b38a-77bab24694ec',
  'a494bd14-5515-4089-844f-676e9e86c384',
  'f4da40f5-2e56-450c-bdd9-aa14db5dae4e',
  '7631235b-3b85-4b55-bec5-90e054b9f959',
  'e543dd4c-6452-4186-9e26-3534cfc96c6f',
  'f96978a4-14e5-4b7d-a785-d722b0d62491',
  '972e074a-42f8-4059-8de4-d057aaefd012',
  'a4c85546-b10c-432f-9f15-4974e63369e6',
  'd91a647f-798c-4d81-9ec7-8efee766b569',
  '8a9ced16-c963-4e9b-93b7-20d10f90db60',
  '05c887e0-6046-4afb-aee6-149e9796c3d8',
  '7215efbf-e00a-48b0-82cf-0b4252177849',
  'b8a732b2-5343-4055-8a8c-7b60787e62dd',
  '08b55f87-b2ec-4df1-bd75-ef824aff5273'
);

-- Garantir: ofertas reais do Joaquim não são de teste
UPDATE public.ofertas_capacidade
SET is_test = false
WHERE id IN (
  '9da0ba16-32a6-403e-a7f6-0f34fe8eb768',
  'a8583b34-ea6f-4045-b6e9-cba0d688c7e3'
);
