-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260906224444 eng7_adenda_states_respond_rpc
-- Do not rename; Supabase Preview CI requires exact version match.

-- PACOTE ENG #7: adendas — aceite_agendada, cancelada_substituta, respond_agreement_adenda

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
        'cancelada_substituta'::text,
        'aceite'::text,
        'aceite_agendada'::text,
        'em_vigor'::text
      ]
    )
  );

UPDATE public.acordos_adendas
SET estado = 'aceite_agendada'
WHERE lower(estado) = 'aceite'
  AND applied_at IS NULL
  AND superseded_at IS NULL;
