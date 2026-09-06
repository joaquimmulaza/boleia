-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260904135648 marketplace_t6_create_oferta_procura_schema
-- Do not rename; Supabase Preview CI requires exact version match.

-- T6: ofertas / procuras / grupos / propostas / lista_espera / acordos 1:N / faltas + RLS

-- === ofertas_capacidade ===
CREATE TABLE public.ofertas_capacidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE RESTRICT,
  vagas_totais integer NOT NULL CHECK (vagas_totais >= 1),
  vagas_disponiveis integer NOT NULL CHECK (vagas_disponiveis >= 0),
  modo_preco text NOT NULL CHECK (modo_preco IN ('POR_PASSAGEIRO', 'TOTAL_ACORDO')),
  valor_mensal_ask_kz integer NOT NULL CHECK (valor_mensal_ask_kz >= 0),
  flexibilidade_rota boolean NOT NULL DEFAULT false,
  origin_name text,
  destination_name text,
  origin_lat numeric,
  origin_lng numeric,
  destination_lat numeric,
  destination_lng numeric,
  departure_time time without time zone NOT NULL,
  return_time time without time zone,
  dias_semana integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  estado text NOT NULL DEFAULT 'disponivel'
    CHECK (estado IN ('inactiva', 'disponivel', 'parcial', 'cheia')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ofertas_vagas_lte_totais CHECK (vagas_disponiveis <= vagas_totais)
);

CREATE INDEX ofertas_capacidade_driver_id_idx ON public.ofertas_capacidade (driver_id);
CREATE INDEX ofertas_capacidade_estado_idx ON public.ofertas_capacidade (estado);

-- === procuras ===
CREATE TABLE public.procuras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  preferred_time time without time zone NOT NULL,
  return_time time without time zone,
  origin_name text,
  destination_name text,
  origin_lat numeric,
  origin_lng numeric,
  destination_lat numeric,
  destination_lng numeric,
  n_candidato integer NOT NULL DEFAULT 1 CHECK (n_candidato >= 1),
  teto_mensal_kz integer CHECK (teto_mensal_kz IS NULL OR teto_mensal_kz >= 0),
  estado text NOT NULL DEFAULT 'activa'
    CHECK (estado IN ('activa', 'em_negociacao', 'fechada', 'cancelada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX procuras_owner_id_idx ON public.procuras (owner_id);
CREATE INDEX procuras_estado_idx ON public.procuras (estado);

-- === grupos + membros ===
CREATE TABLE public.grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procura_id uuid NOT NULL UNIQUE REFERENCES public.procuras(id) ON DELETE CASCADE,
  nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.membros_grupo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  pickup_name text,
  pickup_lat numeric,
  pickup_lng numeric,
  dropoff_name text,
  dropoff_lat numeric,
  dropoff_lng numeric,
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'saiu')),
  ordem_insercao integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grupo_id, passenger_id)
);

CREATE INDEX membros_grupo_grupo_id_idx ON public.membros_grupo (grupo_id);

-- === propostas (1 procura : M propostas) ===
CREATE TABLE public.propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id uuid NOT NULL REFERENCES public.ofertas_capacidade(id) ON DELETE CASCADE,
  procura_id uuid NOT NULL REFERENCES public.procuras(id) ON DELETE CASCADE,
  grupo_id uuid REFERENCES public.grupos(id) ON DELETE SET NULL,
  modo_preco text NOT NULL CHECK (modo_preco IN ('POR_PASSAGEIRO', 'TOTAL_ACORDO')),
  valor_mensal_ask_kz integer NOT NULL CHECK (valor_mensal_ask_kz >= 0),
  n_passageiros_propostos integer NOT NULL CHECK (n_passageiros_propostos >= 1),
  valor_mensal_por_passageiro_resolvido_kz integer,
  valor_mensal_total_resolvido_kz integer,
  estado text NOT NULL DEFAULT 'aberta'
    CHECK (estado IN ('aberta', 'aceite', 'rejeitada', 'invalidada', 'cancelada')),
  created_by uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX propostas_procura_id_idx ON public.propostas (procura_id);
CREATE INDEX propostas_oferta_id_idx ON public.propostas (oferta_id);
CREATE INDEX propostas_estado_idx ON public.propostas (estado);

-- === lista_espera ===
CREATE TABLE public.lista_espera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id uuid NOT NULL REFERENCES public.ofertas_capacidade(id) ON DELETE CASCADE,
  procura_id uuid NOT NULL REFERENCES public.procuras(id) ON DELETE CASCADE,
  grupo_id uuid REFERENCES public.grupos(id) ON DELETE SET NULL,
  estado text NOT NULL DEFAULT 'activa'
    CHECK (estado IN ('activa', 'notificada', 'cancelada', 'promovida')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (oferta_id, procura_id)
);

CREATE INDEX lista_espera_oferta_id_idx ON public.lista_espera (oferta_id);

-- === acordos (cabeçalho, SEM passenger_id) ===
CREATE TABLE public.acordos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id uuid NOT NULL REFERENCES public.ofertas_capacidade(id) ON DELETE RESTRICT,
  procura_id uuid REFERENCES public.procuras(id) ON DELETE SET NULL,
  grupo_id uuid REFERENCES public.grupos(id) ON DELETE SET NULL,
  driver_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  modo_preco text NOT NULL CHECK (modo_preco IN ('POR_PASSAGEIRO', 'TOTAL_ACORDO')),
  n_passageiros_contrato integer NOT NULL CHECK (n_passageiros_contrato >= 1),
  valor_mensal_total_kz integer NOT NULL CHECK (valor_mensal_total_kz >= 0),
  valor_mensal_por_passageiro_kz integer NOT NULL CHECK (valor_mensal_por_passageiro_kz >= 0),
  dias_uteis_mes integer NOT NULL DEFAULT 22 CHECK (dias_uteis_mes >= 1),
  dia_pagamento integer DEFAULT 1,
  aviso_previo_dias integer DEFAULT 15,
  tolerancia_atraso_min integer DEFAULT 10,
  regra_desconto_falta text NOT NULL DEFAULT 'so_ida_e_regresso',
  estado text NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo', 'suspenso', 'cancelado', 'expirado')),
  is_hidden_by_user boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX acordos_driver_id_idx ON public.acordos (driver_id);
CREATE INDEX acordos_oferta_id_idx ON public.acordos (oferta_id);
CREATE INDEX acordos_estado_idx ON public.acordos (estado);

-- === acordos_passageiros (N) ===
CREATE TABLE public.acordos_passageiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acordo_id uuid NOT NULL REFERENCES public.acordos(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  quota_mensal_kz integer NOT NULL CHECK (quota_mensal_kz >= 0),
  ordem_insercao integer NOT NULL CHECK (ordem_insercao >= 0),
  pickup_name text,
  pickup_lat numeric,
  pickup_lng numeric,
  dropoff_name text,
  dropoff_lat numeric,
  dropoff_lng numeric,
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'saiu')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (acordo_id, passenger_id)
);

CREATE INDEX acordos_passageiros_acordo_id_idx ON public.acordos_passageiros (acordo_id);
CREATE INDEX acordos_passageiros_passenger_id_idx ON public.acordos_passageiros (passenger_id);

-- === faltas (recriada; sem default ilustrativo 1590.91) ===
CREATE TABLE public.faltas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_acordo uuid NOT NULL REFERENCES public.acordos(id) ON DELETE CASCADE,
  passenger_id uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  data_falta date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('Passageiro', 'Motorista')),
  viagem text NOT NULL DEFAULT 'ambas' CHECK (viagem IN ('ida', 'regresso', 'ambas')),
  desconto_kz numeric NOT NULL DEFAULT 0,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX faltas_id_acordo_idx ON public.faltas (id_acordo);

-- === RLS ===
ALTER TABLE public.ofertas_capacidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procuras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros_grupo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lista_espera ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acordos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acordos_passageiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faltas ENABLE ROW LEVEL SECURITY;

-- ofertas: leitura autenticados; escrita do próprio motorista
CREATE POLICY ofertas_select_autenticados ON public.ofertas_capacidade
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ofertas_insert_proprio ON public.ofertas_capacidade
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = driver_id);
CREATE POLICY ofertas_update_proprio ON public.ofertas_capacidade
  FOR UPDATE TO authenticated USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);
CREATE POLICY ofertas_delete_proprio ON public.ofertas_capacidade
  FOR DELETE TO authenticated USING (auth.uid() = driver_id);

-- procuras
CREATE POLICY procuras_select_autenticados ON public.procuras
  FOR SELECT TO authenticated USING (true);
CREATE POLICY procuras_insert_proprio ON public.procuras
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY procuras_update_proprio ON public.procuras
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY procuras_delete_proprio ON public.procuras
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- grupos: via owner da procura
CREATE POLICY grupos_select_autenticados ON public.grupos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY grupos_insert_owner ON public.grupos
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = (SELECT owner_id FROM public.procuras p WHERE p.id = procura_id)
  );
CREATE POLICY grupos_update_owner ON public.grupos
  FOR UPDATE TO authenticated
  USING (auth.uid() = (SELECT owner_id FROM public.procuras p WHERE p.id = procura_id))
  WITH CHECK (auth.uid() = (SELECT owner_id FROM public.procuras p WHERE p.id = procura_id));
CREATE POLICY grupos_delete_owner ON public.grupos
  FOR DELETE TO authenticated
  USING (auth.uid() = (SELECT owner_id FROM public.procuras p WHERE p.id = procura_id));

-- membros_grupo: owner da procura ou o próprio membro
CREATE POLICY membros_select_autenticados ON public.membros_grupo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY membros_insert_envolvidos ON public.membros_grupo
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = passenger_id
    OR auth.uid() = (
      SELECT p.owner_id FROM public.grupos g
      JOIN public.procuras p ON p.id = g.procura_id
      WHERE g.id = grupo_id
    )
  );
CREATE POLICY membros_update_envolvidos ON public.membros_grupo
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = passenger_id
    OR auth.uid() = (
      SELECT p.owner_id FROM public.grupos g
      JOIN public.procuras p ON p.id = g.procura_id
      WHERE g.id = grupo_id
    )
  )
  WITH CHECK (
    auth.uid() = passenger_id
    OR auth.uid() = (
      SELECT p.owner_id FROM public.grupos g
      JOIN public.procuras p ON p.id = g.procura_id
      WHERE g.id = grupo_id
    )
  );
CREATE POLICY membros_delete_envolvidos ON public.membros_grupo
  FOR DELETE TO authenticated
  USING (
    auth.uid() = passenger_id
    OR auth.uid() = (
      SELECT p.owner_id FROM public.grupos g
      JOIN public.procuras p ON p.id = g.procura_id
      WHERE g.id = grupo_id
    )
  );

-- propostas: motorista da oferta, owner da procura, ou criador
CREATE POLICY propostas_select_envolvidos ON public.propostas
  FOR SELECT TO authenticated USING (
    auth.uid() = created_by
    OR auth.uid() = (SELECT driver_id FROM public.ofertas_capacidade o WHERE o.id = oferta_id)
    OR auth.uid() = (SELECT owner_id FROM public.procuras p WHERE p.id = procura_id)
  );
CREATE POLICY propostas_insert_envolvidos ON public.propostas
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = created_by
    AND (
      auth.uid() = (SELECT driver_id FROM public.ofertas_capacidade o WHERE o.id = oferta_id)
      OR auth.uid() = (SELECT owner_id FROM public.procuras p WHERE p.id = procura_id)
    )
  );
CREATE POLICY propostas_update_envolvidos ON public.propostas
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = (SELECT driver_id FROM public.ofertas_capacidade o WHERE o.id = oferta_id)
    OR auth.uid() = (SELECT owner_id FROM public.procuras p WHERE p.id = procura_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT driver_id FROM public.ofertas_capacidade o WHERE o.id = oferta_id)
    OR auth.uid() = (SELECT owner_id FROM public.procuras p WHERE p.id = procura_id)
  );

-- lista_espera
CREATE POLICY lista_espera_select_envolvidos ON public.lista_espera
  FOR SELECT TO authenticated USING (
    auth.uid() = (SELECT driver_id FROM public.ofertas_capacidade o WHERE o.id = oferta_id)
    OR auth.uid() = (SELECT owner_id FROM public.procuras p WHERE p.id = procura_id)
  );
CREATE POLICY lista_espera_insert_owner ON public.lista_espera
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = (SELECT owner_id FROM public.procuras p WHERE p.id = procura_id)
  );
CREATE POLICY lista_espera_update_envolvidos ON public.lista_espera
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = (SELECT driver_id FROM public.ofertas_capacidade o WHERE o.id = oferta_id)
    OR auth.uid() = (SELECT owner_id FROM public.procuras p WHERE p.id = procura_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT driver_id FROM public.ofertas_capacidade o WHERE o.id = oferta_id)
    OR auth.uid() = (SELECT owner_id FROM public.procuras p WHERE p.id = procura_id)
  );
CREATE POLICY lista_espera_delete_envolvidos ON public.lista_espera
  FOR DELETE TO authenticated
  USING (
    auth.uid() = (SELECT driver_id FROM public.ofertas_capacidade o WHERE o.id = oferta_id)
    OR auth.uid() = (SELECT owner_id FROM public.procuras p WHERE p.id = procura_id)
  );

-- acordos: motorista ou passageiro activo/saiu no acordo
CREATE POLICY acordos_select_envolvidos ON public.acordos
  FOR SELECT TO authenticated USING (
    auth.uid() = driver_id
    OR EXISTS (
      SELECT 1 FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = acordos.id AND ap.passenger_id = auth.uid()
    )
  );
CREATE POLICY acordos_update_envolvidos ON public.acordos
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = driver_id
    OR EXISTS (
      SELECT 1 FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = acordos.id AND ap.passenger_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = driver_id
    OR EXISTS (
      SELECT 1 FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = acordos.id AND ap.passenger_id = auth.uid()
    )
  );
-- INSERT só via RPC security definer (sem policy insert para authenticated)

CREATE POLICY acordos_passageiros_select_envolvidos ON public.acordos_passageiros
  FOR SELECT TO authenticated USING (
    auth.uid() = passenger_id
    OR auth.uid() = (SELECT driver_id FROM public.acordos a WHERE a.id = acordo_id)
  );
CREATE POLICY acordos_passageiros_update_envolvidos ON public.acordos_passageiros
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = passenger_id
    OR auth.uid() = (SELECT driver_id FROM public.acordos a WHERE a.id = acordo_id)
  )
  WITH CHECK (
    auth.uid() = passenger_id
    OR auth.uid() = (SELECT driver_id FROM public.acordos a WHERE a.id = acordo_id)
  );

-- faltas: motorista ou passageiro do acordo
CREATE POLICY faltas_select_envolvidos ON public.faltas
  FOR SELECT TO authenticated USING (
    auth.uid() = (SELECT driver_id FROM public.acordos a WHERE a.id = id_acordo)
    OR EXISTS (
      SELECT 1 FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = faltas.id_acordo AND ap.passenger_id = auth.uid()
    )
  );
CREATE POLICY faltas_insert_envolvidos ON public.faltas
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = (SELECT driver_id FROM public.acordos a WHERE a.id = id_acordo)
    OR EXISTS (
      SELECT 1 FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = faltas.id_acordo AND ap.passenger_id = auth.uid()
    )
  );
CREATE POLICY faltas_update_envolvidos ON public.faltas
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = (SELECT driver_id FROM public.acordos a WHERE a.id = id_acordo)
    OR EXISTS (
      SELECT 1 FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = faltas.id_acordo AND ap.passenger_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = (SELECT driver_id FROM public.acordos a WHERE a.id = id_acordo)
    OR EXISTS (
      SELECT 1 FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = faltas.id_acordo AND ap.passenger_id = auth.uid()
    )
  );
CREATE POLICY faltas_delete_envolvidos ON public.faltas
  FOR DELETE TO authenticated
  USING (
    auth.uid() = (SELECT driver_id FROM public.acordos a WHERE a.id = id_acordo)
    OR EXISTS (
      SELECT 1 FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = faltas.id_acordo AND ap.passenger_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ofertas_capacidade TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procuras TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grupos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.membros_grupo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.propostas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lista_espera TO authenticated;
GRANT SELECT, UPDATE ON public.acordos TO authenticated;
GRANT SELECT, UPDATE ON public.acordos_passageiros TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faltas TO authenticated;

GRANT ALL ON public.ofertas_capacidade TO service_role;
GRANT ALL ON public.procuras TO service_role;
GRANT ALL ON public.grupos TO service_role;
GRANT ALL ON public.membros_grupo TO service_role;
GRANT ALL ON public.propostas TO service_role;
GRANT ALL ON public.lista_espera TO service_role;
GRANT ALL ON public.acordos TO service_role;
GRANT ALL ON public.acordos_passageiros TO service_role;
GRANT ALL ON public.faltas TO service_role;
