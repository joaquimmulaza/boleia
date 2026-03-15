-- ============================================================
-- BOLEIA CERTA — Migração: Criar tabela faltas e trigger de desconto
-- ============================================================

-- 1. TABELA faltas
CREATE TABLE public.faltas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_acordo UUID NOT NULL REFERENCES public.acordos(id) ON DELETE CASCADE,
  data_falta DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Passageiro', 'Motorista')),
  desconto_kz NUMERIC(10,2) NOT NULL DEFAULT 1590.91,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ===========================================================
-- 2. ROW LEVEL SECURITY (RLS)
-- ===========================================================

ALTER TABLE public.faltas ENABLE ROW LEVEL SECURITY;

-- ── faltas ──────────────────────────────────────────────────

-- Um utilizador pode ver faltas de um acordo se for o passageiro
-- ou o motorista dono da rota desse acordo.
CREATE POLICY "faltas_select_envolvidos"
    ON public.faltas
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = (
            SELECT id_passageiro FROM public.acordos WHERE id = faltas.id_acordo
        )
        OR auth.uid() = (
            SELECT rd.id_motorista 
            FROM public.acordos a 
            JOIN public.rotas_diarias rd ON a.id_rota = rd.id 
            WHERE a.id = faltas.id_acordo
        )
    );

-- Um utilizador pode inserir faltas para um acordo se for o passageiro
-- ou o motorista dono da rota desse acordo.
CREATE POLICY "faltas_insert_envolvidos"
    ON public.faltas
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = (
            SELECT id_passageiro FROM public.acordos WHERE id = id_acordo
        )
        OR auth.uid() = (
            SELECT rd.id_motorista 
            FROM public.acordos a 
            JOIN public.rotas_diarias rd ON a.id_rota = rd.id 
            WHERE a.id = id_acordo
        )
    );

-- Um utilizador pode atualizar faltas de um acordo se for o passageiro
-- ou o motorista dono da rota desse acordo.
CREATE POLICY "faltas_update_envolvidos"
    ON public.faltas
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = (
            SELECT id_passageiro FROM public.acordos WHERE id = faltas.id_acordo
        )
        OR auth.uid() = (
            SELECT rd.id_motorista 
            FROM public.acordos a 
            JOIN public.rotas_diarias rd ON a.id_rota = rd.id 
            WHERE a.id = faltas.id_acordo
        )
    )
    WITH CHECK (
        auth.uid() = (
            SELECT id_passageiro FROM public.acordos WHERE id = faltas.id_acordo
        )
        OR auth.uid() = (
            SELECT rd.id_motorista 
            FROM public.acordos a 
            JOIN public.rotas_diarias rd ON a.id_rota = rd.id 
            WHERE a.id = faltas.id_acordo
        )
    );

-- Um utilizador pode apagar faltas de um acordo se for o passageiro
-- ou o motorista dono da rota desse acordo.
CREATE POLICY "faltas_delete_envolvidos"
    ON public.faltas
    FOR DELETE
    TO authenticated
    USING (
        auth.uid() = (
            SELECT id_passageiro FROM public.acordos WHERE id = faltas.id_acordo
        )
        OR auth.uid() = (
            SELECT rd.id_motorista 
            FROM public.acordos a 
            JOIN public.rotas_diarias rd ON a.id_rota = rd.id 
            WHERE a.id = faltas.id_acordo
        )
    );

-- ===========================================================
-- 3. TRIGGER — Auto-calcular desconto_kz com base na Cláusula 9ª
-- ===========================================================
-- Fórmula: valor_diario = valor_mensal_total / 4 passageiros / 22 dias
--                        = valor_mensal_total / 88

CREATE OR REPLACE FUNCTION public.handle_falta_desconto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_valor_mensal NUMERIC;
BEGIN
    -- Obter o valor mensal total da rota associada ao acordo
    SELECT rd.valor_mensal_total INTO v_valor_mensal
    FROM public.acordos a
    JOIN public.rotas_diarias rd ON a.id_rota = rd.id
    WHERE a.id = NEW.id_acordo;

    IF v_valor_mensal IS NOT NULL THEN
        -- Calcula o valor diário e arredonda a 2 casas decimais
        NEW.desconto_kz := ROUND((v_valor_mensal / 4.0 / 22.0), 2);
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_falta_calc_desconto
    BEFORE INSERT OR UPDATE ON public.faltas
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_falta_desconto();
