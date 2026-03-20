-- ============================================================
-- BOLEIA CERTA — Migração: Renomear colunas na tabela acordos
-- ============================================================

-- 1. Renomear as colunas id_rota para route_id e id_passageiro para passenger_id
ALTER TABLE public.acordos
RENAME COLUMN id_rota TO route_id;

ALTER TABLE public.acordos
RENAME COLUMN id_passageiro TO passenger_id;

-- 2. Atualizar as políticas em "acordos" para usar os novos nomes
DROP POLICY IF EXISTS "acordos_select_envolvidos" ON public.acordos;
CREATE POLICY "acordos_select_envolvidos"
    ON public.acordos
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = passenger_id
        OR auth.uid() = (
            SELECT driver_id FROM public.routes WHERE id = route_id
        )
    );

DROP POLICY IF EXISTS "acordos_insert_passageiro" ON public.acordos;
CREATE POLICY "acordos_insert_passageiro"
    ON public.acordos
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = passenger_id);

DROP POLICY IF EXISTS "acordos_update_envolvidos" ON public.acordos;
CREATE POLICY "acordos_update_envolvidos"
    ON public.acordos
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = passenger_id
        OR auth.uid() = (
            SELECT driver_id FROM public.routes WHERE id = route_id
        )
    )
    WITH CHECK (
        auth.uid() = passenger_id
        OR auth.uid() = (
            SELECT driver_id FROM public.routes WHERE id = route_id
        )
    );

DROP POLICY IF EXISTS "acordos_delete_envolvidos" ON public.acordos;
CREATE POLICY "acordos_delete_envolvidos"
    ON public.acordos
    FOR DELETE
    TO authenticated
    USING (
        auth.uid() = passenger_id
        OR auth.uid() = (
            SELECT driver_id FROM public.routes WHERE id = route_id
        )
    );

-- Atualizar políticas criadas anteriormente na drop_rotas_diarias.sql se ainda existirem
DROP POLICY IF EXISTS "acordos_select_motorista_rota" ON public.acordos;
CREATE POLICY "acordos_select_motorista_rota"
    ON public.acordos
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = (
            SELECT driver_id FROM public.routes WHERE id = route_id
        )
    );

DROP POLICY IF EXISTS "acordos_update_motorista_rota" ON public.acordos;
CREATE POLICY "acordos_update_motorista_rota"
    ON public.acordos
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = (
            SELECT driver_id FROM public.routes WHERE id = route_id
        )
    )
    WITH CHECK (
        auth.uid() = (
            SELECT driver_id FROM public.routes WHERE id = route_id
        )
    );

DROP POLICY IF EXISTS "acordos_delete_motorista_rota" ON public.acordos;
CREATE POLICY "acordos_delete_motorista_rota"
    ON public.acordos
    FOR DELETE
    TO authenticated
    USING (
        auth.uid() = (
            SELECT driver_id FROM public.routes WHERE id = route_id
        )
    );

DROP POLICY IF EXISTS "acordos_delete_motorista" ON public.acordos;
CREATE POLICY "acordos_delete_motorista"
    ON public.acordos
    FOR DELETE
    TO authenticated
    USING (
        auth.uid() = (
            SELECT driver_id FROM public.routes WHERE id = route_id
        )
    );

DROP POLICY IF EXISTS "acordos_update_motorista" ON public.acordos;
CREATE POLICY "acordos_update_motorista"
    ON public.acordos
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = (
            SELECT driver_id FROM public.routes WHERE id = route_id
        )
    )
    WITH CHECK (
        auth.uid() = (
            SELECT driver_id FROM public.routes WHERE id = route_id
        )
    );

-- 3. Atualizar as políticas em "faltas" para referenciar route_id e passenger_id
DROP POLICY IF EXISTS "faltas_select_envolvidos" ON public.faltas;
CREATE POLICY "faltas_select_envolvidos"
    ON public.faltas
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = (
            SELECT passenger_id FROM public.acordos WHERE id = faltas.id_acordo
        )
        OR auth.uid() = (
            SELECT r.driver_id
            FROM public.acordos a
            JOIN public.routes r ON a.route_id = r.id
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
            SELECT passenger_id FROM public.acordos WHERE id = id_acordo
        )
        OR auth.uid() = (
            SELECT r.driver_id
            FROM public.acordos a
            JOIN public.routes r ON a.route_id = r.id
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
            SELECT passenger_id FROM public.acordos WHERE id = faltas.id_acordo
        )
        OR auth.uid() = (
            SELECT r.driver_id
            FROM public.acordos a
            JOIN public.routes r ON a.route_id = r.id
            WHERE a.id = faltas.id_acordo
        )
    )
    WITH CHECK (
        auth.uid() = (
            SELECT passenger_id FROM public.acordos WHERE id = faltas.id_acordo
        )
        OR auth.uid() = (
            SELECT r.driver_id
            FROM public.acordos a
            JOIN public.routes r ON a.route_id = r.id
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
            SELECT passenger_id FROM public.acordos WHERE id = faltas.id_acordo
        )
        OR auth.uid() = (
            SELECT r.driver_id
            FROM public.acordos a
            JOIN public.routes r ON a.route_id = r.id
            WHERE a.id = faltas.id_acordo
        )
    );

-- 4. Atualizar o Trigger de desconto nas faltas
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
    JOIN public.routes r ON a.route_id = r.id
    WHERE a.id = NEW.id_acordo;

    IF v_valor_mensal IS NOT NULL THEN
        NEW.desconto_kz := ROUND((v_valor_mensal / 4.0 / 22.0), 2);
    END IF;

    RETURN NEW;
END;
$$;
