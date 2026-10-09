-- Prova: authenticated não tem UPDATE em ofertas_capacidade após deploy da migração
-- 20261009143000_reactivar_oferta_rpc.sql (não aplica REVOKE aqui — só assert).
\set ON_ERROR_STOP on

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
