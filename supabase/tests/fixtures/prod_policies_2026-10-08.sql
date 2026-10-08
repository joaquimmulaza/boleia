-- Dump verbatim de pg_policies (prod fdclrbcgytnuqcrpsevw, 2026-10-08 ~14:10 WAT), schema public, ANTES das migrations do #224.
-- Usar estas definições tal e qual no schema do proof (depois aplicar 142000/142100/142200 por cima).

-- ofertas_capacidade
CREATE POLICY ofertas_select_autenticados ON public.ofertas_capacidade FOR SELECT TO authenticated USING (true);
CREATE POLICY ofertas_select_anon_browse ON public.ofertas_capacidade FOR SELECT TO anon USING ((estado = ANY (ARRAY['disponivel'::text, 'parcial'::text])));
CREATE POLICY ofertas_insert_proprio ON public.ofertas_capacidade FOR INSERT TO authenticated WITH CHECK ((auth.uid() = driver_id));
CREATE POLICY ofertas_update_proprio ON public.ofertas_capacidade FOR UPDATE TO authenticated USING ((auth.uid() = driver_id)) WITH CHECK ((auth.uid() = driver_id));
CREATE POLICY ofertas_delete_proprio ON public.ofertas_capacidade FOR DELETE TO authenticated USING ((auth.uid() = driver_id));

-- procuras
CREATE POLICY procuras_select_autenticados ON public.procuras FOR SELECT TO authenticated USING (true);
CREATE POLICY procuras_select_anon_browse ON public.procuras FOR SELECT TO anon USING ((estado = ANY (ARRAY['activa'::text, 'em_negociacao'::text])));
CREATE POLICY procuras_insert_proprio ON public.procuras FOR INSERT TO authenticated WITH CHECK ((auth.uid() = owner_id));
CREATE POLICY procuras_update_proprio ON public.procuras FOR UPDATE TO authenticated USING ((auth.uid() = owner_id)) WITH CHECK ((auth.uid() = owner_id));
CREATE POLICY procuras_delete_proprio ON public.procuras FOR DELETE TO authenticated USING ((auth.uid() = owner_id));

-- propostas
CREATE POLICY propostas_select_envolvidos ON public.propostas FOR SELECT TO authenticated USING (((auth.uid() = created_by) OR (auth.uid() = ( SELECT o.driver_id
   FROM ofertas_capacidade o
  WHERE (o.id = propostas.oferta_id))) OR (auth.uid() = ( SELECT p.owner_id
   FROM procuras p
  WHERE (p.id = propostas.procura_id)))));
CREATE POLICY propostas_insert_envolvidos ON public.propostas FOR INSERT TO authenticated WITH CHECK (((auth.uid() = created_by) AND ((auth.uid() = ( SELECT o.driver_id
   FROM ofertas_capacidade o
  WHERE (o.id = propostas.oferta_id))) OR (auth.uid() = ( SELECT p.owner_id
   FROM procuras p
  WHERE (p.id = propostas.procura_id))))));

-- acordos / acordos_passageiros (helpers is_acordo_passenger / is_acordo_driver são SECURITY DEFINER em prod)
CREATE POLICY acordos_select_envolvidos ON public.acordos FOR SELECT TO authenticated USING (((auth.uid() = driver_id) OR is_acordo_passenger(id)));
CREATE POLICY acordos_passageiros_select_envolvidos ON public.acordos_passageiros FOR SELECT TO authenticated USING (((auth.uid() = passenger_id) OR is_acordo_driver(acordo_id)));

-- membros_grupo
CREATE POLICY membros_select_autenticados ON public.membros_grupo FOR SELECT TO authenticated USING (true);
CREATE POLICY membros_insert_envolvidos ON public.membros_grupo FOR INSERT TO authenticated WITH CHECK (((auth.uid() = ( SELECT p.owner_id
   FROM (grupos g
     JOIN procuras p ON ((p.id = g.procura_id)))
  WHERE (g.id = membros_grupo.grupo_id))) OR ((auth.uid() = passenger_id) AND (lower(estado) = 'pendente'::text))));
CREATE POLICY membros_update_owner ON public.membros_grupo FOR UPDATE TO authenticated USING ((auth.uid() = ( SELECT p.owner_id
   FROM (grupos g
     JOIN procuras p ON ((p.id = g.procura_id)))
  WHERE (g.id = membros_grupo.grupo_id)))) WITH CHECK ((auth.uid() = ( SELECT p.owner_id
   FROM (grupos g
     JOIN procuras p ON ((p.id = g.procura_id)))
  WHERE (g.id = membros_grupo.grupo_id))));
CREATE POLICY membros_update_self_reabrir_pendente ON public.membros_grupo FOR UPDATE TO authenticated USING (((auth.uid() = passenger_id) AND (lower(estado) = ANY (ARRAY['rejeitado'::text, 'saiu'::text, 'pendente'::text])))) WITH CHECK (((auth.uid() = passenger_id) AND (lower(estado) = 'pendente'::text)));
CREATE POLICY membros_delete_envolvidos ON public.membros_grupo FOR DELETE TO authenticated USING (((auth.uid() = passenger_id) OR (auth.uid() = ( SELECT p.owner_id
   FROM (grupos g
     JOIN procuras p ON ((p.id = g.procura_id)))
  WHERE (g.id = membros_grupo.grupo_id)))));
