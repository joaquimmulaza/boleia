-- Prova: authenticated não tem UPDATE em ofertas_capacidade (pós-migração reactivar_oferta).
\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

-- Aplicar revokes da migração (espelho do deploy)
REVOKE UPDATE ON TABLE public.ofertas_capacidade FROM authenticated;
REVOKE UPDATE ON TABLE public.ofertas_capacidade FROM anon;

DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.ofertas_capacidade', 'UPDATE') THEN
    RAISE EXCEPTION 'FALHA: authenticated ainda tem UPDATE na tabela ofertas_capacidade';
  END IF;

  IF has_column_privilege('authenticated', 'public.ofertas_capacidade', 'estado', 'UPDATE') THEN
    RAISE EXCEPTION 'FALHA: authenticated pode UPDATE coluna estado';
  END IF;

  IF has_column_privilege('authenticated', 'public.ofertas_capacidade', 'is_test', 'UPDATE') THEN
    RAISE EXCEPTION 'FALHA: authenticated pode UPDATE coluna is_test';
  END IF;

  IF has_column_privilege('authenticated', 'public.ofertas_capacidade', 'inactiva_motivo', 'UPDATE') THEN
    RAISE EXCEPTION 'FALHA: authenticated pode UPDATE coluna inactiva_motivo';
  END IF;

  IF has_column_privilege('authenticated', 'public.ofertas_capacidade', 'vagas_totais', 'UPDATE') THEN
    RAISE EXCEPTION 'FALHA: authenticated pode UPDATE coluna vagas_totais';
  END IF;

  IF has_column_privilege('authenticated', 'public.ofertas_capacidade', 'vagas_disponiveis', 'UPDATE') THEN
    RAISE EXCEPTION 'FALHA: authenticated pode UPDATE coluna vagas_disponiveis';
  END IF;
END $$;
