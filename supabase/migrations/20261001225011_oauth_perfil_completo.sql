-- OAuth: perfil pode nascer sem papel/telefone. Contas existentes ficam completas.

ALTER TABLE public.perfis ALTER COLUMN tipo_perfil DROP NOT NULL;

ALTER TABLE public.perfis DROP CONSTRAINT IF EXISTS perfis_tipo_perfil_check;

ALTER TABLE public.perfis ADD CONSTRAINT perfis_tipo_perfil_check
  CHECK (
    tipo_perfil IS NULL
    OR tipo_perfil = ANY (ARRAY['Passageiro'::text, 'Motorista'::text])
  );

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS perfil_completo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.perfis.perfil_completo IS
  'false enquanto falta telefone ou papel depois de um registo OAuth.';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
  v_telefone text;
  v_tipo text;
  v_completo boolean;
BEGIN
  v_nome := NULLIF(btrim(COALESCE(
    new.raw_user_meta_data->>'nome_completo',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    ''
  )), '');

  v_telefone := NULLIF(btrim(COALESCE(new.raw_user_meta_data->>'telefone', '')), '');

  v_tipo := NULLIF(btrim(COALESCE(new.raw_user_meta_data->>'tipo_perfil', '')), '');
  IF v_tipo IS NOT NULL AND v_tipo NOT IN ('Passageiro', 'Motorista') THEN
    v_tipo := NULL;
  END IF;

  v_completo := v_telefone IS NOT NULL AND v_tipo IS NOT NULL;

  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil, perfil_completo)
  VALUES (new.id, v_nome, v_telefone, v_tipo, v_completo);

  RETURN new;
END;
$$;
