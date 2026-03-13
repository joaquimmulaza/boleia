-- ============================================================
-- BOLEIA CERTA — Schema PostgreSQL para Supabase
-- Corre este script inteiro no SQL Editor do Supabase.
-- ============================================================


-- ===========================================================
-- 1. TABELAS
-- ===========================================================

-- 1.1 perfis
-- Espelha cada utilizador do auth.users e guarda dados de perfil.
CREATE TABLE public.perfis (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome_completo   TEXT,
    telefone        TEXT,
    tipo_perfil     TEXT NOT NULL CHECK (tipo_perfil IN ('Passageiro', 'Motorista')),
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 1.2 veiculos
-- Veículos registados pelos motoristas.
CREATE TABLE public.veiculos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_motorista        UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
    marca_modelo        TEXT NOT NULL,
    matricula           TEXT NOT NULL,
    lugares_disponiveis INTEGER NOT NULL CHECK (lugares_disponiveis > 0),
    created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 1.3 rotas_diarias
-- Rotas publicadas pelos motoristas.
CREATE TABLE public.rotas_diarias (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_motorista        UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
    ponto_partida       TEXT NOT NULL,
    ponto_chegada       TEXT NOT NULL,
    hora_recolha        TIME NOT NULL,
    valor_mensal_total  NUMERIC(10, 2) NOT NULL CHECK (valor_mensal_total >= 0),
    created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 1.4 acordos
-- Acordos de partilha de rota entre um passageiro e o dono de uma rota.
CREATE TABLE public.acordos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_rota         UUID NOT NULL REFERENCES public.rotas_diarias(id) ON DELETE CASCADE,
    id_passageiro   UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
    estado          TEXT NOT NULL DEFAULT 'Pendente' CHECK (estado IN ('Pendente', 'Ativo', 'Cancelado')),
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- ===========================================================
-- 2. ROW LEVEL SECURITY (RLS)
-- ===========================================================

ALTER TABLE public.perfis       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotas_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acordos      ENABLE ROW LEVEL SECURITY;


-- ===========================================================
-- 3. POLÍTICAS RLS
-- ===========================================================

-- ── perfis ──────────────────────────────────────────────────

-- Qualquer utilizador autenticado pode ler todos os perfis.
CREATE POLICY "perfis_select_autenticados"
    ON public.perfis
    FOR SELECT
    TO authenticated
    USING (true);

-- Um utilizador só pode atualizar o seu próprio perfil.
CREATE POLICY "perfis_update_proprio"
    ON public.perfis
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ── veiculos ─────────────────────────────────────────────────

-- Qualquer utilizador autenticado pode ler veículos.
CREATE POLICY "veiculos_select_autenticados"
    ON public.veiculos
    FOR SELECT
    TO authenticated
    USING (true);

-- Apenas o próprio motorista pode inserir os seus veículos.
CREATE POLICY "veiculos_insert_proprio_motorista"
    ON public.veiculos
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id_motorista);

-- Apenas o próprio motorista pode atualizar os seus veículos.
CREATE POLICY "veiculos_update_proprio_motorista"
    ON public.veiculos
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id_motorista)
    WITH CHECK (auth.uid() = id_motorista);

-- Apenas o próprio motorista pode apagar os seus veículos.
CREATE POLICY "veiculos_delete_proprio_motorista"
    ON public.veiculos
    FOR DELETE
    TO authenticated
    USING (auth.uid() = id_motorista);

-- ── rotas_diarias ────────────────────────────────────────────

-- Qualquer utilizador autenticado pode ler rotas.
CREATE POLICY "rotas_select_autenticados"
    ON public.rotas_diarias
    FOR SELECT
    TO authenticated
    USING (true);

-- Apenas o próprio motorista pode inserir as suas rotas.
CREATE POLICY "rotas_insert_proprio_motorista"
    ON public.rotas_diarias
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id_motorista);

-- Apenas o próprio motorista pode atualizar as suas rotas.
CREATE POLICY "rotas_update_proprio_motorista"
    ON public.rotas_diarias
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id_motorista)
    WITH CHECK (auth.uid() = id_motorista);

-- Apenas o próprio motorista pode apagar as suas rotas.
CREATE POLICY "rotas_delete_proprio_motorista"
    ON public.rotas_diarias
    FOR DELETE
    TO authenticated
    USING (auth.uid() = id_motorista);

-- ── acordos ──────────────────────────────────────────────────

-- Um utilizador pode ver acordos onde é o passageiro OU onde
-- é o motorista dono da rota.
CREATE POLICY "acordos_select_envolvidos"
    ON public.acordos
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = id_passageiro
        OR auth.uid() = (
            SELECT id_motorista FROM public.rotas_diarias WHERE id = id_rota
        )
    );

-- Um utilizador pode inserir acordos apenas como passageiro.
CREATE POLICY "acordos_insert_passageiro"
    ON public.acordos
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id_passageiro);

-- Um utilizador pode atualizar um acordo se for o passageiro
-- ou o motorista dono da rota (ex: para aceitar/recusar).
CREATE POLICY "acordos_update_envolvidos"
    ON public.acordos
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = id_passageiro
        OR auth.uid() = (
            SELECT id_motorista FROM public.rotas_diarias WHERE id = id_rota
        )
    )
    WITH CHECK (
        auth.uid() = id_passageiro
        OR auth.uid() = (
            SELECT id_motorista FROM public.rotas_diarias WHERE id = id_rota
        )
    );

-- Um utilizador pode apagar um acordo se for o passageiro
-- ou o motorista dono da rota.
CREATE POLICY "acordos_delete_envolvidos"
    ON public.acordos
    FOR DELETE
    TO authenticated
    USING (
        auth.uid() = id_passageiro
        OR auth.uid() = (
            SELECT id_motorista FROM public.rotas_diarias WHERE id = id_rota
        )
    );


-- ===========================================================
-- 4. TRIGGER — Auto-criar perfil após registo
-- ===========================================================

-- Função chamada pelo trigger sempre que um novo utilizador
-- é criado em auth.users. Lê o tipo_perfil do metadata do registo.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
-- Necessário para que a função possa escrever em public.perfis
-- mesmo quando chamada a partir do schema auth.
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.perfis (id, nome_completo, tipo_perfil)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data ->> 'nome_completo',
        -- Usa o tipo_perfil vindo do raw_user_meta_data;
        -- se não vier (ou for inválido), assume 'Passageiro' como seguro.
        COALESCE(
            NULLIF(NEW.raw_user_meta_data ->> 'tipo_perfil', ''),
            'Passageiro'
        )
    );
    RETURN NEW;
END;
$$;

-- Trigger que dispara a função após cada novo utilizador.
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
