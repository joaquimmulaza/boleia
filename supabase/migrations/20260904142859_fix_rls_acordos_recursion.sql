-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260904142859 fix_rls_acordos_recursion
-- Do not rename; Supabase Preview CI requires exact version match.

-- Break RLS recursion between acordos <-> acordos_passageiros via SECURITY DEFINER helpers

CREATE OR REPLACE FUNCTION public.is_acordo_driver(p_acordo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.acordos a
    WHERE a.id = p_acordo_id AND a.driver_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_acordo_passenger(p_acordo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id AND ap.passenger_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_acordo_driver(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_acordo_passenger(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_acordo_driver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_acordo_passenger(uuid) TO authenticated;

-- acordos
DROP POLICY IF EXISTS acordos_select_envolvidos ON public.acordos;
CREATE POLICY acordos_select_envolvidos ON public.acordos
  FOR SELECT TO authenticated
  USING (auth.uid() = driver_id OR public.is_acordo_passenger(id));

DROP POLICY IF EXISTS acordos_update_envolvidos ON public.acordos;
CREATE POLICY acordos_update_envolvidos ON public.acordos
  FOR UPDATE TO authenticated
  USING (auth.uid() = driver_id OR public.is_acordo_passenger(id))
  WITH CHECK (auth.uid() = driver_id OR public.is_acordo_passenger(id));

-- acordos_passageiros
DROP POLICY IF EXISTS acordos_passageiros_select_envolvidos ON public.acordos_passageiros;
CREATE POLICY acordos_passageiros_select_envolvidos ON public.acordos_passageiros
  FOR SELECT TO authenticated
  USING (auth.uid() = passenger_id OR public.is_acordo_driver(acordo_id));

DROP POLICY IF EXISTS acordos_passageiros_update_envolvidos ON public.acordos_passageiros;
CREATE POLICY acordos_passageiros_update_envolvidos ON public.acordos_passageiros
  FOR UPDATE TO authenticated
  USING (auth.uid() = passenger_id OR public.is_acordo_driver(acordo_id))
  WITH CHECK (auth.uid() = passenger_id OR public.is_acordo_driver(acordo_id));

-- faltas (also cross-referenced)
DROP POLICY IF EXISTS faltas_select_envolvidos ON public.faltas;
CREATE POLICY faltas_select_envolvidos ON public.faltas
  FOR SELECT TO authenticated
  USING (public.is_acordo_driver(id_acordo) OR public.is_acordo_passenger(id_acordo));

DROP POLICY IF EXISTS faltas_update_envolvidos ON public.faltas;
CREATE POLICY faltas_update_envolvidos ON public.faltas
  FOR UPDATE TO authenticated
  USING (public.is_acordo_driver(id_acordo) OR public.is_acordo_passenger(id_acordo))
  WITH CHECK (public.is_acordo_driver(id_acordo) OR public.is_acordo_passenger(id_acordo));

DROP POLICY IF EXISTS faltas_delete_envolvidos ON public.faltas;
CREATE POLICY faltas_delete_envolvidos ON public.faltas
  FOR DELETE TO authenticated
  USING (public.is_acordo_driver(id_acordo) OR public.is_acordo_passenger(id_acordo));

DROP POLICY IF EXISTS faltas_insert_envolvidos ON public.faltas;
CREATE POLICY faltas_insert_envolvidos ON public.faltas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_acordo_driver(id_acordo) OR public.is_acordo_passenger(id_acordo));
