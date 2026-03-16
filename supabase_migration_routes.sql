-- ============================================================
-- Migração: Criação da tabela routes e políticas RLS
-- ============================================================

-- Criação da tabela routes
CREATE TABLE public.routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
    origin_name TEXT NOT NULL,
    destination_name TEXT NOT NULL,
    departure_time TIME NOT NULL,
    return_time TIME NOT NULL,
    available_seats INTEGER NOT NULL CHECK (available_seats > 0),
    monthly_price_per_seat NUMERIC(10, 2) NOT NULL CHECK (monthly_price_per_seat >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Ativar Row Level Security
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

-- ===========================================================
-- POLÍTICAS RLS para rotas
-- ===========================================================

-- Qualquer utilizador autenticado pode ler rotas.
CREATE POLICY "routes_select_autenticados"
    ON public.routes
    FOR SELECT
    TO authenticated
    USING (true);

-- Apenas o próprio motorista pode inserir as suas rotas.
CREATE POLICY "routes_insert_proprio_motorista"
    ON public.routes
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = driver_id);

-- Apenas o próprio motorista pode atualizar as suas rotas.
CREATE POLICY "routes_update_proprio_motorista"
    ON public.routes
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = driver_id)
    WITH CHECK (auth.uid() = driver_id);

-- Apenas o próprio motorista pode apagar as suas rotas.
CREATE POLICY "routes_delete_proprio_motorista"
    ON public.routes
    FOR DELETE
    TO authenticated
    USING (auth.uid() = driver_id);
