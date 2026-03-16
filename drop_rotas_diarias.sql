-- ============================================================
-- BOLEIA CERTA — Migração: Remover 'rotas_diarias' e usar 'routes'
-- ============================================================

-- 1. Alterar a FK de acordos para apontar para routes em vez de rotas_diarias
ALTER TABLE public.acordos
  DROP CONSTRAINT IF EXISTS acordos_id_rota_fkey;

ALTER TABLE public.acordos
  ADD CONSTRAINT acordos_id_rota_fkey 
  FOREIGN KEY (id_rota) 
  REFERENCES public.routes(id) 
  ON DELETE CASCADE;

-- 2. Atualizar Políticas de RLS em "acordos"
DROP POLICY IF EXISTS "acordos_select_motorista_rota" ON public.acordos;
CREATE POLICY "acordos_select_motorista_rota"
    ON public.acordos
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = (
            SELECT driver_id FROM public.routes WHERE id = id_rota
        )
    );

DROP POLICY IF EXISTS "acordos_update_motorista_rota" ON public.acordos;
CREATE POLICY "acordos_update_motorista_rota"
    ON public.acordos
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = (
            SELECT driver_id FROM public.routes WHERE id = id_rota
        )
    )
    WITH CHECK (
        auth.uid() = (
            SELECT driver_id FROM public.routes WHERE id = id_rota
        )
    );

DROP POLICY IF EXISTS "acordos_delete_motorista_rota" ON public.acordos;
CREATE POLICY "acordos_delete_motorista_rota"
    ON public.acordos
    FOR DELETE
    TO authenticated
    USING (
        auth.uid() = (
            SELECT driver_id FROM public.routes WHERE id = id_rota
        )
    );

-- As políticas delete originais tinham nomes diferentes no ficheiro de schema original.
-- DROP nas antigas caso existam:
DROP POLICY IF EXISTS "acordos_delete_motorista" ON public.acordos;
CREATE POLICY "acordos_delete_motorista"
    ON public.acordos
    FOR DELETE
    TO authenticated
    USING (
        auth.uid() = (
            SELECT driver_id FROM public.routes WHERE id = id_rota
        )
    );

DROP POLICY IF EXISTS "acordos_update_motorista" ON public.acordos;
CREATE POLICY "acordos_update_motorista"
    ON public.acordos
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = (
            SELECT driver_id FROM public.routes WHERE id = id_rota
        )
    )
    WITH CHECK (
        auth.uid() = (
            SELECT driver_id FROM public.routes WHERE id = id_rota
        )
    );


-- 3. Atualizar Políticas de RLS em "faltas"
DROP POLICY IF EXISTS "faltas_select_envolvidos" ON public.faltas;
CREATE POLICY "faltas_select_envolvidos"
    ON public.faltas
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = (
            SELECT id_passageiro FROM public.acordos WHERE id = faltas.id_acordo
        )
        OR auth.uid() = (
            SELECT r.driver_id 
            FROM public.acordos a 
            JOIN public.routes r ON a.id_rota = r.id 
            WHERE a.id = faltas.id_acordo
        )
    );

DROP POLICY IF EXISTS "faltas_insert_envolvidos" ON public.faltas;
CREATE POLICY "faltas_insert_envolvidos"
    ON public.faltas
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = (
            SELECT id_passageiro FROM public.acordos WHERE id = id_acordo
        )
        OR auth.uid() = (
            SELECT r.driver_id 
            FROM public.acordos a 
            JOIN public.routes r ON a.id_rota = r.id 
            WHERE a.id = id_acordo
        )
    );

DROP POLICY IF EXISTS "faltas_update_envolvidos" ON public.faltas;
CREATE POLICY "faltas_update_envolvidos"
    ON public.faltas
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = (
            SELECT id_passageiro FROM public.acordos WHERE id = faltas.id_acordo
        )
        OR auth.uid() = (
            SELECT r.driver_id 
            FROM public.acordos a 
            JOIN public.routes r ON a.id_rota = r.id 
            WHERE a.id = faltas.id_acordo
        )
    )
    WITH CHECK (
        auth.uid() = (
            SELECT id_passageiro FROM public.acordos WHERE id = faltas.id_acordo
        )
        OR auth.uid() = (
            SELECT r.driver_id 
            FROM public.acordos a 
            JOIN public.routes r ON a.id_rota = r.id 
            WHERE a.id = faltas.id_acordo
        )
    );

DROP POLICY IF EXISTS "faltas_delete_envolvidos" ON public.faltas;
CREATE POLICY "faltas_delete_envolvidos"
    ON public.faltas
    FOR DELETE
    TO authenticated
    USING (
        auth.uid() = (
            SELECT id_passageiro FROM public.acordos WHERE id = faltas.id_acordo
        )
        OR auth.uid() = (
            SELECT r.driver_id 
            FROM public.acordos a 
            JOIN public.routes r ON a.id_rota = r.id 
            WHERE a.id = faltas.id_acordo
        )
    );

-- 4. Atualizar Trigger de faltas para usar a tabela 'routes'
CREATE OR REPLACE FUNCTION public.handle_falta_desconto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_valor_mensal NUMERIC;
BEGIN
    SELECT r.monthly_price_per_seat INTO v_valor_mensal
    FROM public.acordos a
    JOIN public.routes r ON a.id_rota = r.id
    WHERE a.id = NEW.id_acordo;

    IF v_valor_mensal IS NOT NULL THEN
        NEW.desconto_kz := ROUND((v_valor_mensal / 4.0 / 22.0), 2);
    END IF;

    RETURN NEW;
END;
$$;

-- 5. Finalmente, eliminar a tabela rotas_diarias
DROP TABLE IF EXISTS public.rotas_diarias CASCADE;
