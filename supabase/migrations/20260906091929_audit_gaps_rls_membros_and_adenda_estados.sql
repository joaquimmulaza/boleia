-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260906091929 audit_gaps_rls_membros_and_adenda_estados
-- Do not rename; Supabase Preview CI requires exact version match.

-- Task 2 RLS + Task 6a estados
DROP POLICY IF EXISTS membros_insert_envolvidos ON public.membros_grupo;

CREATE POLICY membros_insert_envolvidos
  ON public.membros_grupo
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      auth.uid() = (
        SELECT p.owner_id
        FROM public.grupos g
        JOIN public.procuras p ON p.id = g.procura_id
        WHERE g.id = membros_grupo.grupo_id
      )
    )
    OR (
      auth.uid() = passenger_id
      AND lower(estado) = 'pendente'
    )
  );

ALTER TABLE public.acordos_adendas
  DROP CONSTRAINT IF EXISTS acordos_adendas_estado_check;

ALTER TABLE public.acordos_adendas
  ADD CONSTRAINT acordos_adendas_estado_check
  CHECK (
    lower(estado) = ANY (
      ARRAY[
        'pendente_passageiro'::text,
        'pendente_contraparte'::text,
        'rejeitada'::text,
        'cancelada_iniciador'::text,
        'aceite'::text,
        'em_vigor'::text
      ]
    )
  );
